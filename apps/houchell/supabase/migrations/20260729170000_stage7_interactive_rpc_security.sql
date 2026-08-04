-- =====================================================================
-- School Intelligence Stage 7 — activate the role-gated retrieval spine.
--
-- Interactive callers use their own JWT. Server-only family/cron callers
-- may continue using the existing aggregate RPC secret during the migration
-- window. Named-pupil intervention data never accepts that shared secret.
-- =====================================================================

-- This helper is deliberately narrower than aggregate class analytics:
-- named intervention rows are SLT-only within the class's school.
create or replace function public.can_read_class_pii(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_moderator()
    or exists (
      select 1
      from public.classes class
      join public.profiles me on me.id = auth.uid()
      where class.id = p_class_id
        and class.school_id = me.school_id
        and me.school_role = 'slt'
    );
$$;

-- Remove the secret bypass from the only in-scope RPC returning pupil names.
create or replace function public.class_intervention_list(
  p_class_id uuid,
  p_threshold integer default 50,
  p_subject text default null
)
returns table(
  student_id uuid,
  student_name text,
  topic_id uuid,
  topic_name text,
  subject_id uuid,
  pct_correct numeric,
  marked integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    response.student_id,
    coalesce(profile.display_name, profile.full_name, 'Pupil') as student_name,
    topic.id,
    topic.name,
    topic.subject_id,
    round(
      100.0 * count(*) filter (where response.is_correct)
      / nullif(count(*) filter (where response.is_correct is not null), 0),
      0
    ) as pct_correct,
    count(*) filter (where response.is_correct is not null)::integer as marked
  from public.responses response
  join public.questions question on question.id = response.question_id
  join public.topics topic on topic.id = question.topic_id
  join public.profiles profile on profile.id = response.student_id
  left join public.subjects subject on subject.id = topic.subject_id
  where response.class_id = p_class_id
    and (p_subject is null or subject.slug = p_subject or subject.name = p_subject)
    and public.can_read_class_pii(p_class_id)
  group by
    response.student_id,
    coalesce(profile.display_name, profile.full_name, 'Pupil'),
    topic.id,
    topic.name,
    topic.subject_id
  having count(*) filter (where response.is_correct is not null) > 0
    and round(
      100.0 * count(*) filter (where response.is_correct)
      / nullif(count(*) filter (where response.is_correct is not null), 0),
      0
    ) <= p_threshold
  order by pct_correct asc, marked desc;
$$;

-- SECURITY DEFINER entry points must never be callable by the anonymous role.
revoke execute on function public.can_read_class_analytics(uuid) from public, anon;
revoke execute on function public.can_read_class_pii(uuid) from public, anon;
revoke execute on function public.can_read_student_analytics(uuid) from public, anon;
revoke execute on function public.class_weak_topics(uuid, integer, integer, text) from public, anon;
revoke execute on function public.student_weak_topics(uuid, integer, text) from public, anon;
revoke execute on function public.class_unit_gaps(uuid, text) from public, anon;
revoke execute on function public.class_paper_gaps(uuid, integer, integer) from public, anon;
revoke execute on function public.class_objective_breakdown(uuid, text, integer) from public, anon;
revoke execute on function public.class_intervention_list(uuid, integer, text) from public, anon;
revoke execute on function public.school_classes() from public, anon;
revoke execute on function public.trust_classes() from public, anon;

grant execute on function public.can_read_class_analytics(uuid) to authenticated, service_role;
grant execute on function public.can_read_class_pii(uuid) to authenticated, service_role;
grant execute on function public.can_read_student_analytics(uuid) to authenticated, service_role;
grant execute on function public.class_weak_topics(uuid, integer, integer, text) to authenticated, service_role;
grant execute on function public.student_weak_topics(uuid, integer, text) to authenticated, service_role;
grant execute on function public.class_unit_gaps(uuid, text) to authenticated, service_role;
grant execute on function public.class_paper_gaps(uuid, integer, integer) to authenticated, service_role;
grant execute on function public.class_objective_breakdown(uuid, text, integer) to authenticated, service_role;
grant execute on function public.class_intervention_list(uuid, integer, text) to authenticated, service_role;
grant execute on function public.school_classes() to authenticated, service_role;
grant execute on function public.trust_classes() to authenticated, service_role;

comment on function public.can_read_class_pii(uuid) is
  'Purpose-limited named-pupil access: SLT in the class school (or platform moderator) only.';
