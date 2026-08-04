-- =====================================================================
-- School Intelligence Stage 13 — governed curriculum knowledge graph.
--
-- Objectives remain the canonical learning nodes. This migration adds
-- reviewed, provenance-bearing assertions around them rather than creating a
-- second curriculum system. Null school_id rows are shared canon; school rows
-- are local variants. Inferred assertions start as proposed and cannot reach
-- lesson generation until a human approves them.
-- =====================================================================

create schema if not exists curriculum_private;
revoke all on schema curriculum_private from public, anon, authenticated;

create table public.curriculum_objective_profiles (
  id                    uuid primary key default gen_random_uuid(),
  objective_id          uuid not null references public.objectives(id) on delete cascade,
  school_id             uuid references public.schools(id) on delete cascade,
  statement             text,
  success_criteria      jsonb not null default '[]'::jsonb
    check (jsonb_typeof(success_criteria) = 'array'),
  reading_demand        smallint check (reading_demand between 1 and 5),
  mathematical_demand   smallint check (mathematical_demand between 0 and 5),
  practical_requirements text,
  cognitive_process     text check (
    cognitive_process is null or cognitive_process in (
      'remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'
    )
  ),
  status                text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected')),
  source_kind           text not null default 'human'
    check (source_kind in ('human', 'curriculum_import', 'sequence_seed', 'analysis_model')),
  source_ref            text,
  confidence            numeric(4,3) check (confidence between 0 and 1),
  rationale             text,
  provenance            jsonb not null default '{}'::jsonb,
  created_by            uuid references public.profiles(id) on delete set null,
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    status = 'proposed'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index curriculum_objective_profiles_scope_uidx
  on public.curriculum_objective_profiles (
    objective_id,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index curriculum_objective_profiles_school_status_idx
  on public.curriculum_objective_profiles (school_id, status, objective_id);

create table public.curriculum_objective_links (
  id                    uuid primary key default gen_random_uuid(),
  subject_id            uuid not null references public.subjects(id) on delete cascade,
  school_id             uuid references public.schools(id) on delete cascade,
  from_objective_id     uuid not null references public.objectives(id) on delete cascade,
  to_objective_id       uuid not null references public.objectives(id) on delete cascade,
  link_type             text not null
    check (link_type in (
      'prerequisite_of', 'supports', 'extends', 'contrasts_with', 'part_of'
    )),
  strength              text not null default 'supporting'
    check (strength in ('required', 'supporting')),
  status                text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected')),
  source_kind           text not null default 'human'
    check (source_kind in ('human', 'curriculum_import', 'sequence_seed', 'analysis_model')),
  source_ref            text,
  confidence            numeric(4,3) check (confidence between 0 and 1),
  rationale             text,
  evidence              jsonb not null default '{}'::jsonb,
  created_by            uuid references public.profiles(id) on delete set null,
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (from_objective_id <> to_objective_id),
  check (
    status = 'proposed'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index curriculum_objective_links_active_scope_uidx
  on public.curriculum_objective_links (
    from_objective_id,
    to_objective_id,
    link_type,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status <> 'rejected';
create index curriculum_objective_links_from_idx
  on public.curriculum_objective_links
  (from_objective_id, school_id, status, link_type);
create index curriculum_objective_links_to_idx
  on public.curriculum_objective_links
  (to_objective_id, school_id, status, link_type);
create index curriculum_objective_links_subject_idx
  on public.curriculum_objective_links (subject_id, school_id, status);

create table public.curriculum_misconceptions (
  id                    uuid primary key default gen_random_uuid(),
  subject_id            uuid not null references public.subjects(id) on delete cascade,
  school_id             uuid references public.schools(id) on delete cascade,
  code                  text,
  title                 text not null,
  description           text not null,
  pattern_kind          text not null default 'conceptual'
    check (pattern_kind in (
      'conceptual', 'procedural', 'language', 'representation',
      'calculation', 'practical'
    )),
  diagnostic_prompt     text,
  correction_strategy   text,
  status                text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected')),
  source_kind           text not null default 'human'
    check (source_kind in ('human', 'curriculum_import', 'sequence_seed', 'analysis_model')),
  source_ref            text,
  confidence            numeric(4,3) check (confidence between 0 and 1),
  provenance            jsonb not null default '{}'::jsonb,
  created_by            uuid references public.profiles(id) on delete set null,
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    status = 'proposed'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index curriculum_misconceptions_scope_title_uidx
  on public.curriculum_misconceptions (
    subject_id,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(title)
  )
  where status <> 'rejected';
create index curriculum_misconceptions_subject_status_idx
  on public.curriculum_misconceptions (subject_id, school_id, status);

create table public.curriculum_objective_misconceptions (
  id                    uuid primary key default gen_random_uuid(),
  objective_id          uuid not null references public.objectives(id) on delete cascade,
  misconception_id      uuid not null references public.curriculum_misconceptions(id) on delete cascade,
  school_id             uuid references public.schools(id) on delete cascade,
  priority              smallint not null default 2 check (priority between 1 and 3),
  status                text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected')),
  source_kind           text not null default 'human'
    check (source_kind in ('human', 'curriculum_import', 'sequence_seed', 'analysis_model')),
  rationale             text,
  evidence              jsonb not null default '{}'::jsonb,
  created_by            uuid references public.profiles(id) on delete set null,
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    status = 'proposed'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index curriculum_objective_misconceptions_active_uidx
  on public.curriculum_objective_misconceptions (
    objective_id,
    misconception_id,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status <> 'rejected';
create index curriculum_objective_misconceptions_objective_idx
  on public.curriculum_objective_misconceptions (objective_id, school_id, status);

create table public.curriculum_vocabulary (
  id                    uuid primary key default gen_random_uuid(),
  subject_id            uuid not null references public.subjects(id) on delete cascade,
  school_id             uuid references public.schools(id) on delete cascade,
  term                  text not null,
  definition            text,
  tier                  smallint not null default 3 check (tier in (2, 3)),
  morphology            text,
  pronunciation         text,
  status                text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected')),
  source_kind           text not null default 'human'
    check (source_kind in ('human', 'curriculum_import', 'sequence_seed', 'analysis_model')),
  source_ref            text,
  confidence            numeric(4,3) check (confidence between 0 and 1),
  provenance            jsonb not null default '{}'::jsonb,
  created_by            uuid references public.profiles(id) on delete set null,
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    status = 'proposed'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index curriculum_vocabulary_scope_term_uidx
  on public.curriculum_vocabulary (
    subject_id,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(term)
  )
  where status <> 'rejected';
create index curriculum_vocabulary_subject_status_idx
  on public.curriculum_vocabulary (subject_id, school_id, status);

create table public.curriculum_objective_vocabulary (
  id                    uuid primary key default gen_random_uuid(),
  objective_id          uuid not null references public.objectives(id) on delete cascade,
  vocabulary_id         uuid not null references public.curriculum_vocabulary(id) on delete cascade,
  school_id             uuid references public.schools(id) on delete cascade,
  role                  text not null default 'essential'
    check (role in ('essential', 'supporting', 'extension')),
  status                text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected')),
  source_kind           text not null default 'human'
    check (source_kind in ('human', 'curriculum_import', 'sequence_seed', 'analysis_model')),
  rationale             text,
  created_by            uuid references public.profiles(id) on delete set null,
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    status = 'proposed'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index curriculum_objective_vocabulary_active_uidx
  on public.curriculum_objective_vocabulary (
    objective_id,
    vocabulary_id,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status <> 'rejected';
create index curriculum_objective_vocabulary_objective_idx
  on public.curriculum_objective_vocabulary (objective_id, school_id, status);

create table public.curriculum_resource_objectives (
  id                    uuid primary key default gen_random_uuid(),
  resource_id           uuid not null references public.resources(id) on delete cascade,
  objective_id          uuid not null references public.objectives(id) on delete cascade,
  school_id             uuid references public.schools(id) on delete cascade,
  role                  text not null default 'teaches'
    check (role in ('introduces', 'teaches', 'practises', 'assesses', 'reteaches')),
  coverage              numeric(4,3) check (coverage between 0 and 1),
  status                text not null default 'proposed'
    check (status in ('proposed', 'approved', 'rejected')),
  source_kind           text not null default 'human'
    check (source_kind in ('human', 'curriculum_import', 'sequence_seed', 'analysis_model')),
  rationale             text,
  created_by            uuid references public.profiles(id) on delete set null,
  reviewed_by           uuid references public.profiles(id) on delete set null,
  reviewed_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (
    status = 'proposed'
    or (reviewed_by is not null and reviewed_at is not null)
  )
);

create unique index curriculum_resource_objectives_active_uidx
  on public.curriculum_resource_objectives (
    resource_id,
    objective_id,
    role,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status <> 'rejected';
create index curriculum_resource_objectives_objective_idx
  on public.curriculum_resource_objectives (objective_id, school_id, status);

create table public.curriculum_graph_events (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid references public.schools(id) on delete restrict,
  subject_id            uuid references public.subjects(id) on delete restrict,
  entity_kind           text not null check (
    entity_kind in (
      'batch', 'objective_profile', 'objective_link', 'misconception',
      'objective_misconception', 'vocabulary', 'objective_vocabulary',
      'resource_objective'
    )
  ),
  entity_id             uuid,
  event_type            text not null check (
    event_type in ('seeded', 'proposed', 'approved', 'rejected', 'updated')
  ),
  before_snapshot       jsonb,
  after_snapshot        jsonb,
  actor_id              uuid not null references public.profiles(id) on delete restrict,
  created_at            timestamptz not null default now()
);

create index curriculum_graph_events_scope_time_idx
  on public.curriculum_graph_events (school_id, subject_id, created_at desc);
create index curriculum_graph_events_entity_idx
  on public.curriculum_graph_events (entity_kind, entity_id, created_at desc);

-- Keep subject identity and global/school inheritance valid even for privileged
-- imports. Application checks are useful feedback; database checks are truth.
create or replace function curriculum_private.validate_objective_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_from_subject uuid;
  v_to_subject uuid;
begin
  select objective.subject_id into v_from_subject
  from public.objectives objective
  where objective.id = new.from_objective_id;

  select objective.subject_id into v_to_subject
  from public.objectives objective
  where objective.id = new.to_objective_id;

  if v_from_subject is null
    or v_to_subject is null
    or v_from_subject <> v_to_subject
    or v_from_subject <> new.subject_id
  then
    raise exception 'curriculum link objectives must match its subject'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function curriculum_private.validate_misconception_mapping()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_objective_subject uuid;
  v_taxonomy_subject uuid;
  v_taxonomy_school uuid;
begin
  select objective.subject_id into v_objective_subject
  from public.objectives objective
  where objective.id = new.objective_id;

  select misconception.subject_id, misconception.school_id
  into v_taxonomy_subject, v_taxonomy_school
  from public.curriculum_misconceptions misconception
  where misconception.id = new.misconception_id;

  if v_objective_subject is null
    or v_taxonomy_subject is null
    or v_objective_subject <> v_taxonomy_subject
    or (new.school_id is null and v_taxonomy_school is not null)
    or (
      new.school_id is not null
      and v_taxonomy_school is not null
      and v_taxonomy_school <> new.school_id
    )
  then
    raise exception 'misconception mapping crosses subject or school scope'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function curriculum_private.validate_vocabulary_mapping()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_objective_subject uuid;
  v_taxonomy_subject uuid;
  v_taxonomy_school uuid;
begin
  select objective.subject_id into v_objective_subject
  from public.objectives objective
  where objective.id = new.objective_id;

  select vocabulary.subject_id, vocabulary.school_id
  into v_taxonomy_subject, v_taxonomy_school
  from public.curriculum_vocabulary vocabulary
  where vocabulary.id = new.vocabulary_id;

  if v_objective_subject is null
    or v_taxonomy_subject is null
    or v_objective_subject <> v_taxonomy_subject
    or (new.school_id is null and v_taxonomy_school is not null)
    or (
      new.school_id is not null
      and v_taxonomy_school is not null
      and v_taxonomy_school <> new.school_id
    )
  then
    raise exception 'vocabulary mapping crosses subject or school scope'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger curriculum_objective_links_validate
  before insert or update of subject_id, from_objective_id, to_objective_id
  on public.curriculum_objective_links
  for each row execute function curriculum_private.validate_objective_link();

create trigger curriculum_objective_misconceptions_validate
  before insert or update of objective_id, misconception_id, school_id
  on public.curriculum_objective_misconceptions
  for each row execute function curriculum_private.validate_misconception_mapping();

create trigger curriculum_objective_vocabulary_validate
  before insert or update of objective_id, vocabulary_id, school_id
  on public.curriculum_objective_vocabulary
  for each row execute function curriculum_private.validate_vocabulary_mapping();

-- A proposed prerequisite may not introduce a cycle. For a school assertion,
-- the effective graph is shared canon plus that school's variant.
create or replace function curriculum_private.prevent_prerequisite_cycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_scope uuid;
  v_cycle boolean;
begin
  if new.link_type <> 'prerequisite_of' or new.status = 'rejected' then
    return new;
  end if;

  -- A new school link affects one effective graph. A new shared-canon link
  -- affects the global graph and every school graph that already has variants.
  for v_scope in
    select new.school_id where new.school_id is not null
    union
    select null::uuid where new.school_id is null
    union
    select distinct edge.school_id
    from public.curriculum_objective_links edge
    where new.school_id is null
      and edge.school_id is not null
      and edge.link_type = 'prerequisite_of'
      and edge.status <> 'rejected'
  loop
    with recursive reachable(objective_id, path) as (
      select
        edge.to_objective_id,
        array[edge.from_objective_id, edge.to_objective_id]::uuid[]
      from public.curriculum_objective_links edge
      where edge.link_type = 'prerequisite_of'
        and edge.status <> 'rejected'
        and edge.from_objective_id = new.to_objective_id
        and edge.id <> new.id
        and (
          (v_scope is null and edge.school_id is null)
          or (
            v_scope is not null
            and (edge.school_id is null or edge.school_id = v_scope)
          )
        )

      union all

      select
        edge.to_objective_id,
        reachable.path || edge.to_objective_id
      from reachable
      join public.curriculum_objective_links edge
        on edge.from_objective_id = reachable.objective_id
      where edge.link_type = 'prerequisite_of'
        and edge.status <> 'rejected'
        and edge.id <> new.id
        and not edge.to_objective_id = any(reachable.path)
        and (
          (v_scope is null and edge.school_id is null)
          or (
            v_scope is not null
            and (edge.school_id is null or edge.school_id = v_scope)
          )
        )
    )
    select exists (
      select 1 from reachable where objective_id = new.from_objective_id
    ) into v_cycle;

    if v_cycle then
      raise exception 'curriculum prerequisite cycle detected'
        using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

create trigger curriculum_objective_links_prevent_cycle
  before insert or update of from_objective_id, to_objective_id, link_type, status, school_id
  on public.curriculum_objective_links
  for each row execute function curriculum_private.prevent_prerequisite_cycle();

create or replace function curriculum_private.reject_graph_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'curriculum graph events are append-only';
end;
$$;

create trigger curriculum_graph_events_append_only
  before update or delete on public.curriculum_graph_events
  for each row execute function curriculum_private.reject_graph_event_mutation();

create trigger curriculum_objective_profiles_set_updated_at
  before update on public.curriculum_objective_profiles
  for each row execute function public.tg_set_updated_at();
create trigger curriculum_objective_links_set_updated_at
  before update on public.curriculum_objective_links
  for each row execute function public.tg_set_updated_at();
create trigger curriculum_misconceptions_set_updated_at
  before update on public.curriculum_misconceptions
  for each row execute function public.tg_set_updated_at();
create trigger curriculum_objective_misconceptions_set_updated_at
  before update on public.curriculum_objective_misconceptions
  for each row execute function public.tg_set_updated_at();
create trigger curriculum_vocabulary_set_updated_at
  before update on public.curriculum_vocabulary
  for each row execute function public.tg_set_updated_at();
create trigger curriculum_objective_vocabulary_set_updated_at
  before update on public.curriculum_objective_vocabulary
  for each row execute function public.tg_set_updated_at();
create trigger curriculum_resource_objectives_set_updated_at
  before update on public.curriculum_resource_objectives
  for each row execute function public.tg_set_updated_at();

-- Recursive traversal stays bounded. It runs with the caller's RLS and returns
-- only approved links from shared canon plus the requested school variant.
create or replace function public.curriculum_prerequisite_chain(
  p_objective_id uuid,
  p_school_id uuid default null,
  p_direction text default 'upstream',
  p_max_depth integer default 6
)
returns table (
  objective_id uuid,
  objective_code text,
  objective_title text,
  depth integer,
  via_link_id uuid,
  strength text,
  rationale text
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  with recursive walk as (
    select
      case
        when p_direction = 'downstream' then edge.to_objective_id
        else edge.from_objective_id
      end as objective_id,
      1 as depth,
      edge.id as via_link_id,
      edge.strength,
      edge.rationale,
      array[
        p_objective_id,
        case
          when p_direction = 'downstream' then edge.to_objective_id
          else edge.from_objective_id
        end
      ]::uuid[] as path
    from public.curriculum_objective_links edge
    where edge.link_type = 'prerequisite_of'
      and edge.status = 'approved'
      and (edge.school_id is null or edge.school_id = p_school_id)
      and (
        (p_direction = 'downstream' and edge.from_objective_id = p_objective_id)
        or
        (p_direction <> 'downstream' and edge.to_objective_id = p_objective_id)
      )

    union all

    select
      case
        when p_direction = 'downstream' then edge.to_objective_id
        else edge.from_objective_id
      end,
      walk.depth + 1,
      edge.id,
      edge.strength,
      edge.rationale,
      walk.path ||
        case
          when p_direction = 'downstream' then edge.to_objective_id
          else edge.from_objective_id
        end
    from walk
    join public.curriculum_objective_links edge
      on (
        p_direction = 'downstream'
        and edge.from_objective_id = walk.objective_id
      ) or (
        p_direction <> 'downstream'
        and edge.to_objective_id = walk.objective_id
      )
    where walk.depth < least(greatest(p_max_depth, 1), 12)
      and edge.link_type = 'prerequisite_of'
      and edge.status = 'approved'
      and (edge.school_id is null or edge.school_id = p_school_id)
      and not (
        case
          when p_direction = 'downstream' then edge.to_objective_id
          else edge.from_objective_id
        end
      ) = any(walk.path)
  )
  select distinct on (walk.objective_id)
    objective.id,
    objective.code,
    objective.title,
    walk.depth,
    walk.via_link_id,
    walk.strength,
    walk.rationale
  from walk
  join public.objectives objective on objective.id = walk.objective_id
  order by walk.objective_id, walk.depth;
$$;

-- One bounded graph read replaces several large objective_id=in.(...) REST
-- filters. SECURITY INVOKER preserves the caller's table grants and RLS.
create or replace function public.curriculum_graph_bundle(
  p_subject_id uuid,
  p_school_id uuid default null,
  p_objective_limit integer default 600
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  with selected_objectives as materialized (
    select
      objective.id,
      objective.subject_id,
      objective.unit_id,
      objective.lesson_id,
      objective.code,
      objective.spec_ref,
      objective.title,
      objective.key_stage,
      objective.sort_order
    from public.objectives objective
    where objective.subject_id = p_subject_id
    order by objective.sort_order asc, objective.id asc
    limit least(greatest(coalesce(p_objective_limit, 600), 1), 600)
  )
  select jsonb_build_object(
    'objectives',
    coalesce((
      select jsonb_agg(to_jsonb(objective_row) order by objective_row.sort_order, objective_row.id)
      from selected_objectives objective_row
    ), '[]'::jsonb),
    'lessons',
    coalesce((
      select jsonb_agg(to_jsonb(lesson_row) order by lesson_row.sort_order, lesson_row.lesson_number, lesson_row.id)
      from (
        select
          lesson.id,
          lesson.unit_id,
          lesson.lesson_number,
          lesson.sort_order,
          lesson.title,
          lesson.keywords,
          lesson.misconception_alerts
        from public.lessons lesson
        where lesson.id in (
          select objective.lesson_id
          from selected_objectives objective
          where objective.lesson_id is not null
        )
        order by lesson.sort_order asc, lesson.lesson_number asc, lesson.id asc
        limit 1000
      ) lesson_row
    ), '[]'::jsonb),
    'profiles',
    coalesce((
      select jsonb_agg(to_jsonb(profile_row) order by profile_row.created_at, profile_row.id)
      from (
        select profile.*
        from public.curriculum_objective_profiles profile
        where profile.objective_id in (select objective.id from selected_objectives objective)
          and (
            (p_school_id is null and profile.school_id is null)
            or profile.school_id is null
            or profile.school_id = p_school_id
          )
        order by profile.created_at asc, profile.id asc
        limit 1000
      ) profile_row
    ), '[]'::jsonb),
    'links',
    coalesce((
      select jsonb_agg(to_jsonb(link_row) order by link_row.created_at, link_row.id)
      from (
        select link.*
        from public.curriculum_objective_links link
        where link.subject_id = p_subject_id
          and (
            (p_school_id is null and link.school_id is null)
            or link.school_id is null
            or link.school_id = p_school_id
          )
        order by link.created_at asc, link.id asc
        limit 2000
      ) link_row
    ), '[]'::jsonb),
    'misconceptions',
    coalesce((
      select jsonb_agg(to_jsonb(misconception_row) order by misconception_row.title, misconception_row.id)
      from (
        select misconception.*
        from public.curriculum_misconceptions misconception
        where misconception.subject_id = p_subject_id
          and (
            (p_school_id is null and misconception.school_id is null)
            or misconception.school_id is null
            or misconception.school_id = p_school_id
          )
        order by misconception.title asc, misconception.id asc
        limit 1000
      ) misconception_row
    ), '[]'::jsonb),
    'objectiveMisconceptions',
    coalesce((
      select jsonb_agg(to_jsonb(mapping_row) order by mapping_row.created_at, mapping_row.id)
      from (
        select mapping.*
        from public.curriculum_objective_misconceptions mapping
        where mapping.objective_id in (select objective.id from selected_objectives objective)
          and (
            (p_school_id is null and mapping.school_id is null)
            or mapping.school_id is null
            or mapping.school_id = p_school_id
          )
        order by mapping.created_at asc, mapping.id asc
        limit 2000
      ) mapping_row
    ), '[]'::jsonb),
    'vocabulary',
    coalesce((
      select jsonb_agg(to_jsonb(vocabulary_row) order by vocabulary_row.term, vocabulary_row.id)
      from (
        select vocabulary.*
        from public.curriculum_vocabulary vocabulary
        where vocabulary.subject_id = p_subject_id
          and (
            (p_school_id is null and vocabulary.school_id is null)
            or vocabulary.school_id is null
            or vocabulary.school_id = p_school_id
          )
        order by vocabulary.term asc, vocabulary.id asc
        limit 1500
      ) vocabulary_row
    ), '[]'::jsonb),
    'objectiveVocabulary',
    coalesce((
      select jsonb_agg(to_jsonb(mapping_row) order by mapping_row.created_at, mapping_row.id)
      from (
        select mapping.*
        from public.curriculum_objective_vocabulary mapping
        where mapping.objective_id in (select objective.id from selected_objectives objective)
          and (
            (p_school_id is null and mapping.school_id is null)
            or mapping.school_id is null
            or mapping.school_id = p_school_id
          )
        order by mapping.created_at asc, mapping.id asc
        limit 3000
      ) mapping_row
    ), '[]'::jsonb),
    'resourceObjectives',
    coalesce((
      select jsonb_agg(to_jsonb(resource_row) order by resource_row.created_at, resource_row.id)
      from (
        select resource.*
        from public.curriculum_resource_objectives resource
        where resource.objective_id in (select objective.id from selected_objectives objective)
          and (
            (p_school_id is null and resource.school_id is null)
            or resource.school_id is null
            or resource.school_id = p_school_id
          )
        order by resource.created_at asc, resource.id asc
        limit 2000
      ) resource_row
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.curriculum_prerequisite_chain(uuid, uuid, text, integer)
  from public, anon;
grant execute on function public.curriculum_prerequisite_chain(uuid, uuid, text, integer)
  to authenticated;
revoke all on function public.curriculum_graph_bundle(uuid, uuid, integer)
  from public, anon;
grant execute on function public.curriculum_graph_bundle(uuid, uuid, integer)
  to authenticated, service_role;

-- Curriculum graph rows contain no pupil data, but school variants must still
-- remain within organisational scope. All mutation is service-route only.
alter table public.curriculum_objective_profiles enable row level security;
alter table public.curriculum_objective_links enable row level security;
alter table public.curriculum_misconceptions enable row level security;
alter table public.curriculum_objective_misconceptions enable row level security;
alter table public.curriculum_vocabulary enable row level security;
alter table public.curriculum_objective_vocabulary enable row level security;
alter table public.curriculum_resource_objectives enable row level security;
alter table public.curriculum_graph_events enable row level security;

create policy curriculum_objective_profiles_scope_read
  on public.curriculum_objective_profiles for select to authenticated
  using (
    school_id is null
    or intelligence_private.can_read_school_scope(school_id)
  );
create policy curriculum_objective_links_scope_read
  on public.curriculum_objective_links for select to authenticated
  using (
    school_id is null
    or intelligence_private.can_read_school_scope(school_id)
  );
create policy curriculum_misconceptions_scope_read
  on public.curriculum_misconceptions for select to authenticated
  using (
    school_id is null
    or intelligence_private.can_read_school_scope(school_id)
  );
create policy curriculum_objective_misconceptions_scope_read
  on public.curriculum_objective_misconceptions for select to authenticated
  using (
    school_id is null
    or intelligence_private.can_read_school_scope(school_id)
  );
create policy curriculum_vocabulary_scope_read
  on public.curriculum_vocabulary for select to authenticated
  using (
    school_id is null
    or intelligence_private.can_read_school_scope(school_id)
  );
create policy curriculum_objective_vocabulary_scope_read
  on public.curriculum_objective_vocabulary for select to authenticated
  using (
    school_id is null
    or intelligence_private.can_read_school_scope(school_id)
  );
create policy curriculum_resource_objectives_scope_read
  on public.curriculum_resource_objectives for select to authenticated
  using (
    school_id is null
    or intelligence_private.can_read_school_scope(school_id)
  );
create policy curriculum_graph_events_scope_read
  on public.curriculum_graph_events for select to authenticated
  using (
    school_id is null
    or intelligence_private.can_read_school_scope(school_id)
  );

revoke all on table
  public.curriculum_objective_profiles,
  public.curriculum_objective_links,
  public.curriculum_misconceptions,
  public.curriculum_objective_misconceptions,
  public.curriculum_vocabulary,
  public.curriculum_objective_vocabulary,
  public.curriculum_resource_objectives,
  public.curriculum_graph_events
from anon, authenticated;

grant select on table
  public.curriculum_objective_profiles,
  public.curriculum_objective_links,
  public.curriculum_misconceptions,
  public.curriculum_objective_misconceptions,
  public.curriculum_vocabulary,
  public.curriculum_objective_vocabulary,
  public.curriculum_resource_objectives,
  public.curriculum_graph_events
to authenticated;

grant select, insert, update on table
  public.curriculum_objective_profiles,
  public.curriculum_objective_links,
  public.curriculum_misconceptions,
  public.curriculum_objective_misconceptions,
  public.curriculum_vocabulary,
  public.curriculum_objective_vocabulary,
  public.curriculum_resource_objectives
to service_role;
grant select, insert on table
  public.curriculum_graph_events
to service_role;

comment on table public.curriculum_objective_links is
  'Reviewed typed assertions between canonical objectives. prerequisite_of links are cycle-checked.';
comment on table public.curriculum_graph_events is
  'Append-only human and machine provenance for curriculum graph proposals and review decisions.';
comment on function public.curriculum_prerequisite_chain(uuid, uuid, text, integer) is
  'Bounded approved prerequisite traversal over shared canon plus an authorised school variant.';
