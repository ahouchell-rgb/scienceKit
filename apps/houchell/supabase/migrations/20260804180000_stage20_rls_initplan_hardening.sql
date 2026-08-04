-- Keep authenticated-user lookups as init plans so PostgreSQL evaluates them
-- once per statement instead of once per candidate row.

drop policy if exists intelligence_actions_scope_read
  on public.intelligence_actions;

create policy intelligence_actions_scope_read
  on public.intelligence_actions
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or created_by = (select auth.uid())
    or intelligence_private.can_read_intelligence_finding(finding_id)
  );

drop policy if exists education_events_purpose_read
  on public.education_events;

create policy education_events_purpose_read
  on public.education_events
  for select to authenticated
  using (
    intelligence_private.can_manage_school_scope(school_id)
    or (
      pupil_id is not null
      and intelligence_private.can_read_canonical_pupil(pupil_id)
    )
    or exists (
      select 1
      from public.classes class
      where class.id = class_id
        and class.teacher_id = (select auth.uid())
    )
  );
