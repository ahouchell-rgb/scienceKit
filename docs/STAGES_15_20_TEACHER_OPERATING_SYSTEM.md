# Stages 15–20 — Teacher Operating System

## Outcome

Stages 15–20 turn the existing identity, event, finding, response, curriculum and shadow-forecasting foundations into one governed operating surface for teachers, departments, schools and trusts.

The product loop is now explicit:

> notice → explain → human decision → teach → recheck → evaluate → improve

This is not a second intelligence stack. It reuses the existing canonical pupil identity, immutable education event ledger, persistent findings/actions, curriculum knowledge graph, context snapshots, artifacts, delivery/recheck/outcome ledger and Stage 14 model registry.

## Stage 15 — Safe activation and brain health

`intelligence_source_health` stores the current aggregate status, record volume, unresolved volume and freshness of each connected source. `refresh_intelligence_brain_health` checks canonical identity, the event ledger, attendance, literacy, the response loop and shadow forecasting without changing source data or producing pupil conclusions.

Required identity and learning-event sources can block activation. Optional sources remain `unknown` until connected. Every health run appends a non-identifying `intelligence_monitoring_events` record.

## Stage 16 — The teacher golden loop

`/intel/operating-system` ranks the work already visible through RLS into three lanes:

- `now`: human decisions, in-progress work and overdue rechecks;
- `next`: accepted work and upcoming rechecks;
- `watch`: reviewed findings that do not yet have a response.

The queue is intentionally short and uses the shared role-altitude contract. It does not invent a separate role model or disclose pupil data at trust level.

## Stage 17 — Governed learning flywheel

`intelligence_recommendations` records an advisory response, its policy/version, evidence snapshot and explanation. Every recommendation has `requires_human_acceptance = true`.

`decide_intelligence_recommendation` is a service-only, invoker-rights transition. Acceptance atomically creates an accepted action owned by the named decision maker. Rejection requires a reason. Both decisions enter the existing work-event ledger.

`intelligence_policy_evaluations` keeps adoption, delivery, recheck, teacher judgement and descriptive learner change separate. Evaluation is sample-gated. A `candidate` result means “bring to governance review”; it cannot promote or automate a policy.

## Stage 18 — Advanced lesson studio

Every new response generation now builds a versioned `LessonBundleSpec` before calling the lesson generator. It freezes:

- the reviewed finding and evidence date;
- baseline, evidence volume and uncertainty;
- approved curriculum prerequisites, misconceptions and vocabulary;
- a diagnostic hinge and adaptive teaching branches;
- lesson deck, teacher notes, student task, exit check and delayed-recheck output contract;
- explicit fixed-risk and causal-claim prohibitions.

The specification lives inside the existing Stage 10 context snapshot even before the Stage 18 table is active. Once migrated, it is also stored immutably in `intelligence_lesson_specs` with a content fingerprint.

## Stage 19 — One OS at four altitudes

`intelligence_operating_system_summary` is a `security_invoker` view. Underlying RLS turns the same read model into:

- teacher: owned classes, raised findings and owned actions;
- department: school scope with department response purpose;
- school: coordination, coverage and implementation health;
- trust: permitted cross-school support and assurance scope.

The primary Intelligence navigation now opens the operating system. The evidence console, live state, evaluation and shadow lab remain available as drill-downs.

## Stage 20 — Production intelligence platform

`intelligence_monitoring_events` is an append-only operational/model event stream. Brain health and policy evaluation write aggregate monitoring events, while the command centre keeps these independent:

- source health and freshness;
- recommendation decisions;
- artifact lineage;
- delivery and recheck completion;
- teacher usefulness;
- descriptive outcomes;
- shadow-model evaluation.

This separation prevents a healthy API, a popular deck or a positive before/after change from being misreported as proven learning impact.

## Activation boundary

The code and additive migration are implemented locally. Applying the migration to production is a separate, deliberate operation. Before activation:

1. preview the full migration chain against the linked Supabase project;
2. apply Stages 7–20 in order in a development branch or staging environment;
3. run security and performance advisors;
4. exercise teacher, HoD, SLT and trust-lead RLS accounts;
5. run the brain-health check for one pilot school;
6. complete one recommendation → lesson → delivery → recheck loop;
7. only then enable wider school/trust rollout.

## North-star measure

The operating system continues to optimise for:

> Evidence-backed teaching loops completed per active class, with a measured outcome.

It does not optimise for decks generated, predictions viewed or model calls made.
