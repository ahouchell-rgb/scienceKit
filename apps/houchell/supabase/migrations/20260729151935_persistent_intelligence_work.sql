-- =====================================================================
-- School Intelligence Stage 4 — persistent findings, actions and history
--
-- Depends on Stage 2 canonical identity + private scope helpers.
-- Authenticated clients read through RLS. All writes go through the
-- permission-checking server route; no client mutation policy exists.
-- =====================================================================

create table public.intelligence_findings (
  id                 uuid primary key default gen_random_uuid(),
  trust_id           uuid references public.trusts(id) on delete cascade,
  school_id          uuid references public.schools(id) on delete cascade,
  department_id      uuid references public.departments(id) on delete set null,
  class_id           uuid references public.classes(id) on delete set null,
  pupil_id           uuid references public.pupils(id) on delete set null,
  objective_id       uuid references public.objectives(id) on delete set null,
  objective_key      text,
  scope_type         text not null
    check (scope_type in ('trust', 'school', 'department', 'class', 'pupil', 'objective')),
  finding_type       text not null
    check (finding_type in (
      'learning_gap',
      'data_quality',
      'attendance_pattern',
      'behaviour_pattern',
      'curriculum_sequence',
      'equity_gap'
    )),
  headline           text not null check (length(btrim(headline)) between 3 and 240),
  summary            text not null default '',
  source_kind        text not null default 'human'
    check (source_kind in ('human', 'system_rule', 'analysis_model')),
  evidence_snapshot  jsonb not null default '{}'::jsonb,
  evidence_as_of     timestamptz not null default now(),
  evidence_strength  text not null default 'limited'
    check (evidence_strength in ('limited', 'developing', 'strong')),
  status             text not null default 'open'
    check (status in ('open', 'accepted', 'dismissed', 'superseded')),
  raised_by          uuid not null references public.profiles(id) on delete restrict,
  reviewed_by        uuid references public.profiles(id) on delete set null,
  reviewed_at        timestamptz,
  dismissed_reason   text,
  updated_by         uuid not null references public.profiles(id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (trust_id is not null or school_id is not null),
  check (objective_id is not null or objective_key is not null or finding_type <> 'learning_gap'),
  check (status <> 'dismissed' or length(btrim(coalesce(dismissed_reason, ''))) >= 3)
);

create index intelligence_findings_school_status_idx
  on public.intelligence_findings (school_id, status, created_at desc);
create index intelligence_findings_trust_status_idx
  on public.intelligence_findings (trust_id, status, created_at desc);
create index intelligence_findings_class_idx
  on public.intelligence_findings (class_id, created_at desc)
  where class_id is not null;
create index intelligence_findings_objective_idx
  on public.intelligence_findings (objective_id, created_at desc)
  where objective_id is not null;
create index intelligence_findings_raised_by_idx
  on public.intelligence_findings (raised_by, created_at desc);

create table public.intelligence_actions (
  id                         uuid primary key default gen_random_uuid(),
  finding_id                 uuid not null references public.intelligence_findings(id) on delete restrict,
  action_type                text not null
    check (action_type in (
      'review_evidence',
      'reteach',
      'curriculum_change',
      'department_brief',
      'pupil_support',
      'data_repair',
      'monitor'
    )),
  title                      text not null check (length(btrim(title)) between 3 and 240),
  description                text not null default '',
  purpose                    text not null,
  priority                   text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status                     text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'in_progress', 'completed', 'cancelled')),
  owner_id                   uuid references public.profiles(id) on delete set null,
  created_by                 uuid not null references public.profiles(id) on delete restrict,
  proposed_by_kind           text not null default 'human'
    check (proposed_by_kind in ('human', 'system_rule', 'analysis_model')),
  requires_human_acceptance  boolean not null default true,
  accepted_by                uuid references public.profiles(id) on delete set null,
  accepted_at                timestamptz,
  due_at                     timestamptz,
  started_at                 timestamptz,
  completed_at               timestamptz,
  outcome_summary            text,
  updated_by                 uuid not null references public.profiles(id) on delete restrict,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  check (
    status not in ('accepted', 'in_progress', 'completed')
    or requires_human_acceptance = false
    or accepted_by is not null
  ),
  check (status <> 'completed' or completed_at is not null)
);

create index intelligence_actions_owner_status_idx
  on public.intelligence_actions (owner_id, status, due_at);
create index intelligence_actions_finding_idx
  on public.intelligence_actions (finding_id, created_at);
create index intelligence_actions_due_open_idx
  on public.intelligence_actions (due_at, priority)
  where status in ('proposed', 'accepted', 'in_progress');

-- Append-only history for both finding and action state. The evidence snapshot
-- stays on the finding; events explain who changed the work and why.
create table public.intelligence_work_events (
  id          bigint generated always as identity primary key,
  finding_id  uuid not null references public.intelligence_findings(id) on delete restrict,
  action_id   uuid references public.intelligence_actions(id) on delete restrict,
  actor_id    uuid references public.profiles(id) on delete set null,
  event_type  text not null,
  note        text,
  detail      jsonb not null default '{}'::jsonb,
  at          timestamptz not null default now()
);

create index intelligence_work_events_finding_idx
  on public.intelligence_work_events (finding_id, at desc);
create index intelligence_work_events_action_idx
  on public.intelligence_work_events (action_id, at desc)
  where action_id is not null;

-- ---------------------------------------------------------------------
-- Read scope: leadership sees correctly scoped work; teachers see findings
-- for classes they own plus anything they raised or own.
-- ---------------------------------------------------------------------
create or replace function intelligence_private.can_read_intelligence_finding(p_finding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.intelligence_findings finding
    where finding.id = p_finding_id
      and (
        finding.raised_by = auth.uid()
        or (
          finding.school_id is not null
          and intelligence_private.can_manage_school_scope(finding.school_id)
        )
        or (
          finding.trust_id is not null
          and exists (
            select 1
            from public.profiles me
            where me.id = auth.uid()
              and me.trust_role = 'trust_lead'
              and me.trust_id = finding.trust_id
          )
        )
        or (
          finding.class_id is not null
          and exists (
            select 1
            from public.classes class
            where class.id = finding.class_id
              and class.teacher_id = auth.uid()
          )
        )
        or exists (
          select 1
          from public.intelligence_actions action
          where action.finding_id = finding.id
            and action.owner_id = auth.uid()
        )
      )
  );
$$;

revoke all on function intelligence_private.can_read_intelligence_finding(uuid) from public;
grant execute on function intelligence_private.can_read_intelligence_finding(uuid) to authenticated;

alter table public.intelligence_findings enable row level security;
alter table public.intelligence_actions enable row level security;
alter table public.intelligence_work_events enable row level security;

create policy intelligence_findings_scope_read on public.intelligence_findings
  for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(id));

create policy intelligence_actions_scope_read on public.intelligence_actions
  for select to authenticated
  using (
    owner_id = auth.uid()
    or created_by = auth.uid()
    or intelligence_private.can_read_intelligence_finding(finding_id)
  );

create policy intelligence_events_scope_read on public.intelligence_work_events
  for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

revoke all on table
  public.intelligence_findings,
  public.intelligence_actions,
  public.intelligence_work_events
from anon;

grant select on table
  public.intelligence_findings,
  public.intelligence_actions,
  public.intelligence_work_events
to authenticated;

grant select, insert on table
  public.intelligence_findings,
  public.intelligence_work_events
to service_role;
grant select, insert, update on table
  public.intelligence_actions
to service_role;

-- ---------------------------------------------------------------------
-- Immutable, automatic history. The write API stamps updated_by with the
-- human caller even though the database write uses the service role.
-- ---------------------------------------------------------------------
create or replace function intelligence_private.capture_intelligence_work_event()
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
  if tg_table_name = 'intelligence_findings' then
    v_finding_id := new.id;
    v_actor_id := new.updated_by;
    if tg_op = 'INSERT' then
      v_event_type := 'finding.created';
      v_detail := jsonb_build_object(
        'status', new.status,
        'source_kind', new.source_kind,
        'evidence_strength', new.evidence_strength
      );
    else
      v_event_type := 'finding.updated';
      v_detail := jsonb_build_object(
        'status_from', old.status,
        'status_to', new.status,
        'reviewed_by', new.reviewed_by
      );
    end if;
  else
    v_finding_id := new.finding_id;
    v_action_id := new.id;
    v_actor_id := new.updated_by;
    if tg_op = 'INSERT' then
      v_event_type := 'action.created';
      v_detail := jsonb_build_object(
        'status', new.status,
        'owner_id', new.owner_id,
        'proposed_by_kind', new.proposed_by_kind
      );
    else
      v_event_type := case
        when old.status is distinct from new.status then 'action.status_changed'
        when old.owner_id is distinct from new.owner_id then 'action.assigned'
        when old.due_at is distinct from new.due_at then 'action.due_changed'
        else 'action.updated'
      end;
      v_detail := jsonb_build_object(
        'status_from', old.status,
        'status_to', new.status,
        'owner_from', old.owner_id,
        'owner_to', new.owner_id,
        'due_from', old.due_at,
        'due_to', new.due_at
      );
    end if;
  end if;

  insert into public.intelligence_work_events (
    finding_id, action_id, actor_id, event_type, detail
  ) values (
    v_finding_id, v_action_id, v_actor_id, v_event_type, coalesce(v_detail, '{}'::jsonb)
  );

  return new;
end;
$$;

create trigger intelligence_findings_capture_event
  after insert or update on public.intelligence_findings
  for each row execute function intelligence_private.capture_intelligence_work_event();

create trigger intelligence_actions_capture_event
  after insert or update on public.intelligence_actions
  for each row execute function intelligence_private.capture_intelligence_work_event();

create trigger intelligence_findings_set_updated_at
  before update on public.intelligence_findings
  for each row execute function public.tg_set_updated_at();

create trigger intelligence_actions_set_updated_at
  before update on public.intelligence_actions
  for each row execute function public.tg_set_updated_at();

create or replace function intelligence_private.reject_intelligence_hard_delete()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Intelligence work is closed by status; it is never hard-deleted';
end;
$$;

create trigger intelligence_findings_no_delete
  before delete on public.intelligence_findings
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

create trigger intelligence_actions_no_delete
  before delete on public.intelligence_actions
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

create trigger intelligence_events_no_update_or_delete
  before update or delete on public.intelligence_work_events
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

comment on table public.intelligence_findings is
  'Reviewable evidence claims with immutable source snapshots. A model may propose; a human owns the decision.';
comment on table public.intelligence_actions is
  'Owned response work attached to a finding, with explicit acceptance, due date, status and outcome.';
comment on table public.intelligence_work_events is
  'Append-only history of finding and action changes. Trigger-written; never updated or deleted.';
