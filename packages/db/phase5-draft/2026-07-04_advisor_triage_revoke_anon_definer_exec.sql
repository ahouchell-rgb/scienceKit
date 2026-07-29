-- PROPOSED — NOT APPLIED. Advisor triage 2026-07-04 (see the vault note
-- Engineering/Supabase Advisor Triage 2026-07-04.md for the full analysis).
-- Kills ~47 of the 110 security lints (anon_security_definer_function_executable)
-- by revoking anon EXECUTE where anon has no business. Belt-and-braces: the
-- spot-checked functions already guard with auth.uid(), so this is defense in
-- depth, not a hole-patch. Filed under phase5-draft because it belongs with the
-- Phase 5 re-gating work.
--
-- VERIFIED KEEP-ANON (do NOT revoke — anon flows depend on them):
--   parent_report            (token-gated parent links, no account)
--   topic_preview_questions  (public embed widget + /topic pages)
--   all RLS predicate helpers (is_*, can_*, user_*, has_resource_access,
--   school_plan_allows_custom_questions) — evaluated inside policies during
--   anon reads of public content.
--
-- Call-site verification (grep across apps/, 2026-07-04): create_school,
-- school_members, get_school_plans → authenticated UIs only. increment_token_usage,
-- student_weak_topics → no client callers found (candidates for removal later).

begin;

-- School / trust administration — authenticated flows only
revoke execute on function public.create_school(text) from anon;
revoke execute on function public.create_trust(text) from anon;
revoke execute on function public.link_school_to_trust(uuid, uuid) from anon;
revoke execute on function public.join_school(text) from anon;
revoke execute on function public.leave_school() from anon;
revoke execute on function public.remove_school_member(uuid) from anon;
revoke execute on function public.set_school_member_role(uuid, text) from anon;
revoke execute on function public.set_school_home_sponsored(uuid, boolean) from anon;
revoke execute on function public.review_content(uuid, text) from anon;
revoke execute on function public.offboard_school(uuid) from anon; -- already false for anon per audit; harmless if re-run

-- Analytics / reporting — signed-in staff only
revoke execute on function public.school_members() from anon;
revoke execute on function public.school_audit() from anon;
revoke execute on function public.school_classes() from anon;
revoke execute on function public.school_ai_spend() from anon;
revoke execute on function public.school_objective_mastery() from anon;
revoke execute on function public.get_ai_cost_summary() from anon;
revoke execute on function public.get_school_plans() from anon;
revoke execute on function public.trust_classes() from anon;
revoke execute on function public.trust_objective_mastery() from anon;
revoke execute on function public.class_weak_topics(uuid) from anon;
revoke execute on function public.class_objective_breakdown(uuid) from anon;
revoke execute on function public.class_unit_gaps(uuid) from anon;
revoke execute on function public.student_weak_topics(uuid) from anon;

-- Write primitives with no anon callers
revoke execute on function public.increment_token_usage(uuid, integer) from anon;
revoke execute on function public.log_audit(text, text, jsonb) from anon;

-- Auth triggers (run as owner; the grant is unnecessary)
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_sciencekit_user() from anon;
revoke execute on function public.enforce_question_shared_guard() from anon;

commit;

-- ⚠️ SIGNATURES ARE BEST-GUESS where not confirmed. Before applying, generate
-- exact signatures with:
--   select format('revoke execute on function public.%I(%s) from anon;',
--                 p.proname, pg_get_function_identity_arguments(p.oid))
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname='public' and p.prosecdef
--     and has_function_privilege('anon', p.oid, 'EXECUTE')
--     and p.proname not in ('parent_report','topic_preview_questions', <predicate helpers…>);
-- Then smoke-test: the embed widget, /topic pages, a parent link, and school creation.

-- ── Separate quick wins (also NOT applied) ─────────────────────────────────
-- 1. leads: two duplicate always-true INSERT policies (leads_insert_public +
--    leads_insert_anon) and duplicate moderator SELECT policies. Keep one of each:
--      drop policy if exists "leads_insert_anon" on public.leads;
--      drop policy if exists "leads_select_mod" on public.leads;
--    (also clears the 2 rls_policy_always_true WARNs' duplication noise; the
--    remaining always-true INSERT is the public lead-capture form — intended.)
-- 2. rls_enabled_no_policy on anon_funnel_events / anon_mark_usage /
--    stripe_webhook_events: INFO-level; deny-by-default is intended
--    (service-role-only writes). Document, don't change.
-- 3. auth_leaked_password_protection: DASHBOARD toggle, not SQL —
--    Dashboard → Authentication → Providers → Email → enable
--    "Prevent use of leaked passwords". This is priority-stack item #1.
