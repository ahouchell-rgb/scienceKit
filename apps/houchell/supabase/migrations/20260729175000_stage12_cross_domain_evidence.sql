-- =====================================================================
-- School Intelligence Stage 12 — attendance/literacy evidence ingest and
-- cross-domain constraint hypotheses.
--
-- These domains remain observations with provenance. The read model exposes
-- co-occurrence and coverage; it does not create a universal pupil risk score
-- or label a correlation as a root cause.
-- =====================================================================

create table public.intelligence_ingest_runs (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete restrict,
  domain              text not null check (domain in ('attendance', 'literacy')),
  source_system       text not null,
  source_tenant_key   text not null default '',
  file_fingerprint    text not null,
  status              text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  submitted_rows      integer not null default 0 check (submitted_rows >= 0),
  accepted_rows       integer not null default 0 check (accepted_rows >= 0),
  rejected_rows       integer not null default 0 check (rejected_rows >= 0),
  unresolved_rows     integer not null default 0 check (unresolved_rows >= 0),
  duplicate_rows      integer not null default 0 check (duplicate_rows >= 0),
  summary             jsonb not null default '{}'::jsonb,
  created_by          uuid not null references public.profiles(id) on delete restrict,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index intelligence_ingest_runs_school_time_idx
  on public.intelligence_ingest_runs (school_id, started_at desc);
create unique index intelligence_ingest_runs_file_uq
  on public.intelligence_ingest_runs (school_id, domain, source_system, source_tenant_key, file_fingerprint)
  where status = 'completed';

create table public.attendance_sessions (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete restrict,
  pupil_id            uuid not null references public.pupils(id) on delete restrict,
  session_date        date not null,
  session_kind        text not null default 'full_day'
    check (session_kind in ('morning', 'afternoon', 'lesson', 'full_day')),
  attendance_code     text,
  present             boolean not null,
  minutes_late        integer not null default 0 check (minutes_late between 0 and 1440),
  source_system       text not null,
  source_tenant_key   text not null default '',
  source_record_id    text not null,
  ingest_run_id       uuid not null references public.intelligence_ingest_runs(id) on delete restrict,
  provenance          jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (school_id, source_system, source_tenant_key, source_record_id)
);

create index attendance_sessions_pupil_date_idx
  on public.attendance_sessions (pupil_id, session_date desc);
create index attendance_sessions_school_date_idx
  on public.attendance_sessions (school_id, session_date desc);

create table public.literacy_screens (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete restrict,
  pupil_id            uuid not null references public.pupils(id) on delete restrict,
  assessed_at         timestamptz not null,
  measure             text not null
    check (measure in (
      'reading_age_months',
      'reading_standardised_score',
      'reading_fluency_wpm',
      'reading_comprehension_pct',
      'spelling_standardised_score',
      'custom'
    )),
  value               numeric not null,
  scale               text,
  assessment_name     text,
  source_system       text not null,
  source_tenant_key   text not null default '',
  source_record_id    text not null,
  ingest_run_id       uuid not null references public.intelligence_ingest_runs(id) on delete restrict,
  provenance          jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (school_id, source_system, source_tenant_key, source_record_id)
);

create index literacy_screens_pupil_time_idx
  on public.literacy_screens (pupil_id, assessed_at desc);
create index literacy_screens_school_measure_time_idx
  on public.literacy_screens (school_id, measure, assessed_at desc);

alter table public.intelligence_ingest_runs enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.literacy_screens enable row level security;

create policy intelligence_ingest_runs_leadership_read
  on public.intelligence_ingest_runs
  for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));

create policy attendance_sessions_purpose_read
  on public.attendance_sessions
  for select to authenticated
  using (intelligence_private.can_read_canonical_pupil(pupil_id));

create policy literacy_screens_purpose_read
  on public.literacy_screens
  for select to authenticated
  using (intelligence_private.can_read_canonical_pupil(pupil_id));

revoke all on table
  public.intelligence_ingest_runs,
  public.attendance_sessions,
  public.literacy_screens
from anon;
grant select on table
  public.intelligence_ingest_runs,
  public.attendance_sessions,
  public.literacy_screens
to authenticated;

grant select, insert, update on table
  public.intelligence_ingest_runs
to service_role;
grant select, insert on table
  public.attendance_sessions,
  public.literacy_screens
to service_role;

create trigger intelligence_ingest_runs_no_delete
  before delete on public.intelligence_ingest_runs
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger attendance_sessions_no_update_or_delete
  before update or delete on public.attendance_sessions
  for each row execute function intelligence_private.reject_intelligence_hard_delete();
create trigger literacy_screens_no_update_or_delete
  before update or delete on public.literacy_screens
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

-- Mirror accepted observations into the immutable shared event ledger.
create or replace function intelligence_private.capture_cross_domain_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_trust_id uuid;
begin
  select school.trust_id into v_trust_id
  from public.schools school
  where school.id = new.school_id;

  if tg_table_name = 'attendance_sessions' then
    insert into public.education_events (
      trust_id,
      school_id,
      pupil_id,
      event_type,
      occurred_at,
      actor_kind,
      source_system,
      source_tenant_key,
      source_event_id,
      sensitivity,
      payload,
      provenance
    ) values (
      v_trust_id,
      new.school_id,
      new.pupil_id,
      'attendance_session',
      new.session_date::timestamptz,
      'external_source',
      new.source_system || ':attendance',
      new.source_tenant_key,
      new.source_record_id,
      'personal',
      jsonb_build_object(
        'present', new.present,
        'attendanceCode', new.attendance_code,
        'sessionKind', new.session_kind,
        'minutesLate', new.minutes_late
      ),
      new.provenance || jsonb_build_object(
        'sourceTable', 'attendance_sessions',
        'ingestRunId', new.ingest_run_id
      )
    )
    on conflict (school_id, source_system, source_tenant_key, source_event_id)
    do nothing;
  else
    insert into public.education_events (
      trust_id,
      school_id,
      pupil_id,
      event_type,
      occurred_at,
      actor_kind,
      source_system,
      source_tenant_key,
      source_event_id,
      sensitivity,
      payload,
      provenance
    ) values (
      v_trust_id,
      new.school_id,
      new.pupil_id,
      'literacy_screen',
      new.assessed_at,
      'external_source',
      new.source_system || ':literacy',
      new.source_tenant_key,
      new.source_record_id,
      'personal',
      jsonb_build_object(
        'measure', new.measure,
        'value', new.value,
        'scale', new.scale,
        'assessmentName', new.assessment_name
      ),
      new.provenance || jsonb_build_object(
        'sourceTable', 'literacy_screens',
        'ingestRunId', new.ingest_run_id
      )
    )
    on conflict (school_id, source_system, source_tenant_key, source_event_id)
    do nothing;
  end if;
  return new;
end;
$$;

create trigger attendance_sessions_capture_event
  after insert on public.attendance_sessions
  for each row execute function intelligence_private.capture_cross_domain_event();
create trigger literacy_screens_capture_event
  after insert on public.literacy_screens
  for each row execute function intelligence_private.capture_cross_domain_event();

create view public.pupil_cross_domain_state
with (security_invoker = true)
as
with attendance_28 as (
  select
    attendance.school_id,
    attendance.pupil_id,
    round(100.0 * count(*) filter (where attendance.present) / nullif(count(*), 0), 1)
      as attendance_rate,
    count(*)::integer as attendance_sessions,
    max(attendance.session_date) as attendance_as_of
  from public.attendance_sessions attendance
  where attendance.session_date >= current_date - 27
  group by attendance.school_id, attendance.pupil_id
),
literacy_latest as (
  select distinct on (screen.school_id, screen.pupil_id)
    screen.school_id,
    screen.pupil_id,
    screen.measure as literacy_measure,
    screen.value as literacy_value,
    screen.assessed_at as literacy_as_of
  from public.literacy_screens screen
  where screen.measure = 'reading_standardised_score'
  order by screen.school_id, screen.pupil_id, screen.assessed_at desc
),
learning as (
  select
    state.school_id,
    state.pupil_id,
    round(
      sum(state.mastery_estimate * state.evidence_count)
      / nullif(sum(state.evidence_count), 0),
      1
    ) as learning_mastery,
    sum(state.evidence_count)::integer as learning_evidence,
    max(state.last_evidence_at) as learning_as_of
  from public.pupil_learning_state state
  group by state.school_id, state.pupil_id
)
select
  pupil.school_id,
  pupil.id as pupil_id,
  learning.learning_mastery,
  learning.learning_evidence,
  learning.learning_as_of,
  attendance.attendance_rate,
  attendance.attendance_sessions,
  attendance.attendance_as_of,
  literacy.literacy_measure,
  literacy.literacy_value,
  literacy.literacy_as_of
from public.pupils pupil
left join learning on learning.pupil_id = pupil.id and learning.school_id = pupil.school_id
left join attendance_28 attendance on attendance.pupil_id = pupil.id and attendance.school_id = pupil.school_id
left join literacy_latest literacy on literacy.pupil_id = pupil.id and literacy.school_id = pupil.school_id
where pupil.status = 'active';

create view public.class_cross_domain_state
with (security_invoker = true)
as
select
  membership.school_id,
  membership.class_id,
  class.name as class_name,
  class.year_group,
  count(distinct membership.pupil_id)::integer as pupil_count,
  round(avg(state.learning_mastery), 1) as learning_mastery,
  sum(coalesce(state.learning_evidence, 0))::integer as learning_evidence,
  max(state.learning_as_of) as learning_as_of,
  round(avg(state.attendance_rate), 1) as attendance_rate,
  sum(coalesce(state.attendance_sessions, 0))::integer as attendance_sessions,
  max(state.attendance_as_of) as attendance_as_of,
  max(state.literacy_measure) as literacy_measure,
  round(avg(state.literacy_value), 1) as literacy_value,
  count(*) filter (where state.literacy_value is not null)::integer as literacy_pupils,
  max(state.literacy_as_of) as literacy_as_of
from public.pupil_class_memberships membership
join public.classes class on class.id = membership.class_id
left join public.pupil_cross_domain_state state
  on state.pupil_id = membership.pupil_id
 and state.school_id = membership.school_id
where membership.valid_from <= current_date
  and (membership.valid_to is null or membership.valid_to >= current_date)
group by membership.school_id, membership.class_id, class.name, class.year_group;

revoke all on table
  public.pupil_cross_domain_state,
  public.class_cross_domain_state
from anon;
grant select on table
  public.pupil_cross_domain_state,
  public.class_cross_domain_state
to authenticated;

comment on view public.class_cross_domain_state is
  'Class-level co-occurring learning, attendance exposure and literacy evidence with coverage. It is an attribution aid, not a causal model.';
