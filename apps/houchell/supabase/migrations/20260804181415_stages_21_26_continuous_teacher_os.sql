-- =====================================================================
-- School Intelligence Stages 21-26 - the continuous teacher OS.
--
-- 21 security contract + explicit Data API grants
-- 22 governed MIS staging promotion into canonical identity
-- 23 durable, observable intelligence-cycle orchestration
-- 24 model governance laboratory (evaluation, never auto-promotion)
-- 25 lesson specification/artifact/outcome quality loop
-- 26 one aggregate operating-system read model
-- =====================================================================

-- ---------------------------------------------------------------------
-- Stage 21: harden the staging surfaces touched by the continuous cycle.
-- SELECT policies deliberately use a scalar init plan for auth.uid().
-- ---------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'mis_connections', 'mis_students', 'mis_contacts', 'mis_sync_runs',
    'mis_classes', 'mis_class_students'
  ] loop
    execute format('drop policy if exists %I_member_read on public.%I', v_table, v_table);
    execute format(
      'create policy %I_member_read on public.%I for select to authenticated '
      'using (school_id = (select profile.school_id from public.profiles profile where profile.id = (select auth.uid())))',
      v_table,
      v_table
    );
    execute format('revoke all on table public.%I from anon', v_table);
    execute format('grant select on table public.%I to authenticated', v_table);
    execute format('grant select, insert, update, delete on table public.%I to service_role', v_table);
  end loop;
end
$$;

-- System-attributed runs are allowed to omit a profile. Human requests still
-- require a named profile through the cross-column checks below.
alter table public.intelligence_forecast_runs
  alter column requested_by drop not null,
  add column requested_by_kind text not null default 'human'
    check (requested_by_kind in ('human', 'system'));

alter table public.intelligence_forecast_runs
  add constraint intelligence_forecast_runs_requester_contract
  check (requested_by_kind = 'system' or requested_by is not null);

alter table public.intelligence_policy_evaluations
  alter column evaluated_by drop not null,
  add column evaluated_by_kind text not null default 'human'
    check (evaluated_by_kind in ('human', 'system'));

alter table public.intelligence_policy_evaluations
  add constraint intelligence_policy_evaluations_evaluator_contract
  check (evaluated_by_kind = 'system' or evaluated_by is not null);

alter table public.intelligence_source_health
  add column checked_by_kind text not null default 'human'
    check (checked_by_kind in ('human', 'system'));

-- ---------------------------------------------------------------------
-- Stage 22: promote the Wonde mirror into the canonical identity plane.
-- The promotion never guesses an ambiguous identity or class match.
-- ---------------------------------------------------------------------
alter table public.mis_classes
  add column canonical_class_id uuid references public.classes(id) on delete set null;

create index mis_classes_canonical_class_idx
  on public.mis_classes(canonical_class_id)
  where canonical_class_id is not null;

create table public.intelligence_data_promotions (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  source_system         text not null default 'wonde_mis'
    check (source_system = 'wonde_mis'),
  run_key               text not null check (length(btrim(run_key)) between 16 and 220),
  status                text not null default 'running'
    check (status in ('running', 'completed', 'completed_with_issues', 'failed')),
  staged_students       integer not null default 0 check (staged_students >= 0),
  linked_students       integer not null default 0 check (linked_students >= 0),
  created_pupils        integer not null default 0 check (created_pupils >= 0),
  review_students       integer not null default 0 check (review_students >= 0),
  mapped_classes        integer not null default 0 check (mapped_classes >= 0),
  membership_count      integer not null default 0 check (membership_count >= 0),
  detail                jsonb not null default '{}'::jsonb,
  error_summary         text,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (school_id, run_key),
  check (status = 'running' or completed_at is not null)
);

create index intelligence_data_promotions_school_time_idx
  on public.intelligence_data_promotions(school_id, started_at desc);

create table public.intelligence_data_quality_issues (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  promotion_id          uuid references public.intelligence_data_promotions(id) on delete restrict,
  source_system         text not null,
  source_record_kind    text not null
    check (source_record_kind in ('student', 'class', 'membership', 'connection')),
  source_record_id      text not null,
  issue_code            text not null check (length(btrim(issue_code)) between 3 and 100),
  severity              text not null default 'warning'
    check (severity in ('info', 'warning', 'blocking')),
  status                text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  detail                jsonb not null default '{}'::jsonb,
  resolved_by           uuid references public.profiles(id) on delete set null,
  resolved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (school_id, source_system, source_record_kind, source_record_id, issue_code),
  check (status = 'open' or resolved_at is not null)
);

create index intelligence_data_quality_open_idx
  on public.intelligence_data_quality_issues(school_id, severity, created_at desc)
  where status = 'open';

create or replace function public.promote_mis_to_intelligence(
  p_school_id uuid,
  p_run_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_run public.intelligence_data_promotions%rowtype;
  v_student public.mis_students%rowtype;
  v_class public.mis_classes%rowtype;
  v_pupil_id uuid;
  v_identity_id uuid;
  v_candidates uuid[];
  v_class_candidates uuid[];
  v_created integer := 0;
  v_linked integer := 0;
  v_review integer := 0;
  v_mapped_classes integer := 0;
  v_memberships integer := 0;
  v_issues integer := 0;
  v_staged integer := 0;
  v_key text := coalesce(nullif(btrim(p_run_key), ''),
    'mis-promotion:' || p_school_id::text || ':' || to_char(now(), 'YYYYMMDDHH24'));
begin
  if p_school_id is null then
    raise exception 'A school is required' using errcode = '22023';
  end if;

  insert into public.intelligence_data_promotions (school_id, run_key)
  values (p_school_id, v_key)
  on conflict (school_id, run_key) do nothing
  returning * into v_run;

  if v_run.id is null then
    select * into v_run
    from public.intelligence_data_promotions
    where school_id = p_school_id and run_key = v_key;
    if v_run.status <> 'failed' then
      return jsonb_build_object('runId', v_run.id, 'status', v_run.status, 'reused', true,
        'createdPupils', v_run.created_pupils, 'linkedStudents', v_run.linked_students,
        'reviewStudents', v_run.review_students, 'mappedClasses', v_run.mapped_classes,
        'memberships', v_run.membership_count);
    end if;
    update public.intelligence_data_promotions
    set status = 'running', completed_at = null, error_summary = null, updated_at = now()
    where id = v_run.id;
  end if;

  begin
  select count(*)::integer into v_staged
  from public.mis_students where school_id = p_school_id;

  for v_student in
    select * from public.mis_students
    where school_id = p_school_id
    order by mis_id
  loop
    v_pupil_id := null;
    v_identity_id := null;
    v_candidates := '{}'::uuid[];

    if v_student.canonical_pupil_id is not null then
      select pupil.id into v_pupil_id
      from public.pupils pupil
      where pupil.id = v_student.canonical_pupil_id
        and pupil.school_id = p_school_id;
    end if;

    if v_pupil_id is null then
      select identity.pupil_id, identity.id
      into v_pupil_id, v_identity_id
      from public.pupil_source_identities identity
      where identity.school_id = p_school_id
        and identity.source_system = 'mis_student'
        and identity.source_tenant_key = p_school_id::text
        and identity.source_record_id = v_student.mis_id
        and identity.link_status = 'linked'
      limit 1;
    end if;

    if v_pupil_id is null and nullif(btrim(coalesce(v_student.full_name, '')), '') is not null then
      select coalesce(array_agg(pupil.id order by pupil.id), '{}'::uuid[])
      into v_candidates
      from public.pupils pupil
      where pupil.school_id = p_school_id
        and pupil.status = 'active'
        and lower(regexp_replace(btrim(pupil.display_name), '[[:space:]]+', ' ', 'g')) =
            lower(regexp_replace(btrim(v_student.full_name), '[[:space:]]+', ' ', 'g'))
        and (v_student.year_group is null or pupil.year_group = v_student.year_group);

      if cardinality(v_candidates) > 0 then
        insert into public.pupil_identity_review_queue (
          school_id, source_system, source_tenant_key, source_record_id,
          source_display_name, source_snapshot, candidate_pupil_ids, reason_codes
        ) values (
          p_school_id, 'mis_student', p_school_id::text, v_student.mis_id,
          v_student.full_name,
          jsonb_build_object('yearGroup', v_student.year_group, 'form', v_student.form,
            'upnPresent', nullif(btrim(coalesce(v_student.upn, '')), '') is not null),
          v_candidates,
          array['possible_existing_pupil', 'human_confirmation_required']
        )
        on conflict (school_id, source_system, source_tenant_key, source_record_id)
        do update set source_snapshot = excluded.source_snapshot,
          candidate_pupil_ids = excluded.candidate_pupil_ids,
          reason_codes = excluded.reason_codes,
          status = case when public.pupil_identity_review_queue.status = 'resolved'
            then public.pupil_identity_review_queue.status else 'open' end,
          updated_at = now();
        v_review := v_review + 1;
        continue;
      end if;

      insert into public.pupils (school_id, display_name, year_group, form_group)
      values (
        p_school_id,
        btrim(v_student.full_name),
        case when v_student.year_group between 0 and 14 then v_student.year_group else null end,
        nullif(btrim(coalesce(v_student.form, '')), '')
      )
      returning id into v_pupil_id;
      v_created := v_created + 1;

      insert into public.pupil_source_identities (
        school_id, pupil_id, source_system, source_tenant_key, source_record_id,
        source_display_name, match_method, match_confidence, link_status,
        evidence, source_updated_at, reviewed_at
      ) values (
        p_school_id, v_pupil_id, 'mis_student', p_school_id::text, v_student.mis_id,
        v_student.full_name, 'verified_external_id', 1, 'linked',
        jsonb_build_object('provider', 'wonde', 'createdFromAuthoritativeRoster', true,
          'upnPresent', nullif(btrim(coalesce(v_student.upn, '')), '') is not null),
        v_student.synced_at, now()
      ) returning id into v_identity_id;
    end if;

    if v_pupil_id is not null then
      update public.mis_students
      set canonical_pupil_id = v_pupil_id
      where id = v_student.id and canonical_pupil_id is distinct from v_pupil_id;
      v_linked := v_linked + 1;
      update public.intelligence_data_quality_issues
      set status = 'resolved', resolved_at = now(), updated_at = now()
      where school_id = p_school_id
        and source_system = 'wonde_mis'
        and source_record_kind = 'student'
        and source_record_id = v_student.mis_id
        and issue_code = 'missing_student_name'
        and status = 'open';
    elsif nullif(btrim(coalesce(v_student.full_name, '')), '') is null then
      insert into public.intelligence_data_quality_issues (
        school_id, promotion_id, source_system, source_record_kind,
        source_record_id, issue_code, severity, detail
      ) values (
        p_school_id, v_run.id, 'wonde_mis', 'student', v_student.mis_id,
        'missing_student_name', 'blocking', jsonb_build_object('yearGroup', v_student.year_group)
      ) on conflict (school_id, source_system, source_record_kind, source_record_id, issue_code)
        do update set promotion_id = excluded.promotion_id, detail = excluded.detail,
          status = 'open', resolved_at = null, resolved_by = null, updated_at = now();
      v_issues := v_issues + 1;
    end if;
  end loop;

  for v_class in
    select * from public.mis_classes
    where school_id = p_school_id
    order by mis_id
  loop
    if v_class.canonical_class_id is not null then
      if exists (
        select 1
        from public.classes clazz
        join public.profiles teacher on teacher.id = clazz.teacher_id
        where clazz.id = v_class.canonical_class_id
          and teacher.school_id = p_school_id
      ) then
        v_mapped_classes := v_mapped_classes + 1;
        update public.intelligence_data_quality_issues
        set status = 'resolved', resolved_at = now(), updated_at = now()
        where school_id = p_school_id
          and source_system = 'wonde_mis'
          and source_record_kind = 'class'
          and source_record_id = v_class.mis_id
          and issue_code in ('class_not_mapped', 'class_match_ambiguous', 'class_mapping_outside_school')
          and status = 'open';
        continue;
      end if;

      update public.mis_classes set canonical_class_id = null where id = v_class.id;
      v_class.canonical_class_id := null;
      insert into public.intelligence_data_quality_issues (
        school_id, promotion_id, source_system, source_record_kind,
        source_record_id, issue_code, severity, detail
      ) values (
        p_school_id, v_run.id, 'wonde_mis', 'class', v_class.mis_id,
        'class_mapping_outside_school', 'blocking', jsonb_build_object('name', v_class.name)
      ) on conflict (school_id, source_system, source_record_kind, source_record_id, issue_code)
        do update set promotion_id = excluded.promotion_id, status = 'open',
          resolved_at = null, resolved_by = null, updated_at = now();
      v_issues := v_issues + 1;
    end if;

    select coalesce(array_agg(clazz.id order by clazz.id), '{}'::uuid[])
    into v_class_candidates
    from public.classes clazz
    join public.profiles teacher on teacher.id = clazz.teacher_id
    where teacher.school_id = p_school_id
      and clazz.archived = false
      and lower(regexp_replace(btrim(clazz.name), '[[:space:]]+', ' ', 'g')) =
          lower(regexp_replace(btrim(coalesce(v_class.name, '')), '[[:space:]]+', ' ', 'g'));

    if cardinality(v_class_candidates) = 1 then
      update public.mis_classes
      set canonical_class_id = v_class_candidates[1]
      where id = v_class.id and canonical_class_id is distinct from v_class_candidates[1];
      v_mapped_classes := v_mapped_classes + 1;
      update public.intelligence_data_quality_issues
      set status = 'resolved', resolved_at = now(), updated_at = now()
      where school_id = p_school_id
        and source_system = 'wonde_mis'
        and source_record_kind = 'class'
        and source_record_id = v_class.mis_id
        and issue_code in ('class_not_mapped', 'class_match_ambiguous', 'class_mapping_outside_school')
        and status = 'open';
    else
      insert into public.intelligence_data_quality_issues (
        school_id, promotion_id, source_system, source_record_kind,
        source_record_id, issue_code, severity, detail
      ) values (
        p_school_id, v_run.id, 'wonde_mis', 'class', v_class.mis_id,
        case when cardinality(v_class_candidates) = 0 then 'class_not_mapped' else 'class_match_ambiguous' end,
        'warning', jsonb_build_object('name', v_class.name, 'candidateClassIds', v_class_candidates)
      ) on conflict (school_id, source_system, source_record_kind, source_record_id, issue_code)
        do update set promotion_id = excluded.promotion_id, detail = excluded.detail,
          status = 'open', resolved_at = null, resolved_by = null, updated_at = now();
      v_issues := v_issues + 1;
    end if;
  end loop;

  insert into public.pupil_class_memberships (
    school_id, pupil_id, class_id, source_identity_id
  )
  select
    p_school_id, student.canonical_pupil_id, clazz.canonical_class_id, identity.id
  from public.mis_class_students membership
  join public.mis_students student
    on student.school_id = membership.school_id and student.mis_id = membership.student_mis_id
  join public.mis_classes clazz
    on clazz.school_id = membership.school_id and clazz.mis_id = membership.class_mis_id
  left join public.pupil_source_identities identity
    on identity.school_id = student.school_id
    and identity.source_system = 'mis_student'
    and identity.source_tenant_key = student.school_id::text
    and identity.source_record_id = student.mis_id
    and identity.link_status = 'linked'
  where membership.school_id = p_school_id
    and student.canonical_pupil_id is not null
    and clazz.canonical_class_id is not null
  on conflict (pupil_id, class_id) where valid_to is null do nothing;
  get diagnostics v_memberships = row_count;

  update public.intelligence_data_promotions
  set status = case when v_review + v_issues > 0 then 'completed_with_issues' else 'completed' end,
      staged_students = v_staged,
      linked_students = v_linked,
      created_pupils = v_created,
      review_students = v_review,
      mapped_classes = v_mapped_classes,
      membership_count = v_memberships,
      detail = jsonb_build_object('unresolvedIssues', v_issues, 'identityContract', 'canonical_pupil_v1'),
      completed_at = now(), updated_at = now()
  where id = v_run.id;

  return jsonb_build_object('runId', v_run.id,
    'status', case when v_review + v_issues > 0 then 'completed_with_issues' else 'completed' end,
    'reused', false, 'stagedStudents', v_staged, 'linkedStudents', v_linked,
    'createdPupils', v_created, 'reviewStudents', v_review,
    'mappedClasses', v_mapped_classes, 'memberships', v_memberships,
    'unresolvedIssues', v_issues);
exception when others then
  if v_run.id is not null then
    update public.intelligence_data_promotions
    set status = 'failed', error_summary = left(sqlerrm, 1000),
      completed_at = now(), updated_at = now()
    where id = v_run.id;
  end if;
  return jsonb_build_object(
    'runId', v_run.id,
    'status', 'failed',
    'reused', false,
    'error', left(sqlerrm, 1000)
  );
  end;
end;
$$;

revoke all on function public.promote_mis_to_intelligence(uuid, text)
  from public, anon, authenticated;
grant execute on function public.promote_mis_to_intelligence(uuid, text)
  to service_role;

-- ---------------------------------------------------------------------
-- Stage 23: a durable run record for each scheduled school brain cycle.
-- ---------------------------------------------------------------------
create table public.intelligence_orchestration_runs (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  workflow_key          text not null default 'continuous_teacher_os_v1',
  run_key               text not null check (length(btrim(run_key)) between 16 and 220),
  status                text not null default 'running'
    check (status in ('running', 'completed', 'completed_with_issues', 'failed')),
  current_stage         integer check (current_stage between 21 and 26),
  steps                 jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  counts                jsonb not null default '{}'::jsonb,
  error_summary         text,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (school_id, workflow_key, run_key),
  check (status = 'running' or completed_at is not null)
);

create index intelligence_orchestration_school_time_idx
  on public.intelligence_orchestration_runs(school_id, started_at desc);

-- A service-only wrapper preserves the original named-human health RPC while
-- allowing the scheduler to mark its health refresh as system-attributed.
create or replace function public.refresh_intelligence_brain_health_system(p_school_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_checker uuid;
  v_result jsonb;
begin
  select profile.id into v_checker
  from public.profiles profile
  where profile.school_id = p_school_id
  order by profile.created_at asc nulls last, profile.id
  limit 1;
  if v_checker is null then
    raise exception 'No staff profile is available for this school health scope'
      using errcode = 'P0002';
  end if;
  v_result := public.refresh_intelligence_brain_health(p_school_id, v_checker);
  update public.intelligence_source_health
  set checked_by = null, checked_by_kind = 'system'
  where school_id = p_school_id
    and checked_by = v_checker
    and checked_at >= now() - interval '1 minute';
  return v_result;
end;
$$;

revoke all on function public.refresh_intelligence_brain_health_system(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_intelligence_brain_health_system(uuid)
  to service_role;

-- ---------------------------------------------------------------------
-- Stage 24: model governance evidence. A check can nominate a candidate for
-- review, but only a named human can record a release decision elsewhere.
-- ---------------------------------------------------------------------
create table public.intelligence_model_governance_checks (
  id                         uuid primary key default gen_random_uuid(),
  school_id                  uuid not null references public.schools(id) on delete restrict,
  model_version_id           uuid not null references public.intelligence_model_versions(id) on delete restrict,
  run_key                    text not null check (length(btrim(run_key)) between 16 and 220),
  governance_status          text not null
    check (governance_status in ('insufficient_data', 'candidate_for_review', 'hold', 'retire_review')),
  sample_size                integer not null default 0 check (sample_size >= 0),
  brier_score                numeric(10,9),
  baseline_brier_score       numeric(10,9),
  brier_skill_score          numeric(10,9),
  expected_calibration_error numeric(10,9),
  drift_status               text not null default 'unknown'
    check (drift_status in ('unknown', 'stable', 'watch', 'material')),
  thresholds                 jsonb not null default '{}'::jsonb,
  evidence                   jsonb not null default '{}'::jsonb,
  limitations                jsonb not null default '[]'::jsonb
    check (jsonb_typeof(limitations) = 'array'),
  evaluator_version          integer not null default 1 check (evaluator_version > 0),
  created_at                 timestamptz not null default now(),
  unique (school_id, model_version_id, run_key)
);

create index intelligence_model_governance_school_time_idx
  on public.intelligence_model_governance_checks(school_id, created_at desc);

create table public.intelligence_model_release_reviews (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  model_version_id      uuid not null references public.intelligence_model_versions(id) on delete restrict,
  governance_check_id   uuid not null references public.intelligence_model_governance_checks(id) on delete restrict,
  decision              text not null check (decision in ('approve_shadow', 'hold', 'retire')),
  rationale             text not null check (length(btrim(rationale)) between 12 and 4000),
  reviewed_by           uuid not null references public.profiles(id) on delete restrict,
  reviewed_at           timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

create index intelligence_model_release_reviews_model_idx
  on public.intelligence_model_release_reviews(model_version_id, reviewed_at desc);

-- ---------------------------------------------------------------------
-- Stage 25: quality evidence for generated lesson bundles.
-- ---------------------------------------------------------------------
create table public.intelligence_lesson_quality_evaluations (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  lesson_spec_id        uuid not null references public.intelligence_lesson_specs(id) on delete restrict,
  artifact_id           uuid references public.intelligence_artifacts(id) on delete restrict,
  finding_id            uuid not null references public.intelligence_findings(id) on delete restrict,
  action_id             uuid not null references public.intelligence_actions(id) on delete restrict,
  run_key               text not null check (length(btrim(run_key)) between 16 and 220),
  evaluator_kind        text not null check (evaluator_kind in ('automated_contract', 'human_feedback', 'outcome')),
  quality_status        text not null
    check (quality_status in ('insufficient_data', 'passes_contract', 'review', 'poor')),
  contract_score        numeric(5,4) check (contract_score between 0 and 1),
  teacher_rating        numeric(5,2) check (teacher_rating between 1 and 5),
  edit_rate             numeric(5,4) check (edit_rate between 0 and 1),
  delivery_count        integer not null default 0 check (delivery_count >= 0),
  outcome_count         integer not null default 0 check (outcome_count >= 0),
  mean_descriptive_delta numeric(8,2),
  evidence              jsonb not null default '{}'::jsonb,
  limitations           jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  evaluated_by_kind     text not null default 'system' check (evaluated_by_kind in ('human', 'system')),
  evaluated_by          uuid references public.profiles(id) on delete restrict,
  evaluated_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (school_id, lesson_spec_id, evaluator_kind, run_key),
  check (evaluated_by_kind = 'system' or evaluated_by is not null)
);

create index intelligence_lesson_quality_school_time_idx
  on public.intelligence_lesson_quality_evaluations(school_id, evaluated_at desc);
create index intelligence_lesson_quality_spec_idx
  on public.intelligence_lesson_quality_evaluations(lesson_spec_id, evaluated_at desc);

-- ---------------------------------------------------------------------
-- Explicit RLS/grants and immutable audit evidence.
-- ---------------------------------------------------------------------
alter table public.intelligence_data_promotions enable row level security;
alter table public.intelligence_data_quality_issues enable row level security;
alter table public.intelligence_orchestration_runs enable row level security;
alter table public.intelligence_model_governance_checks enable row level security;
alter table public.intelligence_model_release_reviews enable row level security;
alter table public.intelligence_lesson_quality_evaluations enable row level security;

create policy intelligence_data_promotions_leadership_read
  on public.intelligence_data_promotions for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_data_quality_leadership_read
  on public.intelligence_data_quality_issues for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_orchestration_leadership_read
  on public.intelligence_orchestration_runs for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_model_governance_leadership_read
  on public.intelligence_model_governance_checks for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_model_release_reviews_leadership_read
  on public.intelligence_model_release_reviews for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_lesson_quality_scope_read
  on public.intelligence_lesson_quality_evaluations for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

revoke all on table
  public.intelligence_data_promotions,
  public.intelligence_data_quality_issues,
  public.intelligence_orchestration_runs,
  public.intelligence_model_governance_checks,
  public.intelligence_model_release_reviews,
  public.intelligence_lesson_quality_evaluations
from anon;

grant select on table
  public.intelligence_data_promotions,
  public.intelligence_data_quality_issues,
  public.intelligence_orchestration_runs,
  public.intelligence_model_governance_checks,
  public.intelligence_model_release_reviews,
  public.intelligence_lesson_quality_evaluations
to authenticated;

grant select, insert, update on table
  public.intelligence_data_promotions,
  public.intelligence_data_quality_issues,
  public.intelligence_orchestration_runs
to service_role;

grant select, insert on table
  public.intelligence_model_governance_checks,
  public.intelligence_model_release_reviews,
  public.intelligence_lesson_quality_evaluations
to service_role;

create trigger intelligence_data_promotions_updated_at
  before update on public.intelligence_data_promotions
  for each row execute function public.tg_set_updated_at();
create trigger intelligence_data_quality_updated_at
  before update on public.intelligence_data_quality_issues
  for each row execute function public.tg_set_updated_at();
create trigger intelligence_orchestration_updated_at
  before update on public.intelligence_orchestration_runs
  for each row execute function public.tg_set_updated_at();

create trigger intelligence_model_governance_immutable
  before update or delete on public.intelligence_model_governance_checks
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_model_release_reviews_immutable
  before update or delete on public.intelligence_model_release_reviews
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_lesson_quality_immutable
  before update or delete on public.intelligence_lesson_quality_evaluations
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

-- A small service-only security assertion runs inside every brain cycle. It
-- checks the exact data plane the cycle can touch; it exposes no row data.
create or replace function public.audit_continuous_teacher_os_security()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_tables constant text[] := array[
    'mis_connections', 'mis_students', 'mis_contacts', 'mis_sync_runs',
    'mis_classes', 'mis_class_students', 'pupils', 'pupil_source_identities',
    'pupil_class_memberships', 'pupil_identity_review_queue',
    'education_events', 'intelligence_forecast_runs', 'intelligence_forecasts',
    'intelligence_policy_evaluations', 'intelligence_lesson_specs',
    'intelligence_data_promotions', 'intelligence_data_quality_issues',
    'intelligence_orchestration_runs', 'intelligence_model_governance_checks',
    'intelligence_model_release_reviews', 'intelligence_lesson_quality_evaluations'
  ];
  v_missing_rls text[];
  v_anon_grants jsonb;
begin
  select coalesce(array_agg(class.relname order by class.relname), '{}'::text[])
  into v_missing_rls
  from pg_catalog.pg_class class
  join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any(v_tables)
    and class.relkind in ('r', 'p')
    and not class.relrowsecurity;

  select coalesce(jsonb_agg(jsonb_build_object(
    'table', grant_row.table_name,
    'privilege', grant_row.privilege_type
  ) order by grant_row.table_name, grant_row.privilege_type), '[]'::jsonb)
  into v_anon_grants
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name = any(v_tables)
    and grant_row.grantee in ('anon', 'PUBLIC');

  return jsonb_build_object(
    'status', case when cardinality(v_missing_rls) = 0 and jsonb_array_length(v_anon_grants) = 0
      then 'healthy' else 'blocked' end,
    'checkedTables', cardinality(v_tables),
    'missingRls', v_missing_rls,
    'anonymousGrants', v_anon_grants,
    'rowDataExposed', false
  );
end;
$$;

revoke all on function public.audit_continuous_teacher_os_security()
  from public, anon, authenticated;
grant execute on function public.audit_continuous_teacher_os_security()
  to service_role;

-- ---------------------------------------------------------------------
-- Stage 26: a single aggregate health surface for the live teacher OS.
-- SECURITY INVOKER means every subquery retains the caller's RLS scope.
-- ---------------------------------------------------------------------
create view public.intelligence_continuous_os_summary
with (security_invoker = true)
as
select
  school.id as school_id,
  school.name as school_name,
  (select run.status from public.intelligence_orchestration_runs run
    where run.school_id = school.id order by run.started_at desc limit 1) as latest_cycle_status,
  (select run.started_at from public.intelligence_orchestration_runs run
    where run.school_id = school.id order by run.started_at desc limit 1) as latest_cycle_at,
  (select count(*)::integer from public.intelligence_data_quality_issues issue
    where issue.school_id = school.id and issue.status = 'open') as open_data_issues,
  (select count(*)::integer from public.intelligence_data_quality_issues issue
    where issue.school_id = school.id and issue.status = 'open' and issue.severity = 'blocking') as blocking_data_issues,
  (select check_row.governance_status from public.intelligence_model_governance_checks check_row
    where check_row.school_id = school.id order by check_row.created_at desc limit 1) as latest_model_status,
  (select count(*)::integer from public.intelligence_model_governance_checks check_row
    where check_row.school_id = school.id) as model_checks,
  (select count(*)::integer from public.intelligence_lesson_quality_evaluations quality
    where quality.school_id = school.id) as lesson_quality_checks,
  (select round(avg(quality.contract_score), 4) from public.intelligence_lesson_quality_evaluations quality
    where quality.school_id = school.id and quality.contract_score is not null) as mean_lesson_contract_score,
  false as automatic_model_promotion,
  false as automatic_consequential_decisions
from public.schools school;

revoke all on table public.intelligence_continuous_os_summary from anon, authenticated;
grant select on table public.intelligence_continuous_os_summary to authenticated;

comment on function public.promote_mis_to_intelligence(uuid, text) is
  'Idempotent, service-only promotion from Wonde staging to canonical pupils/classes. Possible duplicates are queued for human review.';
comment on table public.intelligence_orchestration_runs is
  'Durable execution history for each school continuous-intelligence cycle.';
comment on table public.intelligence_model_governance_checks is
  'Append-only model evidence. Candidate status requests human review and cannot promote a model.';
comment on table public.intelligence_lesson_quality_evaluations is
  'Append-only contract, feedback and descriptive-outcome evidence for generated lesson bundles.';
comment on view public.intelligence_continuous_os_summary is
  'Aggregate Stage 21-26 status for the live teacher operating system, with no pupil-level predictions.';
