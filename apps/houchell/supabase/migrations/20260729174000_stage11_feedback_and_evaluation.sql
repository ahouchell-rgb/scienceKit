-- =====================================================================
-- School Intelligence Stage 11 — teacher feedback, artifact fingerprints
-- and evaluation measures.
--
-- Adoption is not impact. The evaluation read model keeps generation,
-- delivery, recheck and descriptive outcome coverage as separate measures.
-- =====================================================================

alter table public.intelligence_artifacts
  add column content_fingerprint text,
  add column content_bytes integer check (content_bytes is null or content_bytes >= 0);

alter table public.intelligence_deliveries
  add column delivered_fingerprint text;

create table public.intelligence_feedback (
  id                  uuid primary key default gen_random_uuid(),
  action_id           uuid not null references public.intelligence_actions(id) on delete restrict,
  finding_id          uuid not null references public.intelligence_findings(id) on delete restrict,
  artifact_id         uuid references public.intelligence_artifacts(id) on delete restrict,
  feedback_type       text not null
    check (feedback_type in ('accepted', 'edited', 'rejected', 'rating', 'comment')),
  rating              integer check (rating between 1 and 5),
  reason              text,
  time_saved_minutes  integer check (time_saved_minutes is null or time_saved_minutes between 0 and 600),
  metadata            jsonb not null default '{}'::jsonb,
  created_by          uuid not null references public.profiles(id) on delete restrict,
  created_at          timestamptz not null default now(),
  check (rating is not null or length(btrim(coalesce(reason, ''))) >= 3 or feedback_type in ('accepted', 'edited'))
);

create index intelligence_feedback_action_idx
  on public.intelligence_feedback (action_id, created_at desc);
create index intelligence_feedback_artifact_idx
  on public.intelligence_feedback (artifact_id, created_at desc)
  where artifact_id is not null;

alter table public.intelligence_feedback enable row level security;

create policy intelligence_feedback_scope_read on public.intelligence_feedback
  for select to authenticated
  using (intelligence_private.can_read_intelligence_finding(finding_id));

revoke all on table public.intelligence_feedback from anon;
grant select on table public.intelligence_feedback to authenticated;
grant select, insert on table public.intelligence_feedback to service_role;

-- ---------------------------------------------------------------------
-- Atomic, idempotent response-loop transitions. These functions are
-- intentionally SECURITY INVOKER and callable only by the service role.
-- The API authenticates and authorises the human before invoking them.
-- ---------------------------------------------------------------------
create or replace function public.record_intelligence_delivery(
  p_action_id uuid,
  p_artifact_id uuid,
  p_class_id uuid,
  p_delivered_by uuid,
  p_delivered_at timestamptz,
  p_delivery_mode text,
  p_artifact_snapshot jsonb,
  p_delivered_fingerprint text,
  p_notes text,
  p_idempotency_key text,
  p_finding_id uuid,
  p_objective_id uuid,
  p_objective_key text,
  p_recheck_method text,
  p_recheck_due_at timestamptz,
  p_baseline_snapshot jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_action_status text;
  v_action_finding_id uuid;
  v_action_class_id uuid;
  v_delivery public.intelligence_deliveries%rowtype;
  v_recheck public.intelligence_rechecks%rowtype;
begin
  if length(btrim(coalesce(p_idempotency_key, ''))) < 16 then
    raise exception 'A stable delivery idempotency key is required'
      using errcode = '22023';
  end if;

  select action.status, action.finding_id, finding.class_id
  into v_action_status, v_action_finding_id, v_action_class_id
  from public.intelligence_actions action
  join public.intelligence_findings finding on finding.id = action.finding_id
  where action.id = p_action_id
  for update of action;

  if not found then
    raise exception 'Response action not found'
      using errcode = 'P0002';
  end if;

  -- The action lock serialises concurrent retries. Re-check the idempotency
  -- key after acquiring it so a second request can return the first result.
  select delivery.*
  into v_delivery
  from public.intelligence_deliveries delivery
  where delivery.action_id = p_action_id
    and delivery.idempotency_key = p_idempotency_key;

  if found then
    select recheck.*
    into v_recheck
    from public.intelligence_rechecks recheck
    where recheck.delivery_id = v_delivery.id
    order by recheck.created_at asc
    limit 1;

    return jsonb_build_object(
      'delivery', to_jsonb(v_delivery),
      'recheck', to_jsonb(v_recheck),
      'reused', true
    );
  end if;

  if v_action_status not in ('accepted', 'in_progress') then
    raise exception 'The response action must be accepted before delivery'
      using errcode = '23514';
  end if;
  if v_action_finding_id <> p_finding_id
    or v_action_class_id is distinct from p_class_id then
    raise exception 'Delivery scope does not match the response action'
      using errcode = '23503';
  end if;
  if p_recheck_due_at <= p_delivered_at then
    raise exception 'The recheck must be scheduled after delivery'
      using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.intelligence_artifacts artifact
    where artifact.id = p_artifact_id
      and artifact.action_id = p_action_id
      and artifact.finding_id = p_finding_id
  ) then
    raise exception 'Artifact does not belong to the response action'
      using errcode = '23503';
  end if;

  insert into public.intelligence_deliveries (
    action_id,
    artifact_id,
    class_id,
    delivered_by,
    delivered_at,
    delivery_mode,
    artifact_snapshot,
    delivered_fingerprint,
    idempotency_key,
    notes
  ) values (
    p_action_id,
    p_artifact_id,
    p_class_id,
    p_delivered_by,
    p_delivered_at,
    p_delivery_mode,
    coalesce(p_artifact_snapshot, '{}'::jsonb),
    p_delivered_fingerprint,
    p_idempotency_key,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning * into v_delivery;

  insert into public.intelligence_rechecks (
    action_id,
    finding_id,
    delivery_id,
    objective_id,
    objective_key,
    method,
    status,
    due_at,
    baseline_snapshot,
    created_by,
    updated_by
  ) values (
    p_action_id,
    p_finding_id,
    v_delivery.id,
    p_objective_id,
    p_objective_key,
    p_recheck_method,
    'scheduled',
    p_recheck_due_at,
    p_baseline_snapshot,
    p_delivered_by,
    p_delivered_by
  )
  returning * into v_recheck;

  if v_action_status = 'accepted' then
    update public.intelligence_actions
    set
      status = 'in_progress',
      started_at = p_delivered_at,
      updated_by = p_delivered_by
    where id = p_action_id;
  end if;

  return jsonb_build_object(
    'delivery', to_jsonb(v_delivery),
    'recheck', to_jsonb(v_recheck),
    'reused', false
  );
end;
$$;

create or replace function public.complete_intelligence_recheck(
  p_action_id uuid,
  p_recheck_id uuid,
  p_completed_at timestamptz,
  p_result_snapshot jsonb,
  p_metric text,
  p_baseline_value numeric,
  p_outcome_value numeric,
  p_sample_size integer,
  p_outcome_window_days integer,
  p_attribution_strength text,
  p_interpretation text,
  p_evaluated_by uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_recheck public.intelligence_rechecks%rowtype;
  v_outcome public.intelligence_outcomes%rowtype;
begin
  select recheck.*
  into v_recheck
  from public.intelligence_rechecks recheck
  where recheck.id = p_recheck_id
    and recheck.action_id = p_action_id
  for update;

  if not found then
    raise exception 'Recheck not found on this response action'
      using errcode = 'P0002';
  end if;
  if v_recheck.status = 'invalid' then
    raise exception 'This recheck was invalidated'
      using errcode = '23514';
  end if;

  select outcome.*
  into v_outcome
  from public.intelligence_outcomes outcome
  where outcome.recheck_id = p_recheck_id;

  if found then
    return jsonb_build_object(
      'outcome', to_jsonb(v_outcome),
      'reused', true
    );
  end if;

  update public.intelligence_rechecks
  set
    status = 'completed',
    completed_at = p_completed_at,
    result_snapshot = p_result_snapshot,
    updated_by = p_evaluated_by
  where id = p_recheck_id;

  insert into public.intelligence_outcomes (
    action_id,
    finding_id,
    recheck_id,
    metric,
    baseline_value,
    outcome_value,
    sample_size,
    outcome_window_days,
    attribution_strength,
    interpretation,
    evaluated_by
  ) values (
    p_action_id,
    v_recheck.finding_id,
    p_recheck_id,
    p_metric,
    p_baseline_value,
    p_outcome_value,
    p_sample_size,
    p_outcome_window_days,
    p_attribution_strength,
    p_interpretation,
    p_evaluated_by
  )
  returning * into v_outcome;

  update public.intelligence_actions
  set
    status = 'completed',
    completed_at = p_completed_at,
    outcome_summary = p_interpretation,
    updated_by = p_evaluated_by
  where id = p_action_id;

  return jsonb_build_object(
    'outcome', to_jsonb(v_outcome),
    'reused', false
  );
end;
$$;

revoke all on function public.record_intelligence_delivery(
  uuid, uuid, uuid, uuid, timestamptz, text, jsonb, text, text, text,
  uuid, uuid, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.record_intelligence_delivery(
  uuid, uuid, uuid, uuid, timestamptz, text, jsonb, text, text, text,
  uuid, uuid, text, text, timestamptz, jsonb
) to service_role;

revoke all on function public.complete_intelligence_recheck(
  uuid, uuid, timestamptz, jsonb, text, numeric, numeric, integer, integer,
  text, text, uuid
) from public, anon, authenticated;
grant execute on function public.complete_intelligence_recheck(
  uuid, uuid, timestamptz, jsonb, text, numeric, numeric, integer, integer,
  text, text, uuid
) to service_role;

create trigger intelligence_feedback_no_update_or_delete
  before update or delete on public.intelligence_feedback
  for each row execute function intelligence_private.reject_intelligence_hard_delete();

create or replace function intelligence_private.capture_intelligence_feedback_event()
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
    'artifact.feedback_recorded',
    jsonb_build_object(
      'feedback_id', new.id,
      'artifact_id', new.artifact_id,
      'feedback_type', new.feedback_type,
      'rating', new.rating,
      'time_saved_minutes', new.time_saved_minutes
    )
  );
  return new;
end;
$$;

create trigger intelligence_feedback_capture_event
  after insert on public.intelligence_feedback
  for each row execute function intelligence_private.capture_intelligence_feedback_event();

create view public.intelligence_evaluation_summary
with (security_invoker = true)
as
select
  school.id as school_id,
  school.name as school_name,
  (
    select count(*)
    from public.intelligence_findings finding
    where finding.school_id = school.id
  )::integer as findings,
  (
    select count(*)
    from public.intelligence_actions action
    join public.intelligence_findings finding on finding.id = action.finding_id
    where finding.school_id = school.id
  )::integer as actions,
  (
    select count(*)
    from public.intelligence_actions action
    join public.intelligence_findings finding on finding.id = action.finding_id
    where finding.school_id = school.id
      and action.status in ('accepted', 'in_progress', 'completed')
  )::integer as accepted_actions,
  (
    select count(*)
    from public.intelligence_artifacts artifact
    join public.intelligence_findings finding on finding.id = artifact.finding_id
    where finding.school_id = school.id
  )::integer as artifacts_generated,
  (
    select count(*)
    from public.intelligence_deliveries delivery
    join public.intelligence_actions action on action.id = delivery.action_id
    join public.intelligence_findings finding on finding.id = action.finding_id
    where finding.school_id = school.id
  )::integer as deliveries_recorded,
  (
    select count(*)
    from public.intelligence_rechecks recheck
    join public.intelligence_findings finding on finding.id = recheck.finding_id
    where finding.school_id = school.id
      and recheck.status = 'completed'
  )::integer as rechecks_completed,
  (
    select count(*)
    from public.intelligence_outcomes outcome
    join public.intelligence_findings finding on finding.id = outcome.finding_id
    where finding.school_id = school.id
  )::integer as outcomes_recorded,
  (
    select round(avg(feedback.rating)::numeric, 2)
    from public.intelligence_feedback feedback
    join public.intelligence_findings finding on finding.id = feedback.finding_id
    where finding.school_id = school.id
      and feedback.rating is not null
  ) as mean_teacher_rating,
  (
    select round(avg(feedback.time_saved_minutes)::numeric, 1)
    from public.intelligence_feedback feedback
    join public.intelligence_findings finding on finding.id = feedback.finding_id
    where finding.school_id = school.id
      and feedback.time_saved_minutes is not null
  ) as mean_reported_minutes_saved,
  (
    select count(*)
    from public.intelligence_feedback feedback
    join public.intelligence_findings finding on finding.id = feedback.finding_id
    where finding.school_id = school.id
      and feedback.feedback_type = 'edited'
  )::integer as edited_artifacts,
  (
    select count(*)
    from public.intelligence_feedback feedback
    join public.intelligence_findings finding on finding.id = feedback.finding_id
    where finding.school_id = school.id
      and feedback.feedback_type = 'rejected'
  )::integer as rejected_artifacts
from public.schools school;

revoke all on table public.intelligence_evaluation_summary from anon;
grant select on table public.intelligence_evaluation_summary to authenticated;

comment on table public.intelligence_feedback is
  'Immutable teacher judgement on a generated artifact, separate from delivery and learner outcome.';
comment on view public.intelligence_evaluation_summary is
  'Funnel and quality measures for the caller-visible scope; adoption metrics are not causal impact claims.';
