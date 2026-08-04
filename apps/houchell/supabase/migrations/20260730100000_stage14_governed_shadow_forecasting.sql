-- =====================================================================
-- School Intelligence Stage 14 — governed shadow forecasting.
--
-- This creates a model registry, immutable feature snapshots, bounded
-- next-attempt forecasts, outcome labels and calibration evaluations.
-- Forecasts are structurally shadow-only: they cannot trigger a pupil action
-- and no universal risk score exists in this contract.
-- =====================================================================

create table public.intelligence_model_versions (
  id                      uuid primary key default gen_random_uuid(),
  model_key               text not null check (length(btrim(model_key)) between 3 and 120),
  version                 integer not null check (version > 0),
  target_kind             text not null
    check (target_kind in (
      'next_attempt_correct',
      'objective_secure',
      'next_assessment_score',
      'class_objective_mastery',
      'cohort_event_volume'
    )),
  method                   text not null,
  feature_schema_version  integer not null check (feature_schema_version > 0),
  label_definition        jsonb not null,
  feature_definition      jsonb not null,
  training_cutoff         timestamptz,
  status                   text not null default 'draft'
    check (status in ('draft', 'shadow', 'validated', 'retired')),
  baseline_model_key       text,
  evaluation_metrics       jsonb not null default '{}'::jsonb,
  known_limitations        jsonb not null default '[]'::jsonb
    check (jsonb_typeof(known_limitations) = 'array'),
  review_due_at            timestamptz not null,
  approved_by              uuid references public.profiles(id) on delete set null,
  approved_at              timestamptz,
  created_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (model_key, version),
  check (
    status <> 'validated'
    or (approved_by is not null and approved_at is not null)
  )
);

create index intelligence_model_versions_target_status_idx
  on public.intelligence_model_versions (target_kind, status, version desc);
create index intelligence_model_versions_approver_idx
  on public.intelligence_model_versions (approved_by)
  where approved_by is not null;

create table public.intelligence_forecast_runs (
  id                      uuid primary key default gen_random_uuid(),
  school_id               uuid not null references public.schools(id) on delete restrict,
  model_version_id        uuid not null references public.intelligence_model_versions(id) on delete restrict,
  run_key                 text not null check (length(btrim(run_key)) between 8 and 220),
  target_kind             text not null
    check (target_kind = 'next_attempt_correct'),
  intended_use            text not null
    check (intended_use = 'shadow_evaluation'),
  horizon_kind            text not null
    check (horizon_kind = 'next_comparable_attempt'),
  status                  text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  as_of                   timestamptz not null,
  expires_at              timestamptz not null,
  max_items               integer not null check (max_items between 1 and 5000),
  eligible_scopes         integer not null default 0 check (eligible_scopes >= 0),
  forecast_count          integer not null default 0 check (forecast_count >= 0),
  outcome_count           integer not null default 0 check (outcome_count >= 0),
  truncated               boolean not null default false,
  configuration           jsonb not null default '{}'::jsonb,
  provenance              jsonb not null default '{}'::jsonb,
  requested_by            uuid not null references public.profiles(id) on delete restrict,
  started_at              timestamptz,
  completed_at            timestamptz,
  error_summary           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (school_id, run_key),
  check (expires_at > as_of),
  check (
    status in ('queued', 'running')
    or completed_at is not null
  )
);

create index intelligence_forecast_runs_school_time_idx
  on public.intelligence_forecast_runs (school_id, as_of desc);
create index intelligence_forecast_runs_model_status_idx
  on public.intelligence_forecast_runs (model_version_id, status, as_of desc);
create index intelligence_forecast_runs_requester_idx
  on public.intelligence_forecast_runs (requested_by, created_at desc);

create table public.intelligence_feature_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  run_id                  uuid not null references public.intelligence_forecast_runs(id) on delete restrict,
  school_id               uuid not null references public.schools(id) on delete restrict,
  pupil_id                uuid not null references public.pupils(id) on delete restrict,
  objective_id            uuid references public.objectives(id) on delete set null,
  objective_key           text not null,
  scope_key               text not null,
  as_of                   timestamptz not null,
  feature_schema_version  integer not null check (feature_schema_version > 0),
  features                jsonb not null,
  missingness             jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missingness) = 'array'),
  evidence_count          integer not null check (evidence_count >= 0),
  last_evidence_at        timestamptz not null,
  source_mix              jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_mix) = 'array'),
  content_fingerprint     text not null,
  created_at              timestamptz not null default now(),
  unique (run_id, scope_key),
  check (last_evidence_at <= as_of)
);

create index intelligence_feature_snapshots_run_idx
  on public.intelligence_feature_snapshots (run_id, created_at);
create index intelligence_feature_snapshots_school_scope_idx
  on public.intelligence_feature_snapshots
  (school_id, pupil_id, objective_id, as_of desc);
create index intelligence_feature_snapshots_pupil_idx
  on public.intelligence_feature_snapshots (pupil_id, as_of desc);
create index intelligence_feature_snapshots_objective_idx
  on public.intelligence_feature_snapshots (objective_id, as_of desc)
  where objective_id is not null;

create table public.intelligence_forecasts (
  id                      uuid primary key default gen_random_uuid(),
  run_id                  uuid not null references public.intelligence_forecast_runs(id) on delete restrict,
  model_version_id        uuid not null references public.intelligence_model_versions(id) on delete restrict,
  feature_snapshot_id     uuid not null unique references public.intelligence_feature_snapshots(id) on delete restrict,
  school_id               uuid not null references public.schools(id) on delete restrict,
  pupil_id                uuid not null references public.pupils(id) on delete restrict,
  objective_id            uuid references public.objectives(id) on delete set null,
  objective_key           text not null,
  target_kind             text not null check (target_kind = 'next_attempt_correct'),
  intended_use            text not null check (intended_use = 'shadow_evaluation'),
  horizon_kind            text not null check (horizon_kind = 'next_comparable_attempt'),
  as_of                   timestamptz not null,
  valid_from              timestamptz not null,
  expires_at              timestamptz not null,
  prediction              numeric(8,7) not null check (prediction between 0 and 1),
  lower_bound             numeric(8,7) not null check (lower_bound between 0 and 1),
  upper_bound             numeric(8,7) not null check (upper_bound between 0 and 1),
  baseline_prediction     numeric(8,7) not null check (baseline_prediction between 0 and 1),
  confidence_band         text not null
    check (confidence_band in ('limited', 'developing', 'established')),
  evidence_count          integer not null check (evidence_count >= 0),
  missingness             jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missingness) = 'array'),
  release_status          text not null default 'shadow_only'
    check (release_status = 'shadow_only'),
  model_snapshot          jsonb not null,
  provenance              jsonb not null default '{}'::jsonb,
  generated_at            timestamptz not null default now(),
  unique (run_id, pupil_id, objective_key),
  check (valid_from >= as_of),
  check (expires_at > valid_from),
  check (lower_bound <= prediction and prediction <= upper_bound)
);

create index intelligence_forecasts_run_idx
  on public.intelligence_forecasts (run_id, generated_at);
create index intelligence_forecasts_model_idx
  on public.intelligence_forecasts (model_version_id, as_of desc);
create index intelligence_forecasts_school_expiry_idx
  on public.intelligence_forecasts (school_id, release_status, expires_at);
create index intelligence_forecasts_scope_time_idx
  on public.intelligence_forecasts
  (pupil_id, objective_id, as_of desc);
create index intelligence_forecasts_objective_idx
  on public.intelligence_forecasts
  (school_id, objective_id, as_of desc)
  where objective_id is not null;

create table public.intelligence_forecast_outcomes (
  id                      uuid primary key default gen_random_uuid(),
  forecast_id             uuid not null unique references public.intelligence_forecasts(id) on delete restrict,
  run_id                  uuid not null references public.intelligence_forecast_runs(id) on delete restrict,
  school_id               uuid not null references public.schools(id) on delete restrict,
  source_event_id         uuid not null references public.education_events(id) on delete restrict,
  label_version           integer not null default 1 check (label_version > 0),
  actual_value            numeric(3,2) not null check (actual_value in (0, 1)),
  observed_at             timestamptz not null,
  brier_score             numeric(10,9) not null check (brier_score between 0 and 1),
  baseline_brier_score    numeric(10,9) not null check (baseline_brier_score between 0 and 1),
  label_provenance        jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now()
);

create index intelligence_forecast_outcomes_run_idx
  on public.intelligence_forecast_outcomes (run_id, observed_at);
create index intelligence_forecast_outcomes_school_time_idx
  on public.intelligence_forecast_outcomes (school_id, observed_at desc);
create index intelligence_forecast_outcomes_source_event_idx
  on public.intelligence_forecast_outcomes (source_event_id);

create table public.intelligence_model_evaluations (
  id                          uuid primary key default gen_random_uuid(),
  run_id                      uuid not null references public.intelligence_forecast_runs(id) on delete restrict,
  model_version_id            uuid not null references public.intelligence_model_versions(id) on delete restrict,
  school_id                   uuid not null references public.schools(id) on delete restrict,
  evaluation_kind             text not null check (evaluation_kind = 'temporal_shadow'),
  window_start                timestamptz not null,
  window_end                  timestamptz not null,
  sample_size                 integer not null check (sample_size >= 0),
  brier_score                 numeric(10,9) check (brier_score between 0 and 1),
  baseline_brier_score        numeric(10,9) check (baseline_brier_score between 0 and 1),
  brier_skill_score           numeric(12,9),
  expected_calibration_error  numeric(10,9)
    check (expected_calibration_error between 0 and 1),
  interval_coverage           numeric(10,9)
    check (interval_coverage between 0 and 1),
  evaluation_status           text not null
    check (evaluation_status in (
      'insufficient_data', 'candidate_better', 'baseline_better', 'inconclusive'
    )),
  calibration_bins            jsonb not null default '[]'::jsonb
    check (jsonb_typeof(calibration_bins) = 'array'),
  subgroup_audit              jsonb not null default '{}'::jsonb,
  limitations                 jsonb not null default '[]'::jsonb
    check (jsonb_typeof(limitations) = 'array'),
  evaluated_by_kind           text not null default 'system'
    check (evaluated_by_kind in ('system', 'analyst')),
  evaluated_by                uuid references public.profiles(id) on delete set null,
  evaluated_at                timestamptz not null default now(),
  created_at                  timestamptz not null default now(),
  check (window_end >= window_start)
);

create index intelligence_model_evaluations_run_time_idx
  on public.intelligence_model_evaluations (run_id, evaluated_at desc);
create index intelligence_model_evaluations_model_time_idx
  on public.intelligence_model_evaluations
  (model_version_id, evaluated_at desc);
create index intelligence_model_evaluations_school_time_idx
  on public.intelligence_model_evaluations (school_id, evaluated_at desc);
create index intelligence_model_evaluations_evaluator_idx
  on public.intelligence_model_evaluations (evaluated_by, evaluated_at desc)
  where evaluated_by is not null;

create table public.intelligence_forecast_reviews (
  id                      uuid primary key default gen_random_uuid(),
  forecast_id             uuid not null references public.intelligence_forecasts(id) on delete restrict,
  school_id               uuid not null references public.schools(id) on delete restrict,
  response_kind           text not null
    check (response_kind in ('noted', 'useful', 'misleading', 'contested')),
  reason                  text,
  decision_taken          boolean not null default false
    check (decision_taken = false),
  reviewed_by             uuid not null references public.profiles(id) on delete restrict,
  created_at              timestamptz not null default now(),
  check (
    response_kind not in ('misleading', 'contested')
    or length(btrim(coalesce(reason, ''))) >= 3
  )
);

create index intelligence_forecast_reviews_forecast_idx
  on public.intelligence_forecast_reviews (forecast_id, created_at desc);
create index intelligence_forecast_reviews_school_time_idx
  on public.intelligence_forecast_reviews (school_id, created_at desc);
create index intelligence_forecast_reviews_reviewer_idx
  on public.intelligence_forecast_reviews (reviewed_by, created_at desc);

create table public.intelligence_forecast_events (
  id                      uuid primary key default gen_random_uuid(),
  school_id               uuid not null references public.schools(id) on delete restrict,
  run_id                  uuid references public.intelligence_forecast_runs(id) on delete restrict,
  model_version_id        uuid references public.intelligence_model_versions(id) on delete restrict,
  event_type              text not null
    check (event_type in (
      'run.started', 'run.completed', 'run.failed',
      'outcomes.scored', 'evaluation.recorded',
      'model.promoted', 'model.retired', 'forecast.contested'
    )),
  actor_kind              text not null check (actor_kind in ('staff', 'system')),
  actor_id                uuid references public.profiles(id) on delete set null,
  detail                  jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now()
);

create index intelligence_forecast_events_school_time_idx
  on public.intelligence_forecast_events (school_id, created_at desc);
create index intelligence_forecast_events_run_time_idx
  on public.intelligence_forecast_events (run_id, created_at desc)
  where run_id is not null;
create index intelligence_forecast_events_model_time_idx
  on public.intelligence_forecast_events (model_version_id, created_at desc)
  where model_version_id is not null;
create index intelligence_forecast_events_actor_idx
  on public.intelligence_forecast_events (actor_id, created_at desc)
  where actor_id is not null;

-- Service-role writes still have to preserve tenant and lineage identity.
-- These checks prevent a privileged application bug from connecting a feature,
-- forecast, label or review to a row from another school or run.
create or replace function intelligence_private.validate_forecast_lineage()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run record;
  v_snapshot record;
  v_forecast record;
  v_event record;
begin
  if tg_table_name = 'intelligence_feature_snapshots' then
    select run.school_id, run.as_of
    into v_run
    from public.intelligence_forecast_runs run
    where run.id = new.run_id;

    if v_run.school_id is distinct from new.school_id
      or v_run.as_of is distinct from new.as_of
    then
      raise exception 'feature snapshot crosses run or school scope'
        using errcode = '23514';
    end if;

  elsif tg_table_name = 'intelligence_forecasts' then
    select run.school_id, run.model_version_id, run.as_of, run.expires_at
    into v_run
    from public.intelligence_forecast_runs run
    where run.id = new.run_id;

    select
      snapshot.run_id,
      snapshot.school_id,
      snapshot.pupil_id,
      snapshot.objective_id,
      snapshot.objective_key,
      snapshot.as_of
    into v_snapshot
    from public.intelligence_feature_snapshots snapshot
    where snapshot.id = new.feature_snapshot_id;

    if v_run.school_id is distinct from new.school_id
      or v_run.model_version_id is distinct from new.model_version_id
      or v_run.as_of is distinct from new.as_of
      or new.expires_at > v_run.expires_at
      or v_snapshot.run_id is distinct from new.run_id
      or v_snapshot.school_id is distinct from new.school_id
      or v_snapshot.pupil_id is distinct from new.pupil_id
      or v_snapshot.objective_id is distinct from new.objective_id
      or v_snapshot.objective_key is distinct from new.objective_key
      or v_snapshot.as_of is distinct from new.as_of
    then
      raise exception 'forecast crosses model, run, feature or school scope'
        using errcode = '23514';
    end if;

  elsif tg_table_name = 'intelligence_forecast_outcomes' then
    select
      forecast.run_id,
      forecast.school_id,
      forecast.pupil_id,
      forecast.objective_id,
      forecast.objective_key,
      forecast.as_of,
      forecast.expires_at
    into v_forecast
    from public.intelligence_forecasts forecast
    where forecast.id = new.forecast_id;

    select
      event.school_id,
      event.pupil_id,
      event.objective_id,
      event.objective_key,
      event.occurred_at,
      event.event_type
    into v_event
    from public.education_events event
    where event.id = new.source_event_id;

    if v_forecast.run_id is distinct from new.run_id
      or v_forecast.school_id is distinct from new.school_id
      or v_event.school_id is distinct from new.school_id
      or v_event.pupil_id is distinct from v_forecast.pupil_id
      or v_event.event_type is distinct from 'question_answered'
      or v_event.occurred_at is distinct from new.observed_at
      or v_event.occurred_at <= v_forecast.as_of
      or v_event.occurred_at > v_forecast.expires_at
      or (
        v_forecast.objective_id is not null
        and v_event.objective_id is distinct from v_forecast.objective_id
      )
      or (
        v_forecast.objective_id is null
        and v_event.objective_key is distinct from v_forecast.objective_key
      )
    then
      raise exception 'forecast outcome crosses forecast, event or school scope'
        using errcode = '23514';
    end if;

  elsif tg_table_name = 'intelligence_model_evaluations' then
    select run.school_id, run.model_version_id
    into v_run
    from public.intelligence_forecast_runs run
    where run.id = new.run_id;

    if v_run.school_id is distinct from new.school_id
      or v_run.model_version_id is distinct from new.model_version_id
    then
      raise exception 'model evaluation crosses run, model or school scope'
        using errcode = '23514';
    end if;

  elsif tg_table_name = 'intelligence_forecast_reviews' then
    select forecast.school_id
    into v_forecast
    from public.intelligence_forecasts forecast
    where forecast.id = new.forecast_id;

    if v_forecast.school_id is distinct from new.school_id then
      raise exception 'forecast review crosses school scope'
        using errcode = '23514';
    end if;

  elsif tg_table_name = 'intelligence_forecast_events' and new.run_id is not null then
    select run.school_id, run.model_version_id
    into v_run
    from public.intelligence_forecast_runs run
    where run.id = new.run_id;

    if v_run.school_id is distinct from new.school_id
      or (
        new.model_version_id is not null
        and v_run.model_version_id is distinct from new.model_version_id
      )
    then
      raise exception 'forecast event crosses run, model or school scope'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function intelligence_private.validate_forecast_lineage()
  from public, anon, authenticated, service_role;

create trigger intelligence_feature_snapshots_validate_lineage
  before insert on public.intelligence_feature_snapshots
  for each row execute function intelligence_private.validate_forecast_lineage();
create trigger intelligence_forecasts_validate_lineage
  before insert on public.intelligence_forecasts
  for each row execute function intelligence_private.validate_forecast_lineage();
create trigger intelligence_forecast_outcomes_validate_lineage
  before insert on public.intelligence_forecast_outcomes
  for each row execute function intelligence_private.validate_forecast_lineage();
create trigger intelligence_model_evaluations_validate_lineage
  before insert on public.intelligence_model_evaluations
  for each row execute function intelligence_private.validate_forecast_lineage();
create trigger intelligence_forecast_reviews_validate_lineage
  before insert on public.intelligence_forecast_reviews
  for each row execute function intelligence_private.validate_forecast_lineage();
create trigger intelligence_forecast_events_validate_lineage
  before insert on public.intelligence_forecast_events
  for each row execute function intelligence_private.validate_forecast_lineage();

alter table public.intelligence_model_versions enable row level security;
alter table public.intelligence_forecast_runs enable row level security;
alter table public.intelligence_feature_snapshots enable row level security;
alter table public.intelligence_forecasts enable row level security;
alter table public.intelligence_forecast_outcomes enable row level security;
alter table public.intelligence_model_evaluations enable row level security;
alter table public.intelligence_forecast_reviews enable row level security;
alter table public.intelligence_forecast_events enable row level security;

create policy intelligence_model_versions_authenticated_read
  on public.intelligence_model_versions for select to authenticated
  using (true);
create policy intelligence_forecast_runs_leadership_read
  on public.intelligence_forecast_runs for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_feature_snapshots_leadership_read
  on public.intelligence_feature_snapshots for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_forecasts_leadership_read
  on public.intelligence_forecasts for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_forecast_outcomes_leadership_read
  on public.intelligence_forecast_outcomes for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_model_evaluations_leadership_read
  on public.intelligence_model_evaluations for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_forecast_reviews_leadership_read
  on public.intelligence_forecast_reviews for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));
create policy intelligence_forecast_events_leadership_read
  on public.intelligence_forecast_events for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));

revoke all on table
  public.intelligence_model_versions,
  public.intelligence_forecast_runs,
  public.intelligence_feature_snapshots,
  public.intelligence_forecasts,
  public.intelligence_forecast_outcomes,
  public.intelligence_model_evaluations,
  public.intelligence_forecast_reviews,
  public.intelligence_forecast_events
from anon, authenticated;

grant select on table
  public.intelligence_model_versions,
  public.intelligence_forecast_runs,
  public.intelligence_feature_snapshots,
  public.intelligence_forecasts,
  public.intelligence_forecast_outcomes,
  public.intelligence_model_evaluations,
  public.intelligence_forecast_reviews,
  public.intelligence_forecast_events
to authenticated;

grant select, insert, update on table
  public.intelligence_model_versions,
  public.intelligence_forecast_runs
to service_role;
grant select, insert on table
  public.intelligence_feature_snapshots,
  public.intelligence_forecasts,
  public.intelligence_forecast_outcomes,
  public.intelligence_model_evaluations,
  public.intelligence_forecast_reviews,
  public.intelligence_forecast_events
to service_role;

create trigger intelligence_model_versions_set_updated_at
  before update on public.intelligence_model_versions
  for each row execute function public.tg_set_updated_at();
create trigger intelligence_forecast_runs_set_updated_at
  before update on public.intelligence_forecast_runs
  for each row execute function public.tg_set_updated_at();

create trigger intelligence_feature_snapshots_no_update_or_delete
  before update or delete on public.intelligence_feature_snapshots
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_forecasts_no_update_or_delete
  before update or delete on public.intelligence_forecasts
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_forecast_outcomes_no_update_or_delete
  before update or delete on public.intelligence_forecast_outcomes
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_model_evaluations_no_update_or_delete
  before update or delete on public.intelligence_model_evaluations
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_forecast_reviews_no_update_or_delete
  before update or delete on public.intelligence_forecast_reviews
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger intelligence_forecast_events_no_update_or_delete
  before update or delete on public.intelligence_forecast_events
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

insert into public.intelligence_model_versions (
  model_key,
  version,
  target_kind,
  method,
  feature_schema_version,
  label_definition,
  feature_definition,
  status,
  baseline_model_key,
  known_limitations,
  review_due_at
) values (
  'next_attempt_beta_bernoulli',
  1,
  'next_attempt_correct',
  'Transparent Beta-Bernoulli posterior from reconciled objective attempts',
  1,
  jsonb_build_object(
    'eventType', 'question_answered',
    'label', 'isCorrect',
    'comparison', 'first comparable objective attempt after forecast as_of',
    'horizon', 'next attempt or 42 days, whichever comes first'
  ),
  jsonb_build_object(
    'included', jsonb_build_array(
      'posterior_alpha',
      'posterior_beta',
      'evidence_count',
      'evidence_age_days',
      'peer_objective_baseline'
    ),
    'excluded', jsonb_build_array(
      'name',
      'ethnicity',
      'sex',
      'send',
      'health',
      'fsm',
      'behaviour',
      'attendance',
      'teacher_identity'
    )
  ),
  'shadow',
  'school_objective_peer_rate',
  jsonb_build_array(
    'This is a transparent baseline, not a validated production model.',
    'Question difficulty, guessing, slips and forgetting are not represented.',
    'The next observed attempt may not be instructionally comparable.',
    'Sparse and stale objective histories are excluded.',
    'Outputs must not determine grouping, intervention, sanctions, grades or access.'
  ),
  now() + interval '180 days'
)
on conflict (model_key, version) do nothing;

comment on table public.intelligence_model_versions is
  'Versioned model contracts with labels, features, limitations, review dates and explicit lifecycle state.';
comment on table public.intelligence_forecasts is
  'Immutable, expiring, shadow-only next-attempt probabilities. This table contains no generic pupil risk score.';
comment on table public.intelligence_model_evaluations is
  'Append-only temporal shadow evaluations against the named simple baseline; no model auto-promotion.';
comment on column public.intelligence_forecast_reviews.decision_taken is
  'Stage 14 enforces false: shadow forecasts cannot drive a pupil decision.';
