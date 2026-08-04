-- =====================================================================
-- School Intelligence Stage 5 — response artifact → delivery → recheck
-- → descriptive outcome.
--
-- Depends on Stage 4 intelligence_findings/actions/events.
-- =====================================================================

create table public.intelligence_artifacts (
  id                    uuid primary key default gen_random_uuid(),
  action_id             uuid not null references public.intelligence_actions(id) on delete restrict,
  finding_id            uuid not null references public.intelligence_findings(id) on delete restrict,
  deck_id               uuid references public.decks(id) on delete set null,
  artifact_type         text not null
    check (artifact_type in ('lesson_deck', 'recheck', 'brief', 'worksheet')),
  artifact_version      integer not null default 1 check (artifact_version > 0),
  status                text not null default 'draft'
    check (status in ('draft', 'reviewed', 'approved', 'retired')),
  generated_by_kind     text not null default 'human'
    check (generated_by_kind in ('human', 'analysis_model', 'lesson_generator')),
  generation_context    jsonb not null default '{}'::jsonb,
  deck_snapshot         jsonb not null default '{}'::jsonb,
  created_by            uuid not null references public.profiles(id) on delete restrict,
  updated_by            uuid not null references public.profiles(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (deck_id, artifact_version)
);

create index intelligence_artifacts_action_idx
  on public.intelligence_artifacts (action_id, created_at desc);
create index intelligence_artifacts_finding_idx
  on public.intelligence_artifacts (finding_id, created_at desc);

create table public.intelligence_deliveries (
  id                    uuid primary key default gen_random_uuid(),
  action_id             uuid not null references public.intelligence_actions(id) on delete restrict,
  artifact_id           uuid not null references public.intelligence_artifacts(id) on delete restrict,
  class_id              uuid not null references public.classes(id) on delete restrict,
  delivered_by          uuid not null references public.profiles(id) on delete restrict,
  delivered_at          timestamptz not null,
  delivery_mode         text not null default 'class_lesson'
    check (delivery_mode in ('class_lesson', 'small_group', 'home_learning', 'staff_briefing')),
  taught_log_id         uuid,
  artifact_snapshot     jsonb not null default '{}'::jsonb,
  idempotency_key       text not null check (length(btrim(idempotency_key)) >= 16),
  notes                 text,
  created_at            timestamptz not null default now()
);

create unique index intelligence_deliveries_idempotency_uq
  on public.intelligence_deliveries (action_id, idempotency_key);
create index intelligence_deliveries_action_idx
  on public.intelligence_deliveries (action_id, delivered_at desc);
create index intelligence_deliveries_class_idx
  on public.intelligence_deliveries (class_id, delivered_at desc);

create table public.intelligence_rechecks (
  id                    uuid primary key default gen_random_uuid(),
  action_id             uuid not null references public.intelligence_actions(id) on delete restrict,
  finding_id            uuid not null references public.intelligence_findings(id) on delete restrict,
  delivery_id           uuid not null references public.intelligence_deliveries(id) on delete restrict,
  objective_id          uuid references public.objectives(id) on delete set null,
  objective_key         text,
  method                text not null default 'retrieval'
    check (method in ('retrieval', 'assessment', 'hinge', 'manual')),
  status                text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'invalid')),
  due_at                timestamptz not null,
  completed_at          timestamptz,
  baseline_snapshot     jsonb not null,
  result_snapshot       jsonb,
  validity_note         text,
  created_by            uuid not null references public.profiles(id) on delete restrict,
  updated_by            uuid not null references public.profiles(id) on delete restrict,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (objective_id is not null or objective_key is not null),
  check (status <> 'completed' or (completed_at is not null and result_snapshot is not null)),
  check (status <> 'invalid' or length(btrim(coalesce(validity_note, ''))) >= 3)
);

create index intelligence_rechecks_due_idx
  on public.intelligence_rechecks (due_at, status)
  where status = 'scheduled';
create index intelligence_rechecks_action_idx
  on public.intelligence_rechecks (action_id, created_at desc);

create table public.intelligence_outcomes (
  id                    uuid primary key default gen_random_uuid(),
  action_id             uuid not null references public.intelligence_actions(id) on delete restrict,
  finding_id            uuid not null references public.intelligence_findings(id) on delete restrict,
  recheck_id            uuid not null unique references public.intelligence_rechecks(id) on delete restrict,
  metric                text not null
    check (metric in ('mastery_pct', 'assessment_pct', 'completion_pct', 'manual_score')),
  baseline_value        numeric not null,
  outcome_value         numeric not null,
  delta                 numeric generated always as (outcome_value - baseline_value) stored,
  sample_size           integer check (sample_size is null or sample_size >= 0),
  outcome_window_days   integer not null check (outcome_window_days >= 0),
  attribution_strength  text not null default 'descriptive'
    check (attribution_strength in ('descriptive', 'comparison_supported', 'experimental')),
  interpretation        text not null,
  evaluated_by          uuid not null references public.profiles(id) on delete restrict,
  evaluated_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  check (baseline_value >= 0 and baseline_value <= 100),
  check (outcome_value >= 0 and outcome_value <= 100)
);

create index intelligence_outcomes_action_idx
  on public.intelligence_outcomes (action_id, evaluated_at desc);
create index intelligence_outcomes_finding_idx
  on public.intelligence_outcomes (finding_id, evaluated_at desc);

-- ---------------------------------------------------------------------
-- RLS inherits the parent finding's permitted purpose/scope.
-- ---------------------------------------------------------------------
alter table public.intelligence_artifacts enable row level security;
alter table public.intelligence_deliveries enable row level security;
alter table public.intelligence_rechecks enable row level security;
alter table public.intelligence_outcomes enable row level security;

create policy intelligence_artifacts_scope_read on public.intelligence_artifacts
  for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

create policy intelligence_deliveries_scope_read on public.intelligence_deliveries
  for select to authenticated
  using (
    exists (
      select 1
      from public.intelligence_actions action
      where action.id = action_id
        and intelligence_private.can_read_intelligence_finding(action.finding_id)
    )
  );

create policy intelligence_rechecks_scope_read on public.intelligence_rechecks
  for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

create policy intelligence_outcomes_scope_read on public.intelligence_outcomes
  for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

revoke all on table
  public.intelligence_artifacts,
  public.intelligence_deliveries,
  public.intelligence_rechecks,
  public.intelligence_outcomes
from anon;

grant select on table
  public.intelligence_artifacts,
  public.intelligence_deliveries,
  public.intelligence_rechecks,
  public.intelligence_outcomes
to authenticated;

grant select, insert, update on table
  public.intelligence_artifacts,
  public.intelligence_rechecks
to service_role;
grant select, insert on table
  public.intelligence_deliveries,
  public.intelligence_outcomes
to service_role;

-- ---------------------------------------------------------------------
-- Every loop transition appends to the Stage 4 work history.
-- ---------------------------------------------------------------------
create or replace function intelligence_private.capture_intelligence_loop_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_finding_id uuid;
  v_action_id uuid;
  v_actor_id uuid;
  v_event_type text;
  v_detail jsonb;
begin
  if tg_table_name = 'intelligence_artifacts' then
    v_finding_id := new.finding_id;
    v_action_id := new.action_id;
    v_actor_id := new.updated_by;
    v_event_type := case when tg_op = 'INSERT' then 'artifact.created' else 'artifact.updated' end;
    v_detail := jsonb_build_object(
      'artifact_id', new.id,
      'deck_id', new.deck_id,
      'status', new.status,
      'version', new.artifact_version
    );
  elsif tg_table_name = 'intelligence_deliveries' then
    select action.finding_id into v_finding_id
    from public.intelligence_actions action
    where action.id = new.action_id;
    v_action_id := new.action_id;
    v_actor_id := new.delivered_by;
    v_event_type := 'delivery.recorded';
    v_detail := jsonb_build_object(
      'delivery_id', new.id,
      'artifact_id', new.artifact_id,
      'class_id', new.class_id,
      'delivered_at', new.delivered_at
    );
  elsif tg_table_name = 'intelligence_rechecks' then
    v_finding_id := new.finding_id;
    v_action_id := new.action_id;
    v_actor_id := new.updated_by;
    v_event_type := case
      when tg_op = 'INSERT' then 'recheck.scheduled'
      when old.status is distinct from new.status and new.status = 'completed' then 'recheck.completed'
      when old.status is distinct from new.status and new.status = 'invalid' then 'recheck.invalidated'
      else 'recheck.updated'
    end;
    v_detail := jsonb_build_object(
      'recheck_id', new.id,
      'status', new.status,
      'due_at', new.due_at,
      'completed_at', new.completed_at
    );
  else
    v_finding_id := new.finding_id;
    v_action_id := new.action_id;
    v_actor_id := new.evaluated_by;
    v_event_type := 'outcome.recorded';
    v_detail := jsonb_build_object(
      'outcome_id', new.id,
      'metric', new.metric,
      'baseline', new.baseline_value,
      'outcome', new.outcome_value,
      'delta', new.delta,
      'attribution_strength', new.attribution_strength
    );
  end if;

  insert into public.intelligence_work_events (
    finding_id, action_id, actor_id, event_type, detail
  ) values (
    v_finding_id, v_action_id, v_actor_id, v_event_type, v_detail
  );
  return new;
end;
$$;

create trigger intelligence_artifacts_capture_event
  after insert or update on public.intelligence_artifacts
  for each row execute function intelligence_private.capture_intelligence_loop_event();

create trigger intelligence_deliveries_capture_event
  after insert on public.intelligence_deliveries
  for each row execute function intelligence_private.capture_intelligence_loop_event();

create trigger intelligence_rechecks_capture_event
  after insert or update on public.intelligence_rechecks
  for each row execute function intelligence_private.capture_intelligence_loop_event();

create trigger intelligence_outcomes_capture_event
  after insert on public.intelligence_outcomes
  for each row execute function intelligence_private.capture_intelligence_loop_event();

create trigger intelligence_artifacts_set_updated_at
  before update on public.intelligence_artifacts
  for each row execute function public.tg_set_updated_at();

create trigger intelligence_rechecks_set_updated_at
  before update on public.intelligence_rechecks
  for each row execute function public.tg_set_updated_at();

create trigger intelligence_artifacts_no_delete
  before delete on public.intelligence_artifacts
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

create trigger intelligence_deliveries_no_delete
  before delete on public.intelligence_deliveries
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

create trigger intelligence_rechecks_no_delete
  before delete on public.intelligence_rechecks
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

create trigger intelligence_outcomes_no_delete
  before delete on public.intelligence_outcomes
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

comment on table public.intelligence_artifacts is
  'Versioned response artifacts linked to the evidence and action that caused them to exist.';
comment on table public.intelligence_deliveries is
  'What was actually delivered, to which class, by whom and with which artifact snapshot.';
comment on table public.intelligence_rechecks is
  'Pre-specified post-delivery measurement with the baseline frozen at scheduling time.';
comment on table public.intelligence_outcomes is
  'Descriptive before/after outcome by default. Stronger attribution requires an explicit design.';
