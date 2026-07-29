# Existing Assets Audit — Houchell Education monorepo

> Audit run 2026-07-27 against HEAD `254607a` (last commit 2026-07-07), branch
> `feat/springboard-progressive-diagrams`. Purpose: inventory what already exists that a
> "school intelligence platform" (Palantir-Gotham-for-education) could build on.

## 0. Critical framing finding

**There is no committed schema source of truth.** `packages/db/migrations/` contains only
`LEDGER.json` (118 lines, 110 migration *names*, no SQL bodies) and a README saying the
bodies must be reconstructed via `supabase db pull` against live project
`uvzukwoxqhcxaxtzrziy`. The two app-local migration sets
(`apps/houchell/supabase/migrations/` — 47 files; `apps/retrieval/db/migrations/` — 53
files) are *partial and historically divergent* snapshots that were ported into the anchor
out-of-band. `packages/db/live-defs/ROLE_MODEL.md:1-20` explicitly says the role model
"was applied out-of-band (hence absent from the repo migrations)".

**Anything a new platform builds must start by reconstituting the real schema from the
live DB.**

---

## 1. Data model

### Multi-tenancy (trust → school → class → pupil)

| Table | File | Key columns |
|---|---|---|
| `trusts` | `apps/houchell/supabase/migrations/20260620_trusts_mat.sql:15-20` | id, name |
| `schools` | `.../20260620_schools_roles.sql:22-28` + `20260620_trusts_mat.sql:35-37` | id, name, **urn**, trust_id, (later: join_code, home_sponsored) |
| `profiles` | `20260620_schools_roles.sql:47-57`, `20260620_trusts_mat.sql:46-51` | role, **school_id**, **school_role** ∈ {member,hod,slt}, **trust_id**, **trust_role** ∈ {member,trust_lead}, `hod_id`, `is_lead`, `retrieval_*`, stripe/subscription cols |
| `classes` | `20260512_week1_timetable_and_classes.sql:17`, `+school_id` via `apps/retrieval/db/migrations/20260618_03_tenant_school_stamp_and_search_path.sql` | teacher_id→profiles, name, year_group, discipline, key_stage, tier, join_code UNIQUE, archived, `retrieval_class_ids uuid[]`, school_id |
| `class_members` | retrieval core (body not in repo) | class↔pupil |

**There is no `departments` table.** `docs/SLT_DASHBOARD.md:74-76` admits it: "`hod`
currently sees the whole school's science… Split by department when multi-subject lands."
Trust→school→class is real; school→department→class is not.

### Users / roles

- `profiles.role` ∈ `{student, teacher, hod, moderator, admin}`; helpers `is_moderator()`,
  `is_hod()`, `is_staff()`, `is_admin()`, `user_school_id()`, `user_teaches_class()` —
  verbatim in `packages/db/live-defs/ROLE_MODEL.md:26-36`.
- **No `is_slt()` / `user_trust_id()` helpers** exist; RPCs inline the predicate (line 37-38).
- **No staff records table** — no contracts, timetable allocation, line management (beyond
  the `profiles.hod_id` pointer), performance/CPD.

### Assessment / questions / answers (two parallel systems)

- **Retrieval spine (canonical, bodies NOT in repo):** `topics`, `questions`, `responses`
  (student_id, class_id, question_id, is_correct, student_answer, ai_feedback,
  answered_at), `papers`, `paper_questions`, `paper_attempts`, `paper_responses`
  (marks_awarded/marks_max), `marking_flags`, `class_topics`, `lesson_deliveries`,
  `parent_tokens`, `ai_usage`. Enumerated by
  `apps/retrieval/db/migrations/20260614_11_deletion_offboarding.sql:4-6`.
- **Assessments/QLA (houchell):** `assessments`, `assessment_questions`, `assessment_marks`
  — `apps/houchell/supabase/migrations/20260621_assessments.sql:11-42`.
  **Weakness:** `assessments.students text[]` is a roster of *names* (line 16) and
  `assessment_marks.student_ref text` (line 38) — **no FK to any pupil identity**. QLA
  cannot be joined to the mastery graph at pupil grain.

### Objectives / mastery graph

- `subjects`, `strands`, `curriculum_specs`, `objectives` —
  `20260620_subject_foundation.sql:13-58`.
- **`objectives` is defined twice with conflicting shapes**:
  `20260620_subject_foundation.sql:47` (strand_id/spec_id) vs
  `20260621_mastery_graph_objectives.sql:24-46` (unit_id/lesson_id/spec_ref), which patches
  columns in with `ADD COLUMN IF NOT EXISTS` and comments on the collision at lines 37-43.
  Real schema drift.
- `topic_objective_map` (topic_id PK → objective_id) —
  `20260621_mastery_graph_objectives.sql:71-80`; `topic_map` crosswalk —
  `apps/retrieval/db/migrations/20260615_01_topic_map_crosswalk.sql:4`.
- Views: `objective_mastery` (class × topic, security_invoker) —
  `20260615_02_objective_mastery_views.sql:4-32`; `class_weak_objectives` (marked≥5,
  ranked) — same file line 36; **`pupil_objective_mastery`** (class × pupil × objective,
  blends retrieval 1-mark-per-Q with paper marks) —
  `20260621_05_blended_objective_mastery.sql:29-70`. This is the genuine "mastery graph"
  node and it is real and applied (header: APPLIED 2026-06-21, 27 rows).
- `springboard_objective_mastery` view — `20260629_springboard_objective_mastery.sql:172`.

### Misconceptions

- `class_misconception_inputs()` RPC (per-question wrong-answer rollup, security
  **invoker**, no pupil ids returned) + `class_misconception_runs` cache table —
  `apps/retrieval/db/migrations/20260619_03_class_misconceptions.sql:16-100`. AI clustering
  runs in edge fn `apps/retrieval/supabase/functions/class-misconceptions/`.
- **There is no misconception *taxonomy* table** — no named, reusable misconception codes.
  It's cached LLM output per class per run. `docs/LEARNING_INTELLIGENCE_OS_PLAN.md:52`
  correctly marks "Misconception Engine v1" as **Partial**.

### Interventions

No `interventions` table. `class_intervention_list(p_class_id, p_threshold, p_subject)` RPC
returns pupils below a mastery threshold; `/school/intervention` renders + CSV-exports it.
**No record of what intervention was assigned, to whom, or whether it worked.**

### Marking

`marking_flags` (+ review columns, HoD resolve); `20260618_07_marking_review.sql`.
`paper_feedforward_sheets`, `feedforward_sheets`, `feedforward_decks`.
**`marking_gold` / eval harness does not exist** — stated as MISSING in
`docs/LEARNING_INTELLIGENCE_OS_PLAN.md:50,64-70`.

### Parent reports

`guardians`, `guardian_student` (consent_status pending/granted/revoked,
unsubscribe_token), `parent_reports` — `20260620_parent_reports.sql:28-126`.
**`guardian_student.student_id` has no FK** (line 66) and MIS import leaves it null
(`docs/MIS_SYNC.md:88`), so reports degrade to class-level.

### Audit

`audit_log(actor_id, action, target, detail jsonb, at)` — `20260621_audit_log.sql:9-24`.
Service-role write, actor-only read. `log_audit()` SECURITY DEFINER stamps `auth.uid()`
(`20260621_audit_role_rpcs.sql:19-31`). `school_audit(p_limit)` gives slt a school-wide
view (`20260621_school_audit_read.sql:13-45`).

### Everything else already present

Billing (`plans`, `subscriptions`, `stripe_webhook_events`), AI cost
(`daily_token_usage`, `ai_usage`, `school_ai_spend()`), snapshots
(`school_benchmark_snapshots`, `trust_benchmark_snapshots`, `cohort_outcomes`), MIS
staging (below), content pipeline (`content_items`), curriculum/planning (`units`,
`lessons`, `groups`, `lesson_sow`, `lesson_slides`, `class_timetable_slots`,
`timetable_calendar`, `holiday_periods`, `class_progress`, `resource_map`,
`topic_resources`, `topic_booklets`), OAuth token stores (`google_tokens`,
`microsoft_tokens`), funnel (`anon_funnel_events`, `anon_mark_usage`, `leads`), ops
(`cron_runs`, `support_tickets`).

### What a full school-data platform needs and **does not exist at all**

Attendance · behaviour/incidents/detentions · homework setting & completion (beyond a
springboard state blob) · **whole-school timetable** (`class_timetable_slots` is
owner-scoped and teacher-personal) · reading age / literacy screening · **SEND register /
EHCP / provision map** · **PP / FSM6 / LAC / EAL / disadvantage flags** — grep for
`pupil_premium|sen_status|eal|reading_age|attendance|behaviour_` across all 100 migrations
returns **zero hits** · staff records/CPD/appraisal · safeguarding · exams
entries/results · careers/destinations · finance.

Note `docs/SECONDARY_ED_STRATEGY.md:186,202` *promises* PP/SEND/EAL demographic flags from
Wonde — never built.

---

## 2. Security posture

**Pattern (consistently applied, and genuinely good):** every base table is owner-scoped
RLS (`teacher_id = auth.uid()`); every cross-org read is exactly one role-gated
`SECURITY DEFINER` RPC; no client-writable path to elevate your own role.
`docs/SYSTEM_ANALYSIS.md:31-34` states it; the migrations bear it out.

- School scope: `school_classes()` — `20260620_schools_roles.sql:66-97` (returns nothing
  unless `school_role ∈ (hod,slt)` **and** teacher's school matches).
- Trust scope: `trust_classes()` — `20260620_trusts_mat.sql:61-91` (`trust_role =
  'trust_lead'`).
- Views use `security_invoker = true` (`20260615_02_...:5`, `20260621_05_...:31`) so RLS
  applies.
- Hardening migrations exist: `harden_function_search_path`,
  `optimize_rls_auth_uid_initplan`, `scope_profiles_select_policy`,
  `lock_down_profiles_privileged_columns`, `restrict_profiles_update_to_display_name`,
  `grade_integrity_lockin`, `tier0_drop_school_default_and_gate_schoolless`.

### Weaknesses / open risks

1. **The shared secret is still live on interactive paths.** `x-sciencekit-key` (header vs
   `private.app_config.sciencekit_key`) is an OR-branch in six RPCs. Phase 5 additive steps
   `01`+`02` **are applied** (`packages/db/phase5-draft/README.md:3-8`) but the **app PR is
   only half-landed**: `api/teacher/overview/route.ts:22` has dropped it, while
   `api/school/overview/route.ts:42,53,63`, `api/school/intervention/route.ts:34,45,55` and
   `api/trust/overview/route.ts:37,48,58` **still send the secret**.
   `03_subtractive_drop_secret.sql` is unapplied and the key un-rotated. Anyone holding
   that secret can read any class's analytics and (via `class_intervention_list`) **named
   pupils**, with no JWT.
2. **`04_assign_leadership_roles.sql` is a template and "all profiles are `'member'`
   today"** — so the identity gate that is supposed to replace the secret currently grants
   nobody anything.
3. **Single database, all tenants.** `docs/SYSTEM_ANALYSIS.md:40-42`: "RLS is the only
   isolation boundary… the blast radius is the whole customer base." No `org_id` hard
   partition.
4. **Audit coverage is partial and structurally fragile.** Only 3 route calls exist
   (`api/account/export`, `api/mis/sync`, `api/mis/writeback/run`). `audit_log` has **no
   `school_id`**; `school_audit()` joins tenancy through `profiles.school_id` **of the
   actor** (`20260621_school_audit_read.sql:39-40`) — if a member leaves or changes school
   the trail moves or disappears. No append-only/immutability guarantee.
5. **Two HoD models coexist**: legacy `profiles.hod_id` pointer vs `school_role='hod'` +
   school match. `docs/PHASE5_DESIGN.md:46-50` flags standardisation as unverified.
6. **Zero tests on the security surface.** `docs/SYSTEM_ANALYSIS.md:65-67`.
7. **No rate limiting** on public/AI routes (`SYSTEM_ANALYSIS.md:83`).
8. Historic recursion bug (`fix_paper_rls_infinite_recursion`) shows the RLS surface is
   genuinely intricate.

---

## 3. MIS sync — implemented vs documented

**Actually implemented** (`apps/houchell/src/lib/wonde.ts`, 235 lines):

- `fetchSchool()` line 81 → `GET schools/{id}/students?include=contacts.contact_details,year`
  → `mis_students` (name, year_group, form, upn, raw) + `mis_contacts`.
- `fetchClasses()` line 99 → `GET schools/{id}/classes?include=students,subject` →
  `mis_classes` + `mis_class_students`.
- Paginated (200/page, 200-page cap), 20 s timeout, service-role staging upserts,
  env-gated on `WONDE_TOKEN`/`WONDE_SCHOOL_ID`.
- `runMisSync` (140), `enqueueWriteback` (169), `runWriteback` (210, 3 retries),
  `ensureConnection` (230).
- Routes: `/api/mis/sync`, `/api/mis/status`, `/api/mis/import-guardians`,
  `/api/mis/writeback/{enqueue,run}`; crons `mis-sync` (03:00) & `mis-writeback` (03:30).

**Documented-only / not real:**

- **Never run against a live MIS.** `docs/MIS_SYNC.md:84-85`: write-back is "**unverified**
  against a live MIS (no Wonde credentials here)."
- **Single school, token in env** — MAT/multi-school "needs a per-connection token store."
- **No demographics.** `SECONDARY_ED_STRATEGY.md:202` promises PP/SEND/EAL — the schema has
  no such columns and `wonde.ts` requests no such includes.
- No attendance, behaviour, timetable, or assessment-in from the MIS.
- Guardian import leaves `student_id` null.

---

## 4. Dashboards & analytics

| Surface | Route | Page |
|---|---|---|
| Teacher | `api/teacher/overview/route.ts` (105 ln) | `/teacher` |
| SLT/HoD | `api/school/overview/route.ts` (171 ln) | `app/school/page.tsx` (711 ln) |
| Intervention export | `api/school/intervention/route.ts` (107 ln) | `app/school/intervention/` |
| Impact/efficacy | `lib/impact.ts` (174 ln) | `app/school/impact/` (+ `/print`) |
| Trust/MAT | `api/trust/overview/route.ts` (138 ln) | `app/trust/page.tsx` (206 ln) |

**What it actually computes today:**

- Per-class weakest objectives via `class_weak_topics(...)`, fanned out with a bounded pool
  (`mapPool`, `lib/trustBenchmark.ts:59`) — `school/overview/route.ts:141-158`.
- Blend of retrieval + common-assessment QLA per objective: `blendObjectiveMastery(...)` —
  `route.ts:119-122,160-163`, `lib/mastery.ts` (147 ln), joined on `topic_objective_map`
  ids with name fallback (`crosswalkMap`, line 139).
- Snapshot-first paint from `school_benchmark_snapshots` with `?live` hydrate —
  `route.ts:106-130`; weekly crons `school-snapshots` (Sun 04:30) / `trust-snapshots`
  (Sun 04:00).
- Trust rollup: per-school avgMastery + weakest + trustAvg + trend sparkline.
- `lib/impact.ts`: `baselineSnapshot`, `OverallTrend` (first/latest/delta/weeks),
  per-objective improvement deltas, plus a templated governors/Ofsted narrative line — the
  closest thing to a "leadership insight engine" in the repo.
- `cohort_outcomes` recorded by SLT to correlate mastery trend against real results.

**Insight ceiling:** everything is *% correct per objective, per class, per school*. No
cohort segmentation (no PP/SEND to segment by), no pupil-risk scoring, no cross-domain
correlation (attendance × attainment), no forecasting, no entity resolution across sources.
Aggregation is **app-layer fan-out**, not a warehouse — `SYSTEM_ANALYSIS.md:75-77` flags
this as an O(classes) scaling problem at MAT size.

---

## 5. Compliance assets

`docs/buyer-pack/` — built 2026-07-08, step 5 of the 90-day plan:

- `01-data-processing-agreement.md` (184 ln) — UK GDPR Art. 28 processor agreement,
  Annexes A/B/C, pre-filled to the real architecture. **Status: template, never legally
  reviewed.**
- `02-dpia-prefilled.md` (106 ln) — ICO-structured, supplier-side pre-filled, `[SCHOOL]`
  gaps marked. Genuinely good; describes real data flows including "no name attached" to
  the Anthropic call and the human-in-the-loop MarkReview queue.
- `03-dfe-genai-safety-mapping.md` (47 ln) — DfE GenAI product-safety expectations map.
- `04-security-and-data-residency-statement.md` (69 ln).
- Outstanding founder TODOs: no monitored `security@` inbox, no legal read-through, MFA
  unconfirmed on Supabase/Vercel/GitHub/registrar.

`apps/houchell/src/app/trust-centre/page.tsx` (178 ln) — public, outside auth. 8-row
sub-processor table with regions and vendor DPA links (Supabase eu-west-2 London,
Anthropic US, Stripe, Resend, Wonde, Google, Microsoft, Vercel); 5 data principles. Header
comment lines 5-7 still says "FOUNDER TODOs… confirm region, DPO email, certification
status."

**Quality:** unusually strong for pre-revenue — a real, sendable pack. **Missing:** no ISO
27001/Cyber Essentials, no pen test, no incident-response runbook, no DSAR workflow beyond
`export_student_data()`, no retention automation, no accessibility statement (WCAG 2.2 is a
public-sector procurement gate and is explicitly *not done* — `SYSTEM_ANALYSIS.md:85-86`).

---

## 6. Strategic docs — commitments and constraints already set

### `docs/BET_OR_PIVOT_REVIEW_2026-07-08.md` (303 ln) — the binding document

**Verdict: CONTINUE-BUT-REFOCUS**, ~85 % confidence. Spearhead is the **marking →
misconception → mastery graph → intervention → SLT dashboard loop, sold per science
department at £500–1,500/yr**. Springboard demoted to demo/support module — **frozen**
("zero net-new content or diagram work until the eval harness exists", line 38).

**Dated kill criteria (lines 46-54) — live commitments:**

1. Gable Hall follow-up unsent by **21 Jul 2026** → drop B2B, go home-ed D2C or reclassify
   as hobby.
2. By **30 Sep 2026** no pilot running in own department AND commits still
   Springboard-dominated → same.
3. By **31 Dec 2026** golden-set eval can't hit ~90 % agreement → marking wedge dead.
4. Autumn half-term: <half of pilot teachers still setting work by week 6 → workflow thesis
   failed.
5. By **31 Mar 2027** zero PO/invoice despite completed pilot → channel fails; pivot or
   license.
6. Competitive: Sparx Science / Carousel ship written-answer misconception diagnosis first
   (18–24 mo window).
7. Sustainability: ~0 habits/goals through autumn reviews → cut scope.

**Go/no-go already calendared: January 2027.** Named fallback: home-educator D2C.
Recommended allocation: ~70 % pilot-first B2B proof work, ~20 % D2C/exam products, 10 %
buffer.

⚠️ **The commit log contradicts the plan.** Last commit `2026-07-07`, HEAD is
`feat(springboard): redraw all 117 build-up diagrams` — the freeze was declared 8 July, one
day after the last commit, and nothing has been committed since. 406 commits total.

### `docs/LEARNING_INTELLIGENCE_OS_PLAN.md` (150 ln)

Gap map (34-56) marks Built: retrieval app, layered marking, teacher/HoD/SLT/MAT
dashboards, multi-tenancy, MIS sync, parent reports, mastery graph. **MISSING**:
marking-accuracy eval/golden set (50, "the single most important item"), GCSE Answer
Builder (51), hinge questions (55), Practical Simulator (54). **Partial**: Misconception
Engine (52), Intervention Generator (53), DPA pack (56).

**Three non-negotiables (134-142):** don't dilute the wedge (marking eval + misconception
engine + intervention is "the money zone"); tagging discipline is the moat; marking trust
before any subject expansion.

Pricing ladder (121-129): Teacher £8-15/mo · Dept £1.5-5k/yr · MAT £20-100k/yr · Parent
£6-12/mo · CPD £1-3k.

### `docs/SECONDARY_ED_STRATEGY.md` (252 ln)

"Own the data spine, sell views of it." One mastery graph, three buyers (teacher PLG /
school+MAT B2B / parent D2C). Named risks §7: UK GDPR + Age-Appropriate Design Code;
**"don't weaponise teacher analytics"** (218-220) — surface cohorts/objectives, never
league-table individual teachers; exam-board spec alignment; MIS access is long-lead
commercially.

### `docs/SYSTEM_ANALYSIS.md` (183 ln)

Architecture sound; gaps are **testing, cross-repo contracts, performance switch-on,
objective-level data unification** (182). P0 list (105-117) includes testing the security
surface and auditing role RPCs. Still open: accessibility, observability (no
Sentry/cron alerting/dead-letter), crosswalk coverage.

### `docs/perfect-school/` (blueprint + ACTION_PLAN.md, 162 ln, 17 Jul 2026)

Separate, longer-horizon exercise: an ideal 2–18 all-through school for a
high-deprivation/high-SEND catchment (~1,520 pupils, ~£12.7–13.5m). ACTION_PLAN is a
**personal career plan**: routes C→B→A with D always on; headship target **~2034–36**;
ECT2 + TLR3 in 2026-27; **standing induction override — if ECT2 assessment is at risk, all
discretionary venture work pauses immediately**; Route C check summer 2027 (if no second
school adopts after a completed pilot, stop selling). This document is the strongest
constraint on *available hours*.

---

## 7. Stack

- npm workspaces + **Turbo 2.x** monorepo. 406 commits, HEAD 2026-07-07.
- **Next.js 14.2.3 App Router**, React 18, TypeScript 6, **Vitest 4**. Deployed on
  **Vercel** (`apps/houchell/vercel.json` defines 6 crons; a 7th, `halfterm-feedforward`,
  at 06:00 daily).
- `apps/retrieval` — Next 14, separate app, plus **Supabase Edge Functions** (Deno):
  `mark-answer`, `mark-paper-answer`, `mark-preview`, `generate-questions`,
  `class-misconceptions`, `manage-student`, `emit-funnel-event`, with per-subject marking
  overlays in `_shared/marking/overlays/`.
- `apps/interactive` — **static HTML**, built by `apps/interactive/build.py`.
- **Supabase** (Postgres + Auth + Storage), single "anchor" project
  `uvzukwoxqhcxaxtzrziy`, **AWS eu-west-2 (London)**. Access via **raw PostgREST `fetch`**
  — no `@supabase/supabase-js` dependency anywhere (`lib/supabaseRest.ts`,
  `lib/serverHelpers.ts`).
- Auth: Supabase Auth (email/password); pupils and parents use **magic-link tokens instead
  of accounts** (`springboard_pupil.token`, `parent_tokens`,
  `guardian_student.unsubscribe_token`). `SYSTEM_ANALYSIS.md:93-94` calls parent auth "ad
  hoc — three different token mechanisms". Per-teacher Google/Microsoft OAuth for
  Slides/Drive import only.
- **LLM:** Anthropic Messages API called directly over `fetch`
  (`serverHelpers.ts:16,85`). Model constants at `serverHelpers.ts:24`. Routing via
  `pickModel`. Edge marking functions use prompt caching (4096-token cache floor,
  `_shared/marking/base-retrieval.ts:12`). Budgeting in `lib/aiBudget.ts` (per-teacher daily
  cap + `AI_ORG_MONTHLY_CAP_GBP` via `school_ai_spend()`).
- **No ETL/analytics tooling whatsoever** — no dbt, no warehouse, no queue, no BI.
  Aggregation is Node fan-out plus two weekly snapshot cron tables.
- CI: `.github/workflows/db-contract.yml` (postgres:16 service, apply migrations, run
  contract test) — **but it cannot actually work**, because `packages/db/migrations/` has
  no SQL bodies.

---

## Summary

### Genuinely reusable

The **tenancy and authorisation spine** is the crown jewel. `trusts → schools →
profiles(school_id, school_role, trust_id, trust_role) → classes` exists, is applied on the
live anchor, and is in active use. The pattern — every base table owner-scoped by RLS,
every cross-org read exactly one role-gated `SECURITY DEFINER` RPC, no client-self-assignable
roles — is consistently applied across ~100 migrations and 25 contract-verified RPCs. That
is a year of unglamorous work a new platform would otherwise repeat, and it is exactly the
layer a Gotham-style product needs first.

Second, the **mastery graph is real, not aspirational**. `pupil_objective_mastery` plus
`topic_objective_map` is a working per-pupil learning-state model with a curriculum
crosswalk. Nothing else in the repo comes close as a differentiated data asset.

Third, **compliance and leadership-analytics scaffolding**. The buyer pack and the public
Trust Centre are sendable today and are a genuine procurement moat. `lib/impact.ts`, the two
snapshot tables, `cohort_outcomes`, `audit_log`/`log_audit()`/`school_audit()`, and the
Wonde client are directly reusable plumbing.

### Biggest gaps

1. **No schema source of truth.** 110-row ledger, zero SQL. CI contract job cannot run.
   Highest-priority remediation before anything is built on top.
2. **No school data, only science-lesson data.** No attendance, behaviour, homework,
   whole-school timetable, reading age, SEND register, or PP/FSM/EAL/LAC flags — zero grep
   hits across all 100 migrations. No staff records, no `departments` table. A school
   intelligence platform needs precisely the entities that are absent; what exists is one
   deep vertical slice of one subject.
3. **Identity is fragmented.** Retrieval pupils, `assessment_marks.student_ref` (a *name
   string*), `guardian_student.student_id` (no FK, nullable), `springboard_pupil`, and
   `mis_students` are five unresolved representations of a child. Entity resolution is the
   foundational unbuilt piece.
4. **Unfinished security work.** Phase 5 additive applied but app PR half-landed; three
   routes still send `x-sciencekit-key`; `03_subtractive` unapplied; key unrotated; all
   profiles still `'member'`. Zero tests cover RLS or any definer RPC.
5. **Analytics is app-layer fan-out, not a platform.** No warehouse, ETL, or queue.
   Dashboards issue O(classes) HTTP RPCs per page load.

### New app or extension?

**Extend the data platform; build a new app surface.** Forking the schema would abandon the
multi-tenancy, RLS pattern, audit trail and compliance pack — the assets hardest to rebuild
and most load-bearing for a school buyer. But bolting attendance, behaviour, SEND and staff
onto `apps/houchell` — a 700-line inline-styled dashboard page with no accessibility work
and no route tests — would be a mistake.

Concretely: reconstitute the schema into `packages/db` from the live anchor; finish Phase 5
and populate leadership roles; add a canonical `students` entity with resolution to all five
existing identifiers; then build the intelligence surface as a **new app in the monorepo**
sharing `packages/db`, with a real read-model layer rather than RPC fan-out.

**Scope honesty flag:** the dated kill criteria (Bet-or-Pivot, 8 Jul 2026) set a January
2027 go/no-go, name the marking-eval golden set as the gate, and explicitly warn against
diluting the wedge. A Palantir-for-education platform is a *much* larger bet than the
department-level marking wedge those criteria were written for. Worth deciding deliberately
whether this supersedes that plan or violates it.
