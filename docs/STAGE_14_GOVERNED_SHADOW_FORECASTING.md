# School Intelligence — Stage 14 governed shadow forecasting

Status: implemented locally. Database activation remains behind the Supabase development-branch gate. Production forecasting is off.

## Outcome

Stage 14 implements the first complete forecasting contract:

> What is the probability that a reconciled pupil answers the next comparable attempt on this objective correctly?

It deliberately does not predict GCSE grades, behaviour by an individual pupil, “risk”, fixed ability or long-term life outcomes.

The first model is a transparent Beta–Bernoulli baseline derived from the existing immutable objective-response ledger. It runs only when:

- the pupil identity has already been reconciled;
- the objective scope is known;
- at least three comparable attempts exist;
- the latest evidence is no more than 180 days old.

Every forecast:

- has a named target and intended use;
- has an `as_of` time and 42-day expiry;
- is linked to an immutable feature snapshot;
- contains a probability, approximate epistemic interval and simple peer-objective baseline;
- records evidence volume, recency, source mix, missingness and model version;
- is permanently `shadow_only`;
- creates no action, grouping, intervention, grade or pupil label.

## Model-learning loop

Stage 14 accumulates labelled future outcomes without allowing a live model to rewrite itself:

```text
feature snapshot
  → shadow forecast
  → next comparable attempt
  → immutable outcome label
  → Brier score + calibration bins
  → baseline comparison
  → human-governed future promotion decision
```

The candidate is compared with the school-local objective peer rate. Evaluation reports:

- Brier score;
- baseline Brier score;
- Brier skill score;
- expected calibration error;
- calibration-bin counts and observed rates;
- sample sufficiency;
- operational limitations.

Fewer than 30 labels can never produce a `candidate_better` conclusion. No evaluation automatically promotes a model.

## Product surfaces

- `/intel/forecasts`
  - leadership-only shadow-model lab;
  - model contract and known limitations;
  - aggregate forecast distribution;
  - objective-level summaries suppressed below three forecasts;
  - temporal run history;
  - Brier/baseline/calibration comparison;
  - no pupil forecast rows or identities returned to the browser.
- `/api/intelligence/forecasts`
  - caller-JWT leadership authorization;
  - thin request orchestration over a reusable forecasting service;
  - bounded shadow run capped at 2,000 forecasts;
  - immutable feature and forecast persistence;
  - future-outcome scoring from the event ledger;
  - append-only evaluation and forecast events;
  - no model-promotion operation.

## Database contract

Migration:

`20260730100000_stage14_governed_shadow_forecasting.sql`

New tables:

- `intelligence_model_versions`
- `intelligence_forecast_runs`
- `intelligence_feature_snapshots`
- `intelligence_forecasts`
- `intelligence_forecast_outcomes`
- `intelligence_model_evaluations`
- `intelligence_forecast_reviews`
- `intelligence_forecast_events`

The migration seeds:

- `next_attempt_beta_bernoulli` version 1;
- lifecycle state `shadow`;
- a six-month review deadline;
- explicit included and excluded features;
- known limitations and a named baseline.

## Security and child-protection boundary

- Every personal forecast table has RLS and school/trust leadership read scope.
- Authenticated clients have read-only table privileges.
- Mutations require the service route after caller authorization.
- Feature snapshots, forecasts, outcomes, evaluations, reviews and events are append-only.
- Stage 14 excludes names, ethnicity, sex, SEND, health, FSM, attendance, behaviour and teacher identity from model features.
- The school-local baseline prevents raw pupil histories from being pooled across schools.
- The database restricts `release_status` to `shadow_only`.
- The database restricts forecast review `decision_taken` to `false`.
- The browser receives aggregate distributions and objective summaries, not named pupil forecasts.

This contract still produces derived personal data in the database. Before any pupil-facing or decision-support release, the product needs a reviewed DPIA and best-interests assessment, controller instructions, transparency/SAR coverage, meaningful human-contestation flow, independent fairness audit and explicit model approval.

## Activation and evaluation gate

After applying Stages 7–13 on a development branch:

1. Apply `20260730100000_stage14_governed_shadow_forecasting.sql`.
2. Verify `anon` has no model/forecast table access.
3. Verify teachers cannot read or run the shadow lab.
4. Verify HoD/SLT can run only their school.
5. Verify trust leads can select only schools in their trust.
6. Run a forecast twice in one hour and confirm the second request reuses the idempotent run.
7. Confirm thin, stale, unresolved and unmapped evidence is excluded.
8. Confirm every forecast has an immutable feature snapshot and expires after 42 days.
9. Add future comparable attempts, run outcome scoring twice and confirm forecasts receive only one outcome label.
10. Verify no pupil identities or rows appear in the browser response.
11. Attempt to change `release_status` or set `decision_taken=true` and confirm the database rejects it.
12. Confirm fewer than 30 outcomes remains `insufficient_data`.
13. Compare candidate Brier/calibration with the baseline on future data.
14. Run Supabase security/performance advisors and require no new errors.

No model should progress beyond shadow mode merely because it beats the baseline once. Promotion requires repeat temporal performance, calibration, separately governed fairness analysis and human approval.

## Local verification

- `npm test` — all workspaces passed; web 30 files / 211 tests, retrieval 6 files / 45 tests. The database contract test was skipped because `DATABASE_URL` is not set.
- `npm run typecheck` — passed.
- `npm run build` — both Next.js applications passed, including `/api/intelligence/forecasts` and `/intel/forecasts`.
- `git diff --check` — passed.

The build emitted only the existing sandbox warning that Google Fonts could not be downloaded for optimisation.
