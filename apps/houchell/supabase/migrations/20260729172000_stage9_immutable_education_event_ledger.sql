-- =====================================================================
-- School Intelligence Stage 9 — immutable education event ledger and
-- transparent learner-state read models.
--
-- Events are append-only observations, not conclusions. Read models expose
-- evidence volume, recency and uncertainty alongside every smoothed mastery
-- estimate. Only canonically reconciled pupils are backfilled.
-- =====================================================================

create table public.education_events (
  id                  uuid primary key default gen_random_uuid(),
  trust_id            uuid references public.trusts(id) on delete restrict,
  school_id           uuid not null references public.schools(id) on delete restrict,
  pupil_id            uuid references public.pupils(id) on delete restrict,
  class_id            uuid references public.classes(id) on delete restrict,
  objective_id        uuid references public.objectives(id) on delete set null,
  objective_key       text,
  event_type          text not null
    check (event_type in (
      'question_answered',
      'assessment_marked',
      'lesson_delivered',
      'attendance_session',
      'behaviour_incident',
      'literacy_screen',
      'intervention_delivered',
      'recheck_completed'
    )),
  occurred_at         timestamptz not null,
  recorded_at         timestamptz not null default now(),
  actor_kind          text not null
    check (actor_kind in ('pupil', 'staff', 'system', 'external_source')),
  actor_id            uuid references public.profiles(id) on delete set null,
  source_system       text not null,
  source_tenant_key   text not null default '',
  source_event_id     text not null check (length(btrim(source_event_id)) > 0),
  schema_version      integer not null default 1 check (schema_version > 0),
  sensitivity         text not null default 'personal'
    check (sensitivity in ('aggregate', 'personal', 'special_category')),
  payload             jsonb not null default '{}'::jsonb,
  provenance          jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (school_id, source_system, source_tenant_key, source_event_id),
  check (pupil_id is not null or class_id is not null),
  check (objective_id is not null or objective_key is not null or event_type not in ('question_answered', 'assessment_marked', 'recheck_completed'))
);

create index education_events_pupil_objective_time_idx
  on public.education_events (pupil_id, objective_id, occurred_at desc)
  where pupil_id is not null;
create index education_events_class_objective_time_idx
  on public.education_events (class_id, objective_id, occurred_at desc)
  where class_id is not null;
create index education_events_school_type_time_idx
  on public.education_events (school_id, event_type, occurred_at desc);
create index education_events_objective_key_idx
  on public.education_events (objective_key, occurred_at desc)
  where objective_key is not null;

alter table public.education_events enable row level security;

create policy education_events_purpose_read on public.education_events
  for select to authenticated
  using (
    intelligence_private.can_manage_school_scope(school_id)
    or (
      pupil_id is not null
      and intelligence_private.can_read_canonical_pupil(pupil_id)
    )
    or exists (
      select 1
      from public.classes class
      where class.id = class_id
        and class.teacher_id = auth.uid()
    )
  );

revoke all on table public.education_events from anon;
grant select on table public.education_events to authenticated;
grant select, insert on table public.education_events to service_role;

create trigger education_events_no_update_or_delete
  before update or delete on public.education_events
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

-- Bayesian smoothing avoids presenting a single response as 0% or 100%.
-- The uncertainty proxy is intentionally visible and shrinks with evidence.
create view public.pupil_learning_state
with (security_invoker = true)
as
select
  event.school_id,
  event.pupil_id,
  event.objective_id,
  event.objective_key,
  round(
    100.0 * (
      count(*) filter (where (event.payload ->> 'isCorrect')::boolean) + 1
    ) / (count(*) + 2),
    1
  ) as mastery_estimate,
  round(least(50.0, 100.0 / sqrt(count(*) + 1)), 1) as uncertainty_points,
  count(*)::integer as evidence_count,
  max(event.occurred_at) as last_evidence_at,
  jsonb_agg(distinct event.source_system) as source_mix,
  1 as model_version
from public.education_events event
where event.event_type = 'question_answered'
  and event.pupil_id is not null
  and event.payload ? 'isCorrect'
group by
  event.school_id,
  event.pupil_id,
  event.objective_id,
  event.objective_key;

create view public.class_learning_state
with (security_invoker = true)
as
select
  event.school_id,
  event.class_id,
  class.name as class_name,
  class.year_group,
  event.objective_id,
  event.objective_key,
  objective.title as objective_title,
  round(
    100.0 * (
      count(*) filter (where (event.payload ->> 'isCorrect')::boolean) + 1
    ) / (count(*) + 2),
    1
  ) as mastery_estimate,
  round(least(50.0, 100.0 / sqrt(count(*) + 1)), 1) as uncertainty_points,
  count(*)::integer as evidence_count,
  count(distinct event.pupil_id)::integer as pupil_count,
  max(event.occurred_at) as last_evidence_at,
  jsonb_agg(distinct event.source_system) as source_mix,
  1 as model_version
from public.education_events event
join public.classes class on class.id = event.class_id
left join public.objectives objective on objective.id = event.objective_id
where event.event_type = 'question_answered'
  and event.class_id is not null
  and event.payload ? 'isCorrect'
group by
  event.school_id,
  event.class_id,
  class.name,
  class.year_group,
  event.objective_id,
  event.objective_key,
  objective.title;

create view public.school_intelligence_coverage
with (security_invoker = true)
as
select
  school.id as school_id,
  school.name as school_name,
  (
    select count(*)
    from public.pupils pupil
    where pupil.school_id = school.id
      and pupil.status = 'active'
  )::integer as canonical_pupils,
  (
    select count(*)
    from public.pupil_source_identities identity
    where identity.school_id = school.id
      and identity.link_status = 'linked'
  )::integer as linked_source_identities,
  (
    select count(*)
    from public.pupil_identity_review_queue review
    where review.school_id = school.id
      and review.status = 'open'
  )::integer as unresolved_identities,
  (
    select count(*)
    from public.education_events event
    where event.school_id = school.id
  )::integer as learning_events,
  (
    select max(event.occurred_at)
    from public.education_events event
    where event.school_id = school.id
  ) as latest_event_at
from public.schools school;

revoke all on table
  public.pupil_learning_state,
  public.class_learning_state,
  public.school_intelligence_coverage
from anon;
grant select on table
  public.pupil_learning_state,
  public.class_learning_state,
  public.school_intelligence_coverage
to authenticated;

-- Idempotent activation from the existing retrieval response stream.
-- Rows without a reviewed canonical identity remain counted as skipped.
create or replace function public.backfill_retrieval_education_events(p_school_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer := 0;
  v_eligible integer := 0;
  v_unlinked integer := 0;
begin
  if not (
    auth.role() = 'service_role'
    or intelligence_private.can_manage_school_scope(p_school_id)
  ) then
    raise exception 'School intelligence management scope required';
  end if;

  select count(*) into v_eligible
  from public.responses response
  join public.classes class on class.id = response.class_id
  join public.pupil_source_identities identity
    on identity.school_id = p_school_id
   and identity.source_system = 'retrieval_profile'
   and identity.source_tenant_key = p_school_id::text
   and identity.source_record_id = response.student_id::text
   and identity.link_status = 'linked'
  where class.school_id = p_school_id
    and response.is_correct is not null;

  select count(*) into v_unlinked
  from public.responses response
  join public.classes class on class.id = response.class_id
  where class.school_id = p_school_id
    and response.is_correct is not null
    and not exists (
      select 1
      from public.pupil_source_identities identity
      where identity.school_id = p_school_id
        and identity.source_system = 'retrieval_profile'
        and identity.source_tenant_key = p_school_id::text
        and identity.source_record_id = response.student_id::text
        and identity.link_status = 'linked'
    );

  insert into public.education_events (
    trust_id,
    school_id,
    pupil_id,
    class_id,
    objective_id,
    objective_key,
    event_type,
    occurred_at,
    actor_kind,
    actor_id,
    source_system,
    source_tenant_key,
    source_event_id,
    sensitivity,
    payload,
    provenance
  )
  select
    school.trust_id,
    p_school_id,
    identity.pupil_id,
    response.class_id,
    topic_map.objective_id,
    coalesce(topic_map.objective_id::text, question.topic_id::text),
    'question_answered',
    response.answered_at,
    'pupil',
    response.student_id,
    'retrieval',
    p_school_id::text,
    response.id::text,
    'personal',
    jsonb_build_object(
      'isCorrect', response.is_correct,
      'marksAwarded', response.marks_awarded,
      'questionId', response.question_id,
      'topicId', question.topic_id,
      'teacherReviewed', response.teacher_reviewed
    ),
    jsonb_build_object(
      'sourceTable', 'responses',
      'sourceRecordId', response.id,
      'identityLinkId', identity.id,
      'ingestMethod', 'stage9_backfill'
    )
  from public.responses response
  join public.classes class on class.id = response.class_id
  join public.schools school on school.id = class.school_id
  join public.questions question on question.id = response.question_id
  left join public.topic_objective_map topic_map on topic_map.topic_id = question.topic_id
  join public.pupil_source_identities identity
    on identity.school_id = p_school_id
   and identity.source_system = 'retrieval_profile'
   and identity.source_tenant_key = p_school_id::text
   and identity.source_record_id = response.student_id::text
   and identity.link_status = 'linked'
  where class.school_id = p_school_id
    and response.is_correct is not null
  on conflict (school_id, source_system, source_tenant_key, source_event_id)
  do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'inserted', v_inserted,
    'eligible', v_eligible,
    'skippedUnlinked', v_unlinked
  );
end;
$$;

revoke execute on function public.backfill_retrieval_education_events(uuid) from public, anon;
grant execute on function public.backfill_retrieval_education_events(uuid) to authenticated, service_role;

comment on table public.education_events is
  'Append-only observations with source provenance. Interpretations and actions live outside the event ledger.';
comment on view public.pupil_learning_state is
  'Transparent smoothed objective state with evidence count, recency, sources, uncertainty and model version.';
