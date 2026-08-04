# School Intelligence — Stage 13 curriculum knowledge graph

Status: implemented locally. Database activation remains behind the same Supabase development-branch gate as Stages 7–12.

## Outcome

Stage 13 turns the existing curriculum into a governed knowledge graph without replacing the canonical `objectives` table.

Each objective can now have:

- a reviewed objective profile, success criteria and demand metadata;
- typed links to other objectives:
  - `prerequisite_of`;
  - `supports`;
  - `extends`;
  - `contrasts_with`;
  - `part_of`;
- a stable misconception taxonomy and objective mappings;
- a stable Tier 2/3 vocabulary taxonomy and objective mappings;
- resource coverage links;
- global canon plus school-scoped variants;
- provenance, confidence, source kind and a human review decision.

The graph workbench is at `/curriculum/graph`. Objective 360 and the live intelligence surface link directly into the relevant curriculum neighbourhood.

## Safety and governance

The graph is an assertion system, not an autonomous curriculum author.

- Sequence-derived links, existing lesson keywords and existing misconception alerts are seeded as `proposed`.
- No machine- or sequence-derived assertion is automatically approved.
- Lesson generation reads `approved` rows only.
- A database trigger prevents prerequisite cycles, including cycles created by the combination of global canon and a school variant.
- Approved recursive traversal is bounded to a maximum of 12 levels.
- School variants are protected by school/trust read scope.
- Authenticated clients have read-only table access; mutation goes through the curriculum-lead route.
- Every proposal, batch seed and review decision is recorded in the append-only `curriculum_graph_events` ledger.
- The graph stores curriculum content, not pupil evidence.

## Product surfaces

- `/curriculum/graph`
  - subject and school-scope selection;
  - objective search;
  - prerequisite → current objective → next-objective visualisation;
  - misconception and vocabulary neighbourhood;
  - curriculum coverage metrics;
  - typed relationship proposal;
  - approve/reject review queue;
  - conservative proposal seeding from existing lessons.
- `/api/intelligence/curriculum-graph`
  - caller-JWT, RLS-bounded graph reads through one capped graph bundle;
  - leadership-gated school mutation;
  - idempotent proposal seeding;
  - cycle-aware typed link creation;
  - auditable review decisions.
- `/api/intelligence/response`
  - loads only approved graph context;
  - freezes that context inside the immutable generation snapshot;
  - injects prerequisites, progression, misconceptions and vocabulary into the lesson-generator focus;
  - records `reviewed_curriculum_graph_v1` in artifact lineage;
  - degrades safely if Stage 13 has not yet been activated.

## Database contract

Migration:

`20260729180000_stage13_curriculum_knowledge_graph.sql`

New tables:

- `curriculum_objective_profiles`
- `curriculum_objective_links`
- `curriculum_misconceptions`
- `curriculum_objective_misconceptions`
- `curriculum_vocabulary`
- `curriculum_objective_vocabulary`
- `curriculum_resource_objectives`
- `curriculum_graph_events`

New bounded traversal:

- `curriculum_prerequisite_chain(objective, school, direction, max_depth)`

New bounded workbench read:

- `curriculum_graph_bundle(subject, school, objective_limit)` — capped at 600
  objectives and used for both display and idempotent seeding, avoiding
  oversized UUID-list REST requests.

## Activation and evaluation gate

After applying the Stage 7–12 migrations on a development branch:

1. Apply `20260729180000_stage13_curriculum_knowledge_graph.sql`.
2. Verify anon has no graph-table or traversal access.
3. Verify a teacher can read shared canon and their school variant but cannot mutate.
4. Verify HoD/SLT can seed and review only an authorised school scope.
5. Verify a trust lead can work only within schools in their trust.
6. Attempt a three-node prerequisite cycle and confirm the database rejects it.
7. Seed one subject twice and confirm the second run creates no duplicate active assertions.
8. Approve one complete objective neighbourhood: profile, prerequisites, vocabulary taxonomy/mappings and misconception taxonomy/mappings.
9. Generate the same reviewed response before and after approval. Confirm only the approved run freezes graph context.
10. Compare both decks for curriculum accuracy, prerequisite handling, misconception quality, teacher editing and reported time saved.
11. Run Supabase security and performance advisors and require no new errors before production planning.

Production remains untouched until this branch gate is completed and reviewed.

## Local verification

- `npm test` — all workspaces passed; web 30 files / 211 tests, retrieval 6 files / 45 tests. The database contract test was skipped because `DATABASE_URL` is not set.
- `npm run typecheck` — passed.
- `npm run build` — both Next.js applications passed.
- `git diff --check` — passed.

The build emitted only the existing sandbox warning that Google Fonts could not be downloaded for optimisation.
