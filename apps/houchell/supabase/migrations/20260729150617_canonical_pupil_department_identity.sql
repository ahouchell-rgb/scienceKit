-- =====================================================================
-- School Intelligence Stage 2 — canonical pupil + department identity
--
-- Additive only. This does not replace retrieval profiles, MIS staging,
-- Springboard pupils, guardian links or assessment roster text. Instead it
-- gives those records one governed identity to point at, with provenance and
-- an explicit review queue for ambiguous matches.
--
-- IMPORTANT: run the repository/live-schema reconciliation gate documented in
-- docs/STAGE2_IDENTITY_CONTRACT.md before applying this migration.
-- =====================================================================

create schema if not exists intelligence_private;
revoke all on schema intelligence_private from public;
grant usage on schema intelligence_private to authenticated;

-- ---------------------------------------------------------------------
-- Canonical organisation model below school.
-- ---------------------------------------------------------------------
create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  subject_id  uuid references public.subjects(id) on delete set null,
  name        text not null check (length(btrim(name)) > 0),
  code        text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index departments_school_name_uq
  on public.departments (school_id, lower(name));
create index departments_subject_idx
  on public.departments (subject_id);

create table public.department_staff_memberships (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null default 'member'
    check (membership_role in ('member', 'lead')),
  valid_from     date not null default current_date,
  valid_to       date,
  created_at     timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create unique index department_staff_one_current_uq
  on public.department_staff_memberships (department_id, profile_id)
  where valid_to is null;
create index department_staff_profile_idx
  on public.department_staff_memberships (profile_id, valid_to);

create table public.department_class_memberships (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id) on delete cascade,
  class_id       uuid not null references public.classes(id) on delete cascade,
  valid_from     date not null default current_date,
  valid_to       date,
  created_at     timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create unique index department_class_one_current_uq
  on public.department_class_memberships (department_id, class_id)
  where valid_to is null;
create index department_class_class_idx
  on public.department_class_memberships (class_id, valid_to);

-- ---------------------------------------------------------------------
-- Canonical pupil: minimal stable record. Source-specific identifiers and
-- raw MIS payloads remain in their source systems.
-- ---------------------------------------------------------------------
create table public.pupils (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  display_name    text not null check (length(btrim(display_name)) > 0),
  year_group      integer check (year_group between 0 and 14),
  form_group      text,
  status          text not null default 'active'
    check (status in ('active', 'left', 'archived')),
  admission_date  date,
  leaving_date    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, school_id),
  check (
    leaving_date is null
    or admission_date is null
    or leaving_date >= admission_date
  )
);

create index pupils_school_year_idx
  on public.pupils (school_id, year_group, status);

-- One row per source record. A source record can be proposed/rejected without
-- silently changing the canonical pupil used by downstream analytics.
create table public.pupil_source_identities (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete cascade,
  pupil_id             uuid not null,
  source_system        text not null
    check (source_system in (
      'retrieval_profile',
      'mis_student',
      'springboard_pupil',
      'guardian_student',
      'assessment_roster',
      'manual'
    )),
  source_tenant_key    text not null default '',
  source_record_id     text not null check (length(btrim(source_record_id)) > 0),
  source_display_name  text,
  match_method         text not null
    check (match_method in (
      'existing_link',
      'verified_external_id',
      'verified_upn',
      'shared_legacy_uuid',
      'manual_review',
      'manual_create'
    )),
  match_confidence     numeric(5,4) not null
    check (match_confidence >= 0 and match_confidence <= 1),
  link_status          text not null default 'linked'
    check (link_status in ('proposed', 'linked', 'rejected')),
  evidence             jsonb not null default '{}'::jsonb,
  source_updated_at    timestamptz,
  reviewed_by          uuid references public.profiles(id) on delete set null,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  constraint pupil_source_identity_school_fk
    foreign key (pupil_id, school_id)
    references public.pupils(id, school_id)
    on delete cascade,
  unique (school_id, source_system, source_tenant_key, source_record_id)
);

create index pupil_source_identities_pupil_idx
  on public.pupil_source_identities (pupil_id, link_status);
create index pupil_source_identities_review_idx
  on public.pupil_source_identities (school_id, link_status, created_at desc)
  where link_status = 'proposed';
create index pupil_source_identities_school_source_idx
  on public.pupil_source_identities (
    school_id,
    source_system,
    link_status,
    source_tenant_key,
    source_record_id
  );

-- Canonical, temporal class membership. This is separate from retrieval's
-- class_members until reconciliation proves a safe one-to-one mapping.
create table public.pupil_class_memberships (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  pupil_id            uuid not null,
  class_id            uuid not null references public.classes(id) on delete cascade,
  valid_from          date not null default current_date,
  valid_to            date,
  source_identity_id  uuid references public.pupil_source_identities(id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint pupil_class_membership_school_fk
    foreign key (pupil_id, school_id)
    references public.pupils(id, school_id)
    on delete cascade,
  check (valid_to is null or valid_to >= valid_from)
);

create unique index pupil_class_one_current_uq
  on public.pupil_class_memberships (pupil_id, class_id)
  where valid_to is null;
create index pupil_class_class_idx
  on public.pupil_class_memberships (class_id, valid_to);
create index pupil_class_school_idx
  on public.pupil_class_memberships (school_id, valid_to);

-- Ambiguous and conflicting matches are work, not hidden guesses.
create table public.pupil_identity_review_queue (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  source_system         text not null,
  source_tenant_key     text not null default '',
  source_record_id      text not null,
  source_display_name   text,
  source_snapshot       jsonb not null default '{}'::jsonb,
  candidate_pupil_ids   uuid[] not null default '{}',
  reason_codes          text[] not null default '{}',
  status                text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  resolved_pupil_id     uuid references public.pupils(id) on delete set null,
  resolution_note       text,
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (school_id, source_system, source_tenant_key, source_record_id)
);

create index pupil_identity_review_open_idx
  on public.pupil_identity_review_queue (school_id, created_at)
  where status = 'open';

-- ---------------------------------------------------------------------
-- Compatibility bridges. These columns are deliberately nullable: current
-- behaviour keeps working while each source is reconciled.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.mis_students') is not null then
    execute '
      alter table public.mis_students
      add column if not exists canonical_pupil_id uuid
      references public.pupils(id) on delete set null
    ';
    execute '
      create index if not exists mis_students_canonical_pupil_idx
      on public.mis_students(canonical_pupil_id)
    ';
  end if;

  if to_regclass('public.springboard_pupil') is not null then
    execute '
      alter table public.springboard_pupil
      add column if not exists canonical_pupil_id uuid
      references public.pupils(id) on delete set null
    ';
    execute '
      create index if not exists springboard_canonical_pupil_idx
      on public.springboard_pupil(canonical_pupil_id)
    ';
  end if;

  if to_regclass('public.guardian_student') is not null then
    execute '
      alter table public.guardian_student
      add column if not exists canonical_pupil_id uuid
      references public.pupils(id) on delete set null
    ';
    execute '
      create index if not exists guardian_student_canonical_pupil_idx
      on public.guardian_student(canonical_pupil_id)
    ';
  end if;

  if to_regclass('public.assessment_marks') is not null then
    execute '
      alter table public.assessment_marks
      add column if not exists canonical_pupil_id uuid
      references public.pupils(id) on delete set null
    ';
    execute '
      create index if not exists assessment_marks_canonical_pupil_idx
      on public.assessment_marks(canonical_pupil_id)
    ';
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Purpose-limited scope helpers. They live outside the exposed public schema,
-- use a fixed search_path, fully qualified names and auth.uid(), and reveal
-- only booleans. Base-table writes remain service-role only.
-- ---------------------------------------------------------------------
create or replace function intelligence_private.can_read_school_scope(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.profiles me
    left join public.schools target_school on target_school.id = p_school_id
    where me.id = auth.uid()
      and (
        me.school_id = p_school_id
        or (
          me.trust_role = 'trust_lead'
          and me.trust_id is not null
          and me.trust_id = target_school.trust_id
        )
      )
  );
$$;

create or replace function intelligence_private.can_manage_school_scope(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.profiles me
    left join public.schools target_school on target_school.id = p_school_id
    where me.id = auth.uid()
      and (
        (me.school_id = p_school_id and me.school_role in ('hod', 'slt'))
        or (
          me.trust_role = 'trust_lead'
          and me.trust_id is not null
          and me.trust_id = target_school.trust_id
        )
      )
  );
$$;

create or replace function intelligence_private.can_read_canonical_pupil(p_pupil_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.pupils pupil
    where pupil.id = p_pupil_id
      and (
        intelligence_private.can_manage_school_scope(pupil.school_id)
        or exists (
          select 1
          from public.pupil_class_memberships membership
          join public.classes class on class.id = membership.class_id
          where membership.pupil_id = pupil.id
            and class.teacher_id = auth.uid()
            and membership.valid_from <= current_date
            and (membership.valid_to is null or membership.valid_to >= current_date)
        )
      )
  );
$$;

revoke all on function intelligence_private.can_read_school_scope(uuid) from public;
revoke all on function intelligence_private.can_manage_school_scope(uuid) from public;
revoke all on function intelligence_private.can_read_canonical_pupil(uuid) from public;
grant execute on function intelligence_private.can_read_school_scope(uuid) to authenticated;
grant execute on function intelligence_private.can_manage_school_scope(uuid) to authenticated;
grant execute on function intelligence_private.can_read_canonical_pupil(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS. Authenticated clients can read only their purpose-limited scope.
-- Mutations have no authenticated policy and therefore require the server
-- reconciliation service role.
-- ---------------------------------------------------------------------
alter table public.departments enable row level security;
alter table public.department_staff_memberships enable row level security;
alter table public.department_class_memberships enable row level security;
alter table public.pupils enable row level security;
alter table public.pupil_source_identities enable row level security;
alter table public.pupil_class_memberships enable row level security;
alter table public.pupil_identity_review_queue enable row level security;

create policy departments_scope_read on public.departments
  for select to authenticated
  using (intelligence_private.can_read_school_scope(school_id));

create policy department_staff_scope_read on public.department_staff_memberships
  for select to authenticated
  using (
    exists (
      select 1
      from public.departments department
      where department.id = department_id
        and intelligence_private.can_read_school_scope(department.school_id)
    )
  );

create policy department_class_scope_read on public.department_class_memberships
  for select to authenticated
  using (
    exists (
      select 1
      from public.departments department
      where department.id = department_id
        and intelligence_private.can_read_school_scope(department.school_id)
    )
  );

create policy pupils_purpose_read on public.pupils
  for select to authenticated
  using (intelligence_private.can_read_canonical_pupil(id));

create policy pupil_source_identities_purpose_read on public.pupil_source_identities
  for select to authenticated
  using (intelligence_private.can_read_canonical_pupil(pupil_id));

create policy pupil_class_memberships_purpose_read on public.pupil_class_memberships
  for select to authenticated
  using (intelligence_private.can_read_canonical_pupil(pupil_id));

create policy pupil_identity_review_leadership_read on public.pupil_identity_review_queue
  for select to authenticated
  using (intelligence_private.can_manage_school_scope(school_id));

revoke all on table
  public.departments,
  public.department_staff_memberships,
  public.department_class_memberships,
  public.pupils,
  public.pupil_source_identities,
  public.pupil_class_memberships,
  public.pupil_identity_review_queue
from anon;

grant select on table
  public.departments,
  public.department_staff_memberships,
  public.department_class_memberships,
  public.pupils,
  public.pupil_source_identities,
  public.pupil_class_memberships,
  public.pupil_identity_review_queue
to authenticated;

grant select, insert, update on table
  public.departments,
  public.department_staff_memberships,
  public.department_class_memberships,
  public.pupils,
  public.pupil_source_identities,
  public.pupil_class_memberships,
  public.pupil_identity_review_queue
to service_role;

comment on table public.pupils is
  'Canonical school-scoped pupil identity. Source-specific identifiers stay in pupil_source_identities.';
comment on table public.pupil_source_identities is
  'Provenance for every source record linked or proposed against a canonical pupil. Never merge by name silently.';
comment on table public.pupil_identity_review_queue is
  'Human review queue for ambiguous, conflicting or low-confidence pupil identity matches.';
comment on table public.departments is
  'Canonical school department. Staff and class membership are time-bounded in separate tables.';
