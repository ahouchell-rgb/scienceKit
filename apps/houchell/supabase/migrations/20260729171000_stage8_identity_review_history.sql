-- =====================================================================
-- School Intelligence Stage 8 — governed identity reconciliation.
--
-- Stage 2 created the canonical identity and review queue. This migration
-- adds an immutable decision history so every link/create/dismiss action can
-- be reconstructed without relying on mutable queue state.
-- =====================================================================

create table public.pupil_identity_review_events (
  id                bigint generated always as identity primary key,
  review_id         uuid not null references public.pupil_identity_review_queue(id) on delete restrict,
  school_id         uuid not null references public.schools(id) on delete restrict,
  actor_id          uuid references public.profiles(id) on delete set null,
  event_type        text not null
    check (event_type in ('seeded', 'linked', 'created', 'dismissed', 'reopened')),
  pupil_id          uuid references public.pupils(id) on delete set null,
  rationale         text,
  evidence          jsonb not null default '{}'::jsonb,
  at                timestamptz not null default now()
);

create index pupil_identity_review_events_review_idx
  on public.pupil_identity_review_events (review_id, at desc);
create index pupil_identity_review_events_school_idx
  on public.pupil_identity_review_events (school_id, at desc);

alter table public.pupil_identity_review_events enable row level security;

create policy pupil_identity_review_events_leadership_read
  on public.pupil_identity_review_events
  for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));

revoke all on table public.pupil_identity_review_events from anon;
grant select on table public.pupil_identity_review_events to authenticated;
grant select, insert on table public.pupil_identity_review_events to service_role;

create trigger pupil_identity_review_events_no_update_or_delete
  before update or delete on public.pupil_identity_review_events
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

comment on table public.pupil_identity_review_events is
  'Append-only human decision history for canonical pupil identity reconciliation.';
