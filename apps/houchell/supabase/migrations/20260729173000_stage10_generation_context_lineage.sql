-- =====================================================================
-- School Intelligence Stage 10 — frozen generation context and lineage.
--
-- A generated resource must be reproducible from the reviewed finding,
-- bounded evidence state, curriculum selection and generation contract that
-- existed at that moment. The snapshot is immutable even if the deck changes.
-- =====================================================================

create table public.intelligence_context_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  action_id             uuid not null references public.intelligence_actions(id) on delete restrict,
  finding_id            uuid not null references public.intelligence_findings(id) on delete restrict,
  school_id             uuid not null references public.schools(id) on delete restrict,
  class_id              uuid references public.classes(id) on delete set null,
  objective_id          uuid references public.objectives(id) on delete set null,
  objective_key         text,
  captured_at           timestamptz not null default now(),
  evidence_as_of        timestamptz not null,
  curriculum_context    jsonb not null default '{}'::jsonb,
  evidence_context      jsonb not null default '{}'::jsonb,
  generation_spec       jsonb not null,
  source_model_versions jsonb not null default '{}'::jsonb,
  created_by            uuid not null references public.profiles(id) on delete restrict,
  created_at            timestamptz not null default now(),
  check (objective_id is not null or objective_key is not null)
);

create index intelligence_context_snapshots_action_idx
  on public.intelligence_context_snapshots (action_id, captured_at desc);
create index intelligence_context_snapshots_finding_idx
  on public.intelligence_context_snapshots (finding_id, captured_at desc);

alter table public.intelligence_context_snapshots enable row level security;

create policy intelligence_context_snapshots_scope_read
  on public.intelligence_context_snapshots
  for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

revoke all on table public.intelligence_context_snapshots from anon;
grant select on table public.intelligence_context_snapshots to authenticated;
grant select, insert on table public.intelligence_context_snapshots to service_role;

alter table public.intelligence_artifacts
  add column context_snapshot_id uuid
  references public.intelligence_context_snapshots(id) on delete restrict;

create index intelligence_artifacts_context_snapshot_idx
  on public.intelligence_artifacts (context_snapshot_id)
  where context_snapshot_id is not null;

create trigger intelligence_context_snapshots_no_update_or_delete
  before update or delete on public.intelligence_context_snapshots
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

create or replace function intelligence_private.capture_generation_context_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.intelligence_work_events (
    finding_id,
    action_id,
    actor_id,
    event_type,
    detail
  ) values (
    new.finding_id,
    new.action_id,
    new.created_by,
    'generation_context.captured',
    jsonb_build_object(
      'context_snapshot_id', new.id,
      'evidence_as_of', new.evidence_as_of,
      'generation_spec_version', new.generation_spec -> 'schemaVersion'
    )
  );
  return new;
end;
$$;

create trigger intelligence_context_snapshot_capture_event
  after insert on public.intelligence_context_snapshots
  for each row execute function intelligence_private.capture_generation_context_event();

comment on table public.intelligence_context_snapshots is
  'Immutable aggregate evidence + curriculum + generation contract frozen before a response artifact is generated.';
