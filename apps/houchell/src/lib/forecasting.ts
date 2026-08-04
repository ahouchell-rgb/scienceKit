export interface PupilObjectiveState {
  school_id: string;
  pupil_id: string;
  objective_id?: string | null;
  objective_key?: string | null;
  mastery_estimate: number | string;
  uncertainty_points?: number | string | null;
  evidence_count: number | string;
  last_evidence_at: string;
  source_mix?: unknown;
}

export interface ShadowForecast {
  scopeKey: string;
  schoolId: string;
  pupilId: string;
  objectiveId: string | null;
  objectiveKey: string;
  prediction: number;
  lowerBound: number;
  upperBound: number;
  baselinePrediction: number;
  evidenceCount: number;
  successCount: number;
  failureCount: number;
  lastEvidenceAt: string;
  evidenceAgeDays: number;
  confidenceBand: "limited" | "developing" | "established";
  missingness: string[];
  sourceMix: string[];
  features: {
    posteriorAlpha: number;
    posteriorBeta: number;
    evidenceCount: number;
    evidenceAgeDays: number;
    peerObjectiveBaseline: number;
  };
}

export interface ScoredForecast {
  prediction: number;
  baselinePrediction: number;
  actual: number;
}

export interface ForecastEvaluation {
  sampleSize: number;
  brierScore: number | null;
  baselineBrierScore: number | null;
  brierSkillScore: number | null;
  expectedCalibrationError: number | null;
  status:
    | "insufficient_data"
    | "candidate_better"
    | "baseline_better"
    | "inconclusive";
  calibrationBins: Array<{
    lower: number;
    upper: number;
    count: number;
    meanPrediction: number | null;
    observedRate: number | null;
    absoluteGap: number | null;
  }>;
}

const clamp = (value: number, lower = 0, upper = 1) =>
  Math.min(upper, Math.max(lower, value));
const round = (value: number, places = 6) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

function objectiveKey(row: PupilObjectiveState) {
  return row.objective_id || String(row.objective_key || "").trim();
}

export function reconstructBetaCounts(input: {
  masteryEstimate: unknown;
  evidenceCount: unknown;
}) {
  const evidenceCount = Math.max(0, Math.round(Number(input.evidenceCount) || 0));
  const posteriorMean = clamp((Number(input.masteryEstimate) || 0) / 100);
  const successCount = Math.round(
    clamp(posteriorMean * (evidenceCount + 2) - 1, 0, evidenceCount),
  );
  return {
    evidenceCount,
    successCount,
    failureCount: evidenceCount - successCount,
  };
}

function peerBaselines(rows: PupilObjectiveState[]) {
  const aggregates = new Map<string, { successes: number; attempts: number }>();
  for (const row of rows) {
    const key = objectiveKey(row);
    if (!key) continue;
    const counts = reconstructBetaCounts({
      masteryEstimate: row.mastery_estimate,
      evidenceCount: row.evidence_count,
    });
    const current = aggregates.get(key) || { successes: 0, attempts: 0 };
    current.successes += counts.successCount;
    current.attempts += counts.evidenceCount;
    aggregates.set(key, current);
  }
  return new Map(
    [...aggregates.entries()].map(([key, value]) => [
      key,
      (value.successes + 1) / (value.attempts + 2),
    ]),
  );
}

export function buildShadowForecasts(
  rows: PupilObjectiveState[],
  options: {
    asOf?: Date;
    minimumEvidence?: number;
    maximumAgeDays?: number;
    limit?: number;
  } = {},
): ShadowForecast[] {
  const asOf = options.asOf || new Date();
  const minimumEvidence = options.minimumEvidence ?? 3;
  const maximumAgeDays = options.maximumAgeDays ?? 180;
  const limit = options.limit ?? 2000;
  const baselines = peerBaselines(rows);
  const forecasts: ShadowForecast[] = [];

  for (const row of rows) {
    if (forecasts.length >= limit) break;
    const key = objectiveKey(row);
    if (!row.pupil_id || !row.school_id || !key) continue;
    const counts = reconstructBetaCounts({
      masteryEstimate: row.mastery_estimate,
      evidenceCount: row.evidence_count,
    });
    if (counts.evidenceCount < minimumEvidence) continue;
    const lastEvidence = Date.parse(row.last_evidence_at);
    if (!Number.isFinite(lastEvidence) || lastEvidence > asOf.getTime()) continue;
    const evidenceAgeDays = Math.max(
      0,
      Math.floor((asOf.getTime() - lastEvidence) / 86_400_000),
    );
    if (evidenceAgeDays > maximumAgeDays) continue;

    const alpha = counts.successCount + 1;
    const beta = counts.failureCount + 1;
    const prediction = alpha / (alpha + beta);
    const variance =
      (alpha * beta) /
      ((alpha + beta) ** 2 * (alpha + beta + 1));
    const margin90 = 1.645 * Math.sqrt(variance);
    const sourceMix = Array.isArray(row.source_mix)
      ? row.source_mix.map(String).filter(Boolean)
      : [];
    const missingness = [
      row.objective_id ? null : "canonical_objective_id",
      sourceMix.length ? null : "source_mix",
    ].filter(Boolean) as string[];
    const confidenceBand =
      counts.evidenceCount >= 20 && evidenceAgeDays <= 42
        ? "established"
        : counts.evidenceCount >= 8 && evidenceAgeDays <= 90
          ? "developing"
          : "limited";
    const baseline = baselines.get(key) ?? 0.5;

    forecasts.push({
      scopeKey: `${row.pupil_id}:${key}`,
      schoolId: row.school_id,
      pupilId: row.pupil_id,
      objectiveId: row.objective_id || null,
      objectiveKey: key,
      prediction: round(prediction),
      lowerBound: round(clamp(prediction - margin90)),
      upperBound: round(clamp(prediction + margin90)),
      baselinePrediction: round(baseline),
      evidenceCount: counts.evidenceCount,
      successCount: counts.successCount,
      failureCount: counts.failureCount,
      lastEvidenceAt: new Date(lastEvidence).toISOString(),
      evidenceAgeDays,
      confidenceBand,
      missingness,
      sourceMix,
      features: {
        posteriorAlpha: alpha,
        posteriorBeta: beta,
        evidenceCount: counts.evidenceCount,
        evidenceAgeDays,
        peerObjectiveBaseline: round(baseline),
      },
    });
  }
  return forecasts;
}

export function brierScore(prediction: unknown, actual: unknown) {
  const p = Number(prediction);
  const y = Number(actual);
  if (!Number.isFinite(p) || p < 0 || p > 1 || (y !== 0 && y !== 1)) {
    throw new Error("Prediction must be a probability and actual must be 0 or 1.");
  }
  return round((p - y) ** 2);
}

export function evaluateForecasts(rows: ScoredForecast[]): ForecastEvaluation {
  const valid = rows.filter(
    (row) =>
      Number.isFinite(row.prediction) &&
      row.prediction >= 0 &&
      row.prediction <= 1 &&
      Number.isFinite(row.baselinePrediction) &&
      row.baselinePrediction >= 0 &&
      row.baselinePrediction <= 1 &&
      (row.actual === 0 || row.actual === 1),
  );
  const bins = Array.from({ length: 5 }, (_, index) => ({
    lower: index / 5,
    upper: (index + 1) / 5,
    rows: [] as ScoredForecast[],
  }));
  for (const row of valid) {
    bins[Math.min(4, Math.floor(row.prediction * 5))].rows.push(row);
  }
  const calibrationBins = bins.map((bin) => {
    if (!bin.rows.length) {
      return {
        lower: bin.lower,
        upper: bin.upper,
        count: 0,
        meanPrediction: null,
        observedRate: null,
        absoluteGap: null,
      };
    }
    const meanPrediction =
      bin.rows.reduce((sum, row) => sum + row.prediction, 0) / bin.rows.length;
    const observedRate =
      bin.rows.reduce((sum, row) => sum + row.actual, 0) / bin.rows.length;
    return {
      lower: bin.lower,
      upper: bin.upper,
      count: bin.rows.length,
      meanPrediction: round(meanPrediction),
      observedRate: round(observedRate),
      absoluteGap: round(Math.abs(meanPrediction - observedRate)),
    };
  });
  if (!valid.length) {
    return {
      sampleSize: 0,
      brierScore: null,
      baselineBrierScore: null,
      brierSkillScore: null,
      expectedCalibrationError: null,
      status: "insufficient_data",
      calibrationBins,
    };
  }

  const candidate =
    valid.reduce((sum, row) => sum + (row.prediction - row.actual) ** 2, 0) /
    valid.length;
  const baseline =
    valid.reduce(
      (sum, row) => sum + (row.baselinePrediction - row.actual) ** 2,
      0,
    ) / valid.length;
  const ece = calibrationBins.reduce(
    (sum, bin) =>
      sum +
      (bin.absoluteGap == null ? 0 : (bin.count / valid.length) * bin.absoluteGap),
    0,
  );
  const skill = baseline > 0 ? 1 - candidate / baseline : null;
  const status =
    valid.length < 30
      ? "insufficient_data"
      : candidate + 0.005 < baseline && ece <= 0.15
        ? "candidate_better"
        : candidate > baseline + 0.005
          ? "baseline_better"
          : "inconclusive";

  return {
    sampleSize: valid.length,
    brierScore: round(candidate),
    baselineBrierScore: round(baseline),
    brierSkillScore: skill == null ? null : round(skill),
    expectedCalibrationError: round(ece),
    status,
    calibrationBins,
  };
}

export function forecastDistribution(rows: Array<{
  prediction: number | string;
  confidence_band?: string | null;
}>) {
  const buckets = [
    { key: "0_20", label: "0–20%", min: 0, max: 0.2, count: 0 },
    { key: "20_40", label: "20–40%", min: 0.2, max: 0.4, count: 0 },
    { key: "40_60", label: "40–60%", min: 0.4, max: 0.6, count: 0 },
    { key: "60_80", label: "60–80%", min: 0.6, max: 0.8, count: 0 },
    { key: "80_100", label: "80–100%", min: 0.8, max: 1.000001, count: 0 },
  ];
  const confidence = { limited: 0, developing: 0, established: 0 };
  for (const row of rows) {
    const value = Number(row.prediction);
    if (!Number.isFinite(value) || value < 0 || value > 1) continue;
    const bucket = buckets.find((candidate) => value >= candidate.min && value < candidate.max);
    if (bucket) bucket.count += 1;
    if (row.confidence_band && row.confidence_band in confidence) {
      confidence[row.confidence_band as keyof typeof confidence] += 1;
    }
  }
  return {
    total: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    buckets: buckets.map(({ min: _min, max: _max, ...bucket }) => bucket),
    confidence,
  };
}
