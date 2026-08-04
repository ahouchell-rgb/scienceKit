import { artifactFingerprint } from "@/lib/artifactLineage";
import {
  brierScore,
  buildShadowForecasts,
  evaluateForecasts,
  type ScoredForecast,
} from "@/lib/forecasting";
import {
  adminInsertBatches,
  restAsUser,
  type IntelligenceAuth,
} from "@/lib/intelligence/server";
import { skAdmin } from "@/lib/serverHelpers";

export function objectiveAggregate(
  forecasts: any[],
  objectives: Array<{ id: string; title: string; code?: string | null }>,
) {
  const objectiveById = new Map(objectives.map((row) => [row.id, row]));
  const groups = new Map<string, any[]>();
  for (const forecast of forecasts) {
    const key = forecast.objective_id || forecast.objective_key;
    const rows = groups.get(key) || [];
    rows.push(forecast);
    groups.set(key, rows);
  }
  return [...groups.entries()]
    .filter(([, rows]) => rows.length >= 3)
    .map(([key, rows]) => {
      const objective = objectiveById.get(key);
      const mean =
        rows.reduce((sum, row) => sum + Number(row.prediction), 0) / rows.length;
      const meanBaseline =
        rows.reduce((sum, row) => sum + Number(row.baseline_prediction), 0) /
        rows.length;
      return {
        objectiveId: objective?.id || null,
        objectiveKey: key,
        title: objective?.title || key,
        code: objective?.code || null,
        forecastCount: rows.length,
        meanPrediction: Math.round(mean * 1000) / 10,
        meanBaseline: Math.round(meanBaseline * 1000) / 10,
        established: rows.filter((row) => row.confidence_band === "established").length,
      };
    })
    .sort((left, right) => left.meanPrediction - right.meanPrediction)
    .slice(0, 100);
}

export function latestCompletedRun<T extends { status?: string }>(
  runs: T[],
): T | null {
  return runs.find((run) => run.status === "completed") || null;
}

export async function runShadowForecast(
  auth: IntelligenceAuth,
  schoolId: string,
  maxItems: number,
) {
  const model = (
    await skAdmin(
      "GET",
      "intelligence_model_versions?model_key=eq.next_attempt_beta_bernoulli&version=eq.1&status=in.(shadow,validated)&select=*&limit=1",
    )
  )?.[0];
  if (!model) throw new Error("No active shadow model contract");

  const asOf = new Date();
  asOf.setMilliseconds(0);
  const expiresAt = new Date(asOf.getTime() + 42 * 86_400_000);
  let runKey = `${model.model_key}:v${model.version}:${asOf.toISOString().slice(0, 13)}`;
  const existing = (
    await skAdmin(
      "GET",
      `intelligence_forecast_runs?school_id=eq.${schoolId}&run_key=eq.${encodeURIComponent(runKey)}&select=*&limit=1`,
    )
  )?.[0];
  if (existing && existing.status !== "failed") {
    return { run: existing, reused: true };
  }
  if (existing?.status === "failed") {
    runKey = `${runKey}:retry-${asOf.toISOString().slice(14, 19)}`;
  }

  const run = (
    await skAdmin("POST", "intelligence_forecast_runs", {
      school_id: schoolId,
      model_version_id: model.id,
      run_key: runKey,
      target_kind: "next_attempt_correct",
      intended_use: "shadow_evaluation",
      horizon_kind: "next_comparable_attempt",
      status: "running",
      as_of: asOf.toISOString(),
      expires_at: expiresAt.toISOString(),
      max_items: maxItems,
      configuration: {
        minimumEvidence: 3,
        maximumEvidenceAgeDays: 180,
        interval: "approximate_90pct_posterior_parameter_interval",
        forecastExpiryDays: 42,
      },
      provenance: {
        stage: 14,
        sourceView: "pupil_learning_state",
        identityRequirement: "canonical_reconciled_pupil",
      },
      requested_by: auth.userId,
      started_at: asOf.toISOString(),
    })
  )?.[0];
  await skAdmin("POST", "intelligence_forecast_events", {
    school_id: schoolId,
    run_id: run.id,
    model_version_id: model.id,
    event_type: "run.started",
    actor_kind: "staff",
    actor_id: auth.userId,
    detail: { runKey, maxItems },
  });

  try {
    const states = await restAsUser<any[]>(
      `pupil_learning_state?school_id=eq.${schoolId}&select=school_id,pupil_id,objective_id,objective_key,mastery_estimate,uncertainty_points,evidence_count,last_evidence_at,source_mix&order=pupil_id.asc&limit=5000`,
      auth.token,
    );
    const allEligible = buildShadowForecasts(states || [], {
      asOf,
      minimumEvidence: 3,
      maximumAgeDays: 180,
      limit: 5000,
    });
    const selected = allEligible.slice(0, maxItems);
    const snapshotRows = selected.map((forecast) => {
      const payload = {
        ...forecast.features,
        successCount: forecast.successCount,
        failureCount: forecast.failureCount,
      };
      return {
        run_id: run.id,
        school_id: schoolId,
        pupil_id: forecast.pupilId,
        objective_id: forecast.objectiveId,
        objective_key: forecast.objectiveKey,
        scope_key: forecast.scopeKey,
        as_of: asOf.toISOString(),
        feature_schema_version: model.feature_schema_version,
        features: payload,
        missingness: forecast.missingness,
        evidence_count: forecast.evidenceCount,
        last_evidence_at: forecast.lastEvidenceAt,
        source_mix: forecast.sourceMix,
        content_fingerprint: artifactFingerprint(payload),
      };
    });
    const snapshots = await adminInsertBatches(
      "intelligence_feature_snapshots",
      snapshotRows,
    );
    const snapshotByScope = new Map(
      snapshots.map((row: any) => [row.scope_key, row]),
    );
    const forecastRows = selected.map((forecast) => ({
      run_id: run.id,
      model_version_id: model.id,
      feature_snapshot_id: snapshotByScope.get(forecast.scopeKey)?.id,
      school_id: schoolId,
      pupil_id: forecast.pupilId,
      objective_id: forecast.objectiveId,
      objective_key: forecast.objectiveKey,
      target_kind: "next_attempt_correct",
      intended_use: "shadow_evaluation",
      horizon_kind: "next_comparable_attempt",
      as_of: asOf.toISOString(),
      valid_from: asOf.toISOString(),
      expires_at: expiresAt.toISOString(),
      prediction: forecast.prediction,
      lower_bound: forecast.lowerBound,
      upper_bound: forecast.upperBound,
      baseline_prediction: forecast.baselinePrediction,
      confidence_band: forecast.confidenceBand,
      evidence_count: forecast.evidenceCount,
      missingness: forecast.missingness,
      release_status: "shadow_only",
      model_snapshot: {
        modelKey: model.model_key,
        version: model.version,
        method: model.method,
        featureSchemaVersion: model.feature_schema_version,
        baselineModelKey: model.baseline_model_key,
      },
      provenance: {
        stage: 14,
        approvedForDecisionUse: false,
        sourceMix: forecast.sourceMix,
      },
    }));
    const forecasts = await adminInsertBatches("intelligence_forecasts", forecastRows);
    const completed = (
      await skAdmin("PATCH", `intelligence_forecast_runs?id=eq.${run.id}`, {
        status: "completed",
        eligible_scopes: allEligible.length,
        forecast_count: forecasts.length,
        truncated: states.length >= 5000 || allEligible.length > maxItems,
        completed_at: new Date().toISOString(),
      })
    )?.[0];
    await skAdmin("POST", "intelligence_forecast_events", {
      school_id: schoolId,
      run_id: run.id,
      model_version_id: model.id,
      event_type: "run.completed",
      actor_kind: "system",
      actor_id: null,
      detail: {
        eligibleScopes: allEligible.length,
        forecastCount: forecasts.length,
        truncated: completed.truncated,
      },
    });
    return { run: completed, reused: false };
  } catch (error: any) {
    await skAdmin("PATCH", `intelligence_forecast_runs?id=eq.${run.id}`, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_summary: String(error?.message || "Shadow forecast run failed").slice(0, 1000),
    }).catch(() => null);
    await skAdmin("POST", "intelligence_forecast_events", {
      school_id: schoolId,
      run_id: run.id,
      model_version_id: model.id,
      event_type: "run.failed",
      actor_kind: "system",
      actor_id: null,
      detail: { error: String(error?.message || "").slice(0, 500) },
    }).catch(() => null);
    throw error;
  }
}

function eventKey(row: any) {
  return `${row.pupil_id}:${row.objective_id || row.objective_key || ""}`;
}

export async function scoreForecastOutcomes(
  auth: IntelligenceAuth,
  schoolId: string,
) {
  const [forecasts, existingOutcomes] = await Promise.all([
    skAdmin(
      "GET",
      `intelligence_forecasts?school_id=eq.${schoolId}&release_status=eq.shadow_only&select=id,run_id,model_version_id,pupil_id,objective_id,objective_key,as_of,expires_at,prediction,baseline_prediction&order=as_of.asc&limit=5000`,
    ),
    skAdmin(
      "GET",
      `intelligence_forecast_outcomes?school_id=eq.${schoolId}&select=forecast_id&limit=10000`,
    ),
  ]);
  const alreadyScored = new Set(
    (existingOutcomes || []).map((row: any) => row.forecast_id),
  );
  const outstanding = (forecasts || []).filter(
    (row: any) => !alreadyScored.has(row.id),
  );
  if (!outstanding.length) return { outcomes: 0, evaluations: 0 };

  const earliestAsOf = outstanding.reduce(
    (earliest: number, row: any) => Math.min(earliest, Date.parse(row.as_of)),
    Number.POSITIVE_INFINITY,
  );
  const events = await skAdmin(
    "GET",
    `education_events?school_id=eq.${schoolId}&event_type=eq.question_answered&occurred_at=gt.${new Date(earliestAsOf).toISOString()}&select=id,pupil_id,objective_id,objective_key,occurred_at,payload,source_system&order=occurred_at.asc&limit=10000`,
  );
  const eventsTruncated = (events || []).length >= 10000;
  const eventsByScope = new Map<string, any[]>();
  for (const event of events || []) {
    if (!event.pupil_id || !event.payload || event.payload.isCorrect == null) continue;
    const key = eventKey(event);
    const rows = eventsByScope.get(key) || [];
    rows.push(event);
    eventsByScope.set(key, rows);
  }

  const outcomeRows: any[] = [];
  for (const forecast of outstanding) {
    const asOf = Date.parse(forecast.as_of);
    const expiresAt = Date.parse(forecast.expires_at);
    const event = (eventsByScope.get(eventKey(forecast)) || []).find((candidate) => {
      const occurredAt = Date.parse(candidate.occurred_at);
      return occurredAt > asOf && occurredAt <= expiresAt;
    });
    if (!event) continue;
    const actual =
      event.payload.isCorrect === true || event.payload.isCorrect === "true" ? 1 : 0;
    outcomeRows.push({
      forecast_id: forecast.id,
      run_id: forecast.run_id,
      school_id: schoolId,
      source_event_id: event.id,
      label_version: 1,
      actual_value: actual,
      observed_at: event.occurred_at,
      brier_score: brierScore(Number(forecast.prediction), actual),
      baseline_brier_score: brierScore(
        Number(forecast.baseline_prediction),
        actual,
      ),
      label_provenance: {
        eventType: "question_answered",
        sourceSystem: event.source_system,
        comparison: "first comparable objective attempt after forecast",
      },
    });
  }
  if (!outcomeRows.length) {
    return { outcomes: 0, evaluations: 0, eventsTruncated };
  }
  await adminInsertBatches("intelligence_forecast_outcomes", outcomeRows);

  const affectedRunIds = [...new Set(outcomeRows.map((row) => row.run_id))];
  let evaluationCount = 0;
  for (const runId of affectedRunIds) {
    const [runForecasts, runOutcomes] = await Promise.all([
      skAdmin(
        "GET",
        `intelligence_forecasts?run_id=eq.${runId}&select=id,model_version_id,as_of,prediction,baseline_prediction&limit=5000`,
      ),
      skAdmin(
        "GET",
        `intelligence_forecast_outcomes?run_id=eq.${runId}&select=forecast_id,actual_value,observed_at&limit=5000`,
      ),
    ]);
    const outcomeByForecast = new Map(
      (runOutcomes || []).map((row: any) => [row.forecast_id, row]),
    );
    const scored: ScoredForecast[] = (runForecasts || [])
      .map((forecast: any) => {
        const outcome: any = outcomeByForecast.get(forecast.id);
        return outcome
          ? {
              prediction: Number(forecast.prediction),
              baselinePrediction: Number(forecast.baseline_prediction),
              actual: Number(outcome.actual_value),
            }
          : null;
      })
      .filter(Boolean);
    const evaluation = evaluateForecasts(scored);
    const observedTimes = (runOutcomes || []).map((row: any) =>
      Date.parse(row.observed_at),
    );
    const windowStart = (runForecasts || []).reduce(
      (value: number, row: any) => Math.min(value, Date.parse(row.as_of)),
      Date.now(),
    );
    const windowEnd = observedTimes.length ? Math.max(...observedTimes) : Date.now();
    const modelVersionId = runForecasts?.[0]?.model_version_id;
    if (!modelVersionId) continue;
    await skAdmin("POST", "intelligence_model_evaluations", {
      run_id: runId,
      model_version_id: modelVersionId,
      school_id: schoolId,
      evaluation_kind: "temporal_shadow",
      window_start: new Date(windowStart).toISOString(),
      window_end: new Date(windowEnd).toISOString(),
      sample_size: evaluation.sampleSize,
      brier_score: evaluation.brierScore,
      baseline_brier_score: evaluation.baselineBrierScore,
      brier_skill_score: evaluation.brierSkillScore,
      expected_calibration_error: evaluation.expectedCalibrationError,
      interval_coverage: null,
      evaluation_status: evaluation.status,
      calibration_bins: evaluation.calibrationBins,
      subgroup_audit: {
        status: "not_run_in_stage14",
        reason: "Protected characteristics are excluded from model features; an independently governed fairness audit is required before release.",
      },
      limitations: [
        "The label is the next observed objective attempt, which may differ in item difficulty.",
        "Brier and calibration estimates are unstable below 30 labelled outcomes.",
        "No model is promoted automatically from this evaluation.",
        ...(eventsTruncated
          ? ["The scoring event scan reached its 10,000-row operational cap; this evaluation is incomplete."]
          : []),
      ],
      evaluated_by_kind: "system",
      evaluated_by: null,
    });
    await skAdmin("PATCH", `intelligence_forecast_runs?id=eq.${runId}`, {
      outcome_count: evaluation.sampleSize,
    });
    await skAdmin("POST", "intelligence_forecast_events", {
      school_id: schoolId,
      run_id: runId,
      model_version_id: modelVersionId,
      event_type: "evaluation.recorded",
      actor_kind: "system",
      actor_id: null,
      detail: {
        sampleSize: evaluation.sampleSize,
        brierScore: evaluation.brierScore,
        baselineBrierScore: evaluation.baselineBrierScore,
        expectedCalibrationError: evaluation.expectedCalibrationError,
        status: evaluation.status,
      },
    });
    evaluationCount += 1;
  }
  await skAdmin("POST", "intelligence_forecast_events", {
    school_id: schoolId,
    run_id: null,
    model_version_id: null,
    event_type: "outcomes.scored",
    actor_kind: "staff",
    actor_id: auth.userId,
    detail: { outcomeCount: outcomeRows.length, evaluationCount, eventsTruncated },
  });
  return {
    outcomes: outcomeRows.length,
    evaluations: evaluationCount,
    eventsTruncated,
  };
}
