# Stage 2 — Canonical pupil and department identity

Status: **implemented in code; migration generated but not yet applied**

This stage creates the stable identity layer needed by Class 360, predictions,
behaviour trends, actions and lesson generation. It is additive: existing
retrieval, MIS, Springboard, parent and assessment features keep their current
identifiers until each record is reconciled.

## The rule

One real pupil has one `pupils.id`. Every source record points to that pupil
through `pupil_source_identities`, with its source, tenant, match method,
confidence, evidence and review state.

Names are attributes, not identifiers.

- An already-linked `(school, source, tenant, record id)` is reused.
- An exact UPN or shared legacy UUID produces a proposed link.
- Name/year/form similarity always goes to review.
- An unmatched authoritative MIS pupil may create a new canonical pupil.
- An unmatched assessment, guardian or Springboard name may not.
- Ambiguity becomes a row in `pupil_identity_review_queue`; it is not hidden.

The deterministic implementation is in:

- `apps/houchell/src/lib/identity.ts`
- `apps/houchell/src/lib/identity.test.ts`

## Database contract

The generated migration is:

`apps/houchell/supabase/migrations/20260729150617_canonical_pupil_department_identity.sql`

It adds:

| Table | Purpose |
|---|---|
| `pupils` | Minimal school-scoped canonical pupil |
| `pupil_source_identities` | Provenance and review state for every linked source |
| `pupil_class_memberships` | Time-bounded canonical pupil-to-class membership |
| `pupil_identity_review_queue` | Ambiguous/conflicting identity work |
| `departments` | Canonical school department |
| `department_staff_memberships` | Time-bounded staff membership and lead role |
| `department_class_memberships` | Time-bounded class-to-department membership |

Nullable compatibility pointers are added, when the source table exists, to:

- `mis_students.canonical_pupil_id`
- `springboard_pupil.canonical_pupil_id`
- `guardian_student.canonical_pupil_id`
- `assessment_marks.canonical_pupil_id`

Retrieval profiles are linked through `pupil_source_identities` rather than
altered because their live base schema is not reconstructable from the current
repository migration bodies.

## Access model

- Department metadata is readable within the caller's school or trust scope.
- Pupil data is readable by the pupil's current class teacher, school
  leadership, or the correctly scoped trust lead.
- Identity review work is readable only by school leadership or the correctly
  scoped trust lead.
- Authenticated clients have no insert/update/delete policy on canonical
  identity tables. Reconciliation writes must use a narrow server-side
  workflow.
- Scope helpers live in the dedicated, non-exposed `intelligence_private` schema,
  return booleans only, fix `search_path`,
  use `auth.uid()`, revoke `PUBLIC`, and grant only the authenticated role.
- Anonymous access is explicitly revoked and every exposed table has RLS.

## Required apply gate

Do **not** apply the migration to the anchor merely because it exists in Git.
The repository ledger contains names for the live migrations but not all SQL
bodies, and several schema additions were applied out of band.

Before applying:

1. Pull the live anchor schema into a disposable Supabase branch.
2. Confirm the exact definitions of `profiles`, `classes`, `schools`,
   `subjects`, `mis_students`, `springboard_pupil`, `guardian_student` and
   `assessment_marks`.
3. Run the migration on that branch.
4. Test teacher, HoD, SLT, trust-lead, unrelated-school and anonymous access.
5. Run Supabase security and performance advisors; accept no new errors.
6. Backfill a small pilot school from MIS staging into `pupils` and
   `pupil_source_identities`.
7. Re-run the same sync and prove it is idempotent.
8. Review every ambiguous match and verify that no name-only merge occurred.
9. Only then promote the migration and begin compatibility-column backfills.

## What Stage 2 deliberately does not do

- It does not delete or rewrite any legacy identifier.
- It does not infer sensitive characteristics.
- It does not train a prediction model.
- It does not expose raw MIS payloads to the analytics layer.
- It does not let a generated recommendation mutate a pupil record.

Those constraints are what make the later “learning brain” auditable: every
event, feature, finding, action and outcome can point to one stable subject
while preserving where the evidence came from.
