# School Intelligence — Stages 7–12 implementation

Status: implemented locally on `feat/intel-console`; database activation is intentionally pending a Supabase development-branch gate.

The product boundary is:

> Which modifiable constraint is most likely binding, what is the next reversible response, and what evidence would change our mind?

It is **not** a universal pupil risk score, an automated behaviour judgement, or a causal claim engine.

## Stage 7 — security and activation gate

- Interactive school/trust analytics now call retrieval RPCs with the user's JWT; they no longer send `x-sciencekit-key`.
- `class_intervention_list` is enforced as SLT-only at the database boundary.
- Anonymous execution is revoked from the in-scope `SECURITY DEFINER` helpers and RPCs.
- Server-only parent/cron aggregate callers retain their current migration-window compatibility.

Migration: `20260729170000_stage7_interactive_rpc_security.sql`

## Stage 8 — canonical identity operations

- Leadership review queue for retrieval-profile reconciliation.
- Explicit link, explicit create, or dismiss-with-reason; no silent name merge.
- Class memberships retain the source identity that established them.
- Every decision has append-only history.

Routes:

- `/manage/identity`
- `/api/intelligence/identity`

Migration: `20260729171000_stage8_identity_review_history.sql`

## Stage 9 — immutable evidence spine

- `education_events` is the append-only event ledger with tenant, pupil/class/objective scope, source identity, schema version, sensitivity and provenance.
- Existing retrieval responses can be backfilled idempotently, but only for reviewed canonical pupils.
- Learner/class state uses simple Beta smoothing and always returns evidence count, recency, source mix, uncertainty and model version.
- The synthetic intelligence lab remains available at `/intel`; live evidence is separate at `/intel/live`.

Routes:

- `/intel/live`
- `/api/intelligence/live`

Migration: `20260729172000_stage9_immutable_education_event_ledger.sql`

## Stage 10 — evidence-to-generation lineage

- Before lesson generation, the system freezes an immutable context containing:
  - the reviewed finding and baseline;
  - the current aggregate learner state, when available;
  - unit and lesson selection;
  - the versioned generation contract;
  - model/read-model versions.
- The generated artifact points to that exact snapshot.
- The contract requires misconception confrontation, a diagnostic hinge, guided practice and a delayed parallel recheck.
- Fixed-risk and unsupported causal claims are explicitly prohibited.

Migration: `20260729173000_stage10_generation_context_lineage.sql`

## Stage 11 — feedback and evaluation

- Generated and delivered deck content receives a deterministic SHA-256 fingerprint.
- Delivery records whether the deck changed after generation.
- Delivery + recheck scheduling and recheck + outcome completion are each
  committed by one service-only, invoker-rights transaction. Delivery retries
  use a stable idempotency key.
- Teachers can record rating, edit/accept/reject judgement and reported time saved.
- Evaluation keeps the funnel separate: finding → accepted action → artifact → delivery → recheck → outcome.
- Adoption, teacher rating, reported time saving and descriptive outcome are never collapsed into one score.

Routes:

- `/intel/evaluation`
- `/api/intelligence/evaluation`

Migration: `20260729174000_stage11_feedback_and_evaluation.sql`

## Stage 12 — cross-domain evidence

- Audited, idempotent CSV import for attendance sessions and literacy screens.
- Every imported pupil must resolve through an already-reviewed source identity.
- Invalid and unresolved rows are counted and retained in the ingest-run summary, not guessed.
- Accepted observations are mirrored into the shared immutable event ledger.
- Class views combine objective learning, 28-day attendance exposure and recent reading standardised-score coverage.
- The interpretation layer returns a bounded hypothesis, evidence status and next check. It does not produce a behaviour prediction or a root-cause declaration.

Routes:

- `/manage/intelligence-data`
- `/api/intelligence/import`

Migration: `20260729175000_stage12_cross_domain_evidence.sql`

## Activation gate

Do not apply these migrations directly to the production anchor first.

1. Create a Supabase development branch from `uvzukwoxqhcxaxtzrziy`.
2. Apply migrations from `20260729150617` through `20260729175000` in order.
3. Run the role matrix:
   - teacher: own class aggregate only;
   - HoD: permitted school/department aggregates, no named intervention list;
   - SLT: school aggregates and named intervention list;
   - trust lead: trust aggregates, no named intervention list unless separately authorised;
   - anon: none of the intelligence RPCs/tables/views.
4. Seed retrieval identities; confirm no name-only auto-link occurs.
5. Reconcile two test pupils, run the retrieval event backfill twice, and confirm the second run inserts zero duplicates.
6. Generate a response deck, edit it, deliver it, complete its recheck and verify the entire lineage/event history.
7. Import a small attendance and literacy fixture containing valid, invalid, duplicate and unresolved rows.
8. Run Supabase security/performance advisors and compare against the recorded production baseline. The gate is “no new errors”, not “all legacy warnings fixed”.
9. Only then plan a reviewed production migration window and rollback/forward-fix runbook.

Supabase returned a development-branch cost of **0.01344 per hour** on 29 July 2026 (the connector response did not label the currency). Creation requires explicit cost confirmation.

## Verification completed locally

- `npm test` — all three workspaces passed; web 30 files / 211 tests, retrieval 6 files / 45 tests, database contract skipped because `DATABASE_URL` is not set.
- `npm run typecheck` — passed.
- `npm run build` — both Next.js applications passed.
- `git diff --check` — passed.

The build logged only the existing sandbox warning that Google Fonts could not be downloaded for optimisation.
