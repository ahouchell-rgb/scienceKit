-- =====================================================================
-- School Intelligence Stages 15-20 - the governed teacher operating system.
--
-- Stage 15: source and brain health
-- Stage 16: a role-scoped daily work queue
-- Stage 17: recommendations with human decisions and policy evaluation
-- Stage 18: immutable, structured lesson-bundle specifications
-- Stage 19: one role-aware operating-system read model
-- Stage 20: append-only production/model monitoring
--
-- This migration is deliberately additive. Recommendations never create an
-- action until a named human accepts them, policy evaluations cannot promote
-- themselves, and no pupil-level prediction is exposed by these objects.
-- =====================================================================

create table public.intelligence_source_health (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  source_key            text not null check (length(btrim(source_key)) between 3 and 100),
  domain                text not null
    check (domain in ('identity', 'learning', 'attendance', 'behaviour', 'literacy', 'response', 'forecast')),
  required              boolean not null default false,
  status                text not null
    check (status in ('healthy', 'degraded', 'stale', 'blocked', 'unknown')),
  last_event_at         timestamptz,
  freshness_minutes     integer check (freshness_minutes is null or freshness_minutes >= 0),
  accepted_records      integer not null default 0 check (accepted_records >= 0),
  rejected_records      integer not null default 0 check (rejected_records >= 0),
  unresolved_records    integer not null default 0 check (unresolved_records >= 0),
  detail                jsonb not null default '{}'::jsonb,
  checked_by            uuid references public.profiles(id) on delete set null,
  checked_at            timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (school_id, source_key)
);

create index intelligence_source_health_school_status_idx
  on public.intelligence_source_health (school_id, status, checked_at desc);

create table public.intelligence_recommendations (
  id                         uuid primary key default gen_random_uuid(),
  school_id                  uuid not null references public.schools(id) on delete restrict,
  finding_id                 uuid not null references public.intelligence_findings(id) on delete restrict,
  action_id                  uuid references public.intelligence_actions(id) on delete restrict,
  class_id                   uuid references public.classes(id) on delete set null,
  recommendation_type       text not null
    check (recommendation_type in ('reteach', 'review_evidence', 'curriculum_change', 'department_brief', 'pupil_support', 'data_repair', 'monitor')),
  headline                   text not null check (length(btrim(headline)) between 3 and 240),
  rationale                  text not null check (length(btrim(rationale)) between 3 and 3000),
  priority                   text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  purpose                    text not null check (length(btrim(purpose)) between 3 and 100),
  policy_key                 text not null check (length(btrim(policy_key)) between 3 and 120),
  policy_version             integer not null check (policy_version > 0),
  evidence_snapshot          jsonb not null default '{}'::jsonb,
  explanation               jsonb not null default '{}'::jsonb,
  generated_by_kind          text not null default 'system_rule'
    check (generated_by_kind in ('human', 'system_rule', 'analysis_model')),
  requires_human_acceptance  boolean not null default true
    check (requires_human_acceptance = true),
  status                     text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'rejected', 'superseded')),
  idempotency_key            text not null check (length(btrim(idempotency_key)) >= 16),
  created_by                 uuid not null references public.profiles(id) on delete restrict,
  decided_by                 uuid references public.profiles(id) on delete set null,
  decided_at                 timestamptz,
  decision_note              text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (school_id, idempotency_key),
  check (
    status not in ('accepted', 'rejected')
    or (decided_by is not null and decided_at is not null)
  ),
  check (
    status <> 'rejected'
    or length(btrim(coalesce(decision_note, ''))) >= 3
  )
);

create index intelligence_recommendations_school_status_idx
  on public.intelligence_recommendations (school_id, status, priority, created_at desc);
create index intelligence_recommendations_finding_idx
  on public.intelligence_recommendations (finding_id, created_at desc);
create index intelligence_recommendations_decider_idx
  on public.intelligence_recommendations (decided_by, decided_at desc)
  where decided_by is not null;

create table public.intelligence_lesson_specs (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  finding_id            uuid not null references public.intelligence_findings(id) on delete restrict,
  action_id             uuid not null references public.intelligence_actions(id) on delete restrict,
  context_snapshot_id   uuid not null references public.intelligence_context_snapshots(id) on delete restrict,
  unit_id               text not null check (length(btrim(unit_id)) between 1 and 160),
  lesson_id             text,
  schema_version        integer not null check (schema_version > 0),
  spec_fingerprint      text not null check (length(btrim(spec_fingerprint)) >= 16),
  specification         jsonb not null,
  source_versions       jsonb not null default '{}'::jsonb,
  output_contract       jsonb not null default '{}'::jsonb,
  created_by            uuid not null references public.profiles(id) on delete restrict,
  created_at            timestamptz not null default now(),
  unique (action_id, spec_fingerprint)
);

create index intelligence_lesson_specs_school_time_idx
  on public.intelligence_lesson_specs (school_id, created_at desc);
create index intelligence_lesson_specs_action_idx
  on public.intelligence_lesson_specs (action_id, created_at desc);
create index intelligence_lesson_specs_context_idx
  on public.intelligence_lesson_specs (context_snapshot_id);

create table public.intelligence_policy_evaluations (
  id                         uuid primary key default gen_random_uuid(),
  school_id                  uuid not null references public.schools(id) on delete restrict,
  policy_key                 text not null check (length(btrim(policy_key)) between 3 and 120),
  policy_version             integer not null check (policy_version > 0),
  window_started_at          timestamptz not null,
  window_ended_at            timestamptz not null,
  evaluation_status          text not null
    check (evaluation_status in ('insufficient_data', 'candidate', 'hold', 'retire_review')),
  recommendation_count       integer not null default 0 check (recommendation_count >= 0),
  accepted_count             integer not null default 0 check (accepted_count >= 0),
  delivered_count            integer not null default 0 check (delivered_count >= 0),
  rechecked_count            integer not null default 0 check (rechecked_count >= 0),
  outcome_count              integer not null default 0 check (outcome_count >= 0),
  teacher_override_count     integer not null default 0 check (teacher_override_count >= 0),
  acceptance_rate            numeric(7,4),
  delivery_rate              numeric(7,4),
  recheck_rate               numeric(7,4),
  mean_teacher_rating        numeric(5,2),
  mean_descriptive_delta     numeric(8,2),
  metrics                    jsonb not null default '{}'::jsonb,
  limitations                jsonb not null default '[]'::jsonb
    check (jsonb_typeof(limitations) = 'array'),
  evaluator_version          integer not null default 1 check (evaluator_version > 0),
  evaluated_by               uuid not null references public.profiles(id) on delete restrict,
  evaluated_at               timestamptz not null default now(),
  created_at                 timestamptz not null default now(),
  check (window_ended_at >= window_started_at),
  check (acceptance_rate is null or acceptance_rate between 0 and 1),
  check (delivery_rate is null or delivery_rate between 0 and 1),
  check (recheck_rate is null or recheck_rate between 0 and 1)
);

create index intelligence_policy_evaluations_school_policy_idx
  on public.intelligence_policy_evaluations (school_id, policy_key, policy_version, evaluated_at desc);

create table public.intelligence_monitoring_events (
  id                    bigint generated always as identity primary key,
  school_id             uuid not null references public.schools(id) on delete restrict,
  subsystem             text not null check (length(btrim(subsystem)) between 3 and 100),
  event_type            text not null check (length(btrim(event_type)) between 3 and 120),
  severity              text not null check (severity in ('info', 'warning', 'critical')),
  run_key               text not null check (length(btrim(run_key)) between 8 and 220),
  detail                jsonb not null default '{}'::jsonb,
  observed_at           timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (school_id, subsystem, run_key)
);

create index intelligence_monitoring_events_school_severity_idx
  on public.intelligence_monitoring_events (school_id, severity, observed_at desc);
create index intelligence_monitoring_events_subsystem_idx
  on public.intelligence_monitoring_events (subsystem, observed_at desc);

-- ---------------------------------------------------------------------
-- Scope and grants. Public-schema objects are explicitly granted for the
-- post-2026 Data API model; RLS remains the row-level authority.
-- ---------------------------------------------------------------------
alter table public.intelligence_source_health enable row level security;
alter table public.intelligence_recommendations enable row level security;
alter table public.intelligence_lesson_specs enable row level security;
alter table public.intelligence_policy_evaluations enable row level security;
alter table public.intelligence_monitoring_events enable row level security;

create policy intelligence_source_health_scope_read
  on public.intelligence_source_health for select to authenticated
  using (intelligence_private.can_read_school_scope(school_id));

create policy intelligence_recommendations_scope_read
  on public.intelligence_recommendations for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

create policy intelligence_lesson_specs_scope_read
  on public.intelligence_lesson_specs for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

create policy intelligence_policy_evaluations_leadership_read
  on public.intelligence_policy_evaluations for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));

create policy intelligence_monitoring_events_leadership_read
  on public.intelligence_monitoring_events for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));

revoke all on table
  public.intelligence_source_health,
  public.intelligence_recommendations,
  public.intelligence_lesson_specs,
  public.intelligence_policy_evaluations,
  public.intelligence_monitoring_events
from anon, authenticated;

grant select on table
  public.intelligence_source_health,
  public.intelligence_recommendations,
  public.intelligence_lesson_specs,
  public.intelligence_policy_evaluations,
  public.intelligence_monitoring_events
to authenticated;

grant select, insert, update on table
  public.intelligence_source_health,
  public.intelligence_recommendations
to service_role;

grant select, insert on table
  public.intelligence_lesson_specs,
  public.intelligence_policy_evaluations,
  public.intelligence_monitoring_events
to service_role;

create trigger intelligence_source_health_set_updated_at
  before update on public.intelligence_source_health
  for each row execute function public.tg_set_updated_at();
create trigger intelligence_recommendations_set_updated_at
  before update on public.intelligence_recommendations
  for each row execute function public.tg_set_updated_at();

create trigger intelligence_source_health_no_delete
  before delete on public.intelligence_source_health
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_recommendations_no_delete
  before delete on public.intelligence_recommendations
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_lesson_specs_no_update_or_delete
  before update or delete on public.intelligence_lesson_specs
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_policy_evaluations_no_update_or_delete
  before update or delete on public.intelligence_policy_evaluations
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_monitoring_events_no_update_or_delete
  before update or delete on public.intelligence_monitoring_events
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

-- ---------------------------------------------------------------------
-- Human decision boundary. The API authorises the caller; this service-only,
-- invoker-rights transition atomically records the decision and creates an
-- accepted action only after an explicit human acceptance.
-- ---------------------------------------------------------------------
create or replace function public.decide_intelligence_recommendation(
  p_recommendation_id uuid,
  p_decision text,
  p_decided_by uuid,
  p_decision_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_recommendation public.intelligence_recommendations%rowtype;
  v_action public.intelligence_actions%rowtype;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected'
      using errcode = '22023';
  end if;
  if p_decided_by is null then
    raise exception 'A named human decision maker is required'
      using errcode = '22023';
  end if;
  if p_decision = 'rejected' and length(btrim(coalesce(p_decision_note, ''))) < 3 then
    raise exception 'A rejection note is required'
      using errcode = '22023';
  end if;

  select recommendation.*
  into v_recommendation
  from public.intelligence_recommendations recommendation
  where recommendation.id = p_recommendation_id
  for update;

  if not found then
    raise exception 'Recommendation not found'
      using errcode = 'P0002';
  end if;
  if v_recommendation.status <> 'proposed' then
    raise exception 'Recommendation has already been decided'
      using errcode = '23505';
  end if;

  if p_decision = 'accepted' then
    insert into public.intelligence_actions (
      finding_id,
      action_type,
      title,
      description,
      purpose,
      priority,
      status,
      owner_id,
      created_by,
      proposed_by_kind,
      requires_human_acceptance,
      accepted_by,
      accepted_at,
      updated_by
    ) values (
      v_recommendation.finding_id,
      v_recommendation.recommendation_type,
      v_recommendation.headline,
      v_recommendation.rationale,
      v_recommendation.purpose,
      v_recommendation.priority,
      'accepted',
      p_decided_by,
      p_decided_by,
      v_recommendation.generated_by_kind,
      true,
      p_decided_by,
      now(),
      p_decided_by
    )
    returning * into v_action;

    update public.intelligence_recommendations
    set status = 'accepted',
        action_id = v_action.id,
        decided_by = p_decided_by,
        decided_at = now(),
        decision_note = nullif(btrim(coalesce(p_decision_note, '')), '')
    where id = p_recommendation_id
    returning * into v_recommendation;
  else
    update public.intelligence_recommendations
    set status = 'rejected',
        decided_by = p_decided_by,
        decided_at = now(),
        decision_note = btrim(p_decision_note)
    where id = p_recommendation_id
    returning * into v_recommendation;
  end if;

  insert into public.intelligence_work_events (
    finding_id, action_id, actor_id, event_type, note, detail
  ) values (
    v_recommendation.finding_id,
    v_recommendation.action_id,
    p_decided_by,
    'recommendation.' || p_decision,
    nullif(btrim(coalesce(p_decision_note, '')), ''),
    jsonb_build_object(
      'recommendation_id', v_recommendation.id,
      'policy_key', v_recommendation.policy_key,
      'policy_version', v_recommendation.policy_version
    )
  );

  return jsonb_build_object(
    'recommendation', to_jsonb(v_recommendation),
    'action', case when v_action.id is null then null else to_jsonb(v_action) end
  );
end;
$$;

revoke all on function public.decide_intelligence_recommendation(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.decide_intelligence_recommendation(uuid, text, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------
-- Stage 15 activation check. This reads only aggregate counts and recency,
-- upserts the current source-health surface, and appends one monitoring event.
-- It does not change source data or generate learner conclusions.
-- ---------------------------------------------------------------------
create or replace function public.refresh_intelligence_brain_health(
  p_school_id uuid,
  p_checked_by uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := now();
  v_run_key text := 'health:' || p_school_id::text || ':' || to_char(v_now, 'YYYYMMDDHH24MISSMS');
  v_result jsonb;
begin
  if p_school_id is null or p_checked_by is null then
    raise exception 'School and named checker are required'
      using errcode = '22023';
  end if;

  insert into public.intelligence_source_health (
    school_id, source_key, domain, required, status, last_event_at,
    freshness_minutes, accepted_records, rejected_records,
    unresolved_records, detail, checked_by, checked_at
  )
  select
    p_school_id,
    source.source_key,
    source.domain,
    source.required,
    case
      when source.accepted_records = 0 and source.required then 'blocked'
      when source.accepted_records = 0 then 'unknown'
      when source.unresolved_records > 0 or source.rejected_records > 0 then 'degraded'
      when source.last_event_at < v_now - source.stale_after then 'stale'
      else 'healthy'
    end,
    source.last_event_at,
    case when source.last_event_at is null then null
      else greatest(0, floor(extract(epoch from (v_now - source.last_event_at)) / 60)::integer)
    end,
    source.accepted_records,
    source.rejected_records,
    source.unresolved_records,
    source.detail,
    p_checked_by,
    v_now
  from (
    select
      'canonical_identity'::text as source_key,
      'identity'::text as domain,
      true as required,
      interval '30 days' as stale_after,
      max(coalesce(identity.source_updated_at, identity.created_at)) as last_event_at,
      count(*) filter (where identity.link_status = 'linked')::integer as accepted_records,
      count(*) filter (where identity.link_status = 'rejected')::integer as rejected_records,
      (
        count(*) filter (where identity.link_status = 'proposed') +
        (select count(*) from public.pupil_identity_review_queue review
          where review.school_id = p_school_id and review.status = 'open')
      )::integer as unresolved_records,
      jsonb_build_object('contract', 'canonical_pupil_identity_v1') as detail
    from public.pupil_source_identities identity
    where identity.school_id = p_school_id

    union all

    select
      'education_event_ledger', 'learning', true, interval '14 days',
      max(event.occurred_at), count(*)::integer, 0, 0,
      jsonb_build_object(
        'eventTypes', coalesce(jsonb_agg(distinct event.event_type), '[]'::jsonb),
        'contract', 'immutable_education_event_v1'
      )
    from public.education_events event
    where event.school_id = p_school_id

    union all

    select
      'attendance_observations', 'attendance', false, interval '14 days',
      max(attendance.session_date)::timestamptz, count(*)::integer, 0, 0,
      jsonb_build_object('contract', 'attendance_observation_v1')
    from public.attendance_sessions attendance
    where attendance.school_id = p_school_id

    union all

    select
      'behaviour_observations', 'behaviour', false, interval '30 days',
      max(event.occurred_at), count(*)::integer, 0, 0,
      jsonb_build_object(
        'contract', 'behaviour_observation_v1',
        'interpretation', 'trend evidence only; never a fixed pupil label'
      )
    from public.education_events event
    where event.school_id = p_school_id
      and event.event_type = 'behaviour_incident'

    union all

    select
      'literacy_observations', 'literacy', false, interval '120 days',
      max(literacy.assessed_at), count(*)::integer, 0, 0,
      jsonb_build_object('contract', 'literacy_observation_v1')
    from public.literacy_screens literacy
    where literacy.school_id = p_school_id

    union all

    select
      'response_loop', 'response', false, interval '30 days',
      max(delivery.delivered_at), count(delivery.id)::integer, 0,
      count(delivery.id) filter (where not exists (
        select 1 from public.intelligence_rechecks recheck
        where recheck.delivery_id = delivery.id
      ))::integer,
      jsonb_build_object('contract', 'finding_to_outcome_v1')
    from public.intelligence_deliveries delivery
    join public.intelligence_actions action on action.id = delivery.action_id
    join public.intelligence_findings finding on finding.id = action.finding_id
    where finding.school_id = p_school_id

    union all

    select
      'shadow_forecasting', 'forecast', false, interval '30 days',
      max(run.as_of),
      count(*) filter (where run.status = 'completed')::integer,
      count(*) filter (where run.status = 'failed')::integer,
      count(*) filter (where run.status in ('queued', 'running'))::integer,
      jsonb_build_object('contract', 'shadow_only_next_attempt_v1')
    from public.intelligence_forecast_runs run
    where run.school_id = p_school_id
  ) source
  on conflict (school_id, source_key) do update
  set domain = excluded.domain,
      required = excluded.required,
      status = excluded.status,
      last_event_at = excluded.last_event_at,
      freshness_minutes = excluded.freshness_minutes,
      accepted_records = excluded.accepted_records,
      rejected_records = excluded.rejected_records,
      unresolved_records = excluded.unresolved_records,
      detail = excluded.detail,
      checked_by = excluded.checked_by,
      checked_at = excluded.checked_at;

  select jsonb_build_object(
    'schoolId', p_school_id,
    'checkedAt', v_now,
    'status', case
      when count(*) filter (where required and status = 'blocked') > 0 then 'blocked'
      when count(*) filter (where required and status = 'stale') > 0 then 'stale'
      when count(*) filter (where status = 'degraded') > 0 then 'degraded'
      when count(*) filter (where required and status = 'healthy') > 0 then 'healthy'
      else 'unknown'
    end,
    'sources', coalesce(jsonb_agg(
      jsonb_build_object(
        'sourceKey', source_key,
        'domain', domain,
        'required', required,
        'status', status,
        'lastEventAt', last_event_at,
        'acceptedRecords', accepted_records,
        'unresolvedRecords', unresolved_records
      ) order by required desc, source_key
    ), '[]'::jsonb)
  )
  into v_result
  from public.intelligence_source_health
  where school_id = p_school_id;

  insert into public.intelligence_monitoring_events (
    school_id, subsystem, event_type, severity, run_key, detail, observed_at
  ) values (
    p_school_id,
    'brain_health',
    'brain.health_checked',
    case
      when v_result ->> 'status' = 'blocked' then 'critical'
      when v_result ->> 'status' in ('stale', 'degraded') then 'warning'
      else 'info'
    end,
    v_run_key,
    v_result,
    v_now
  );

  return v_result;
end;
$$;

revoke all on function public.refresh_intelligence_brain_health(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_intelligence_brain_health(uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------
-- Stage 19 read model. SECURITY INVOKER preserves every underlying RLS
-- policy, so the same view becomes teacher, department, school or trust OS.
-- ---------------------------------------------------------------------
create view public.intelligence_operating_system_summary
with (security_invoker = true)
as
select
  school.id as school_id,
  school.name as school_name,
  (
    select count(*)::integer
    from public.intelligence_findings finding
    where finding.school_id = school.id and finding.status = 'open'
  ) as open_findings,
  (
    select count(*)::integer
    from public.intelligence_actions action
    join public.intelligence_findings finding on finding.id = action.finding_id
    where finding.school_id = school.id
      and action.status in ('proposed', 'accepted', 'in_progress')
  ) as visible_actions,
  (
    select count(*)::integer
    from public.intelligence_recommendations recommendation
    where recommendation.school_id = school.id
      and recommendation.status = 'proposed'
  ) as recommendations_waiting,
  (
    select count(*)::integer
    from public.intelligence_rechecks recheck
    join public.intelligence_findings finding on finding.id = recheck.finding_id
    where finding.school_id = school.id
      and recheck.status = 'scheduled'
      and recheck.due_at <= now()
  ) as rechecks_due,
  (
    select count(*)::integer
    from public.intelligence_lesson_specs spec
    where spec.school_id = school.id
  ) as lesson_specs_frozen,
  (
    select case
      when count(*) filter (where health.required and health.status = 'blocked') > 0 then 'blocked'
      when count(*) filter (where health.required and health.status = 'stale') > 0 then 'stale'
      when count(*) filter (where health.status = 'degraded') > 0 then 'degraded'
      when count(*) filter (where health.required and health.status = 'healthy') > 0 then 'healthy'
      else 'unknown'
    end
    from public.intelligence_source_health health
    where health.school_id = school.id
  ) as brain_status,
  (
    select max(health.checked_at)
    from public.intelligence_source_health health
    where health.school_id = school.id
  ) as brain_checked_at,
  (
    select evaluation.evaluation_status
    from public.intelligence_policy_evaluations evaluation
    where evaluation.school_id = school.id
    order by evaluation.evaluated_at desc
    limit 1
  ) as latest_policy_status,
  (
    select count(*)::integer
    from public.intelligence_monitoring_events event
    where event.school_id = school.id
      and event.severity = 'critical'
      and event.observed_at >= now() - interval '7 days'
  ) as critical_events_7d
from public.schools school;

revoke all on table public.intelligence_operating_system_summary
  from anon, authenticated;
grant select on table public.intelligence_operating_system_summary
  to authenticated;

comment on table public.intelligence_source_health is
  'Current aggregate freshness and reconciliation health for each school intelligence source; contains no pupil rows.';
comment on table public.intelligence_recommendations is
  'Governed advisory recommendations. A named human decision is required before an action can exist.';
comment on table public.intelligence_lesson_specs is
  'Immutable structured lesson-bundle contracts frozen alongside reviewed evidence and curriculum context.';
comment on table public.intelligence_policy_evaluations is
  'Append-only evaluation of a recommendation policy. Candidate status never promotes or automates the policy.';
comment on table public.intelligence_monitoring_events is
  'Append-only operational and model monitoring events; aggregate diagnostics only.';
comment on view public.intelligence_operating_system_summary is
  'Role-scoped command-centre summary. Underlying RLS determines teacher, department, school or trust visibility.';
