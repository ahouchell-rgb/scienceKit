export type GovernanceStatus =
  | "insufficient_data"
  | "candidate_for_review"
  | "hold"
  | "retire_review";

export type DriftStatus = "unknown" | "stable" | "watch" | "material";

export interface ModelEvaluationEvidence {
  sample_size?: number | null;
  brier_score?: number | null;
  baseline_brier_score?: number | null;
  brier_skill_score?: number | null;
  expected_calibration_error?: number | null;
  evaluated_at?: string | null;
}

export interface ModelGovernanceAssessment {
  governanceStatus: GovernanceStatus;
  driftStatus: DriftStatus;
  sampleSize: number;
  brierScore: number | null;
  baselineBrierScore: number | null;
  brierSkillScore: number | null;
  expectedCalibrationError: number | null;
  thresholds: {
    minimumLabelledOutcomes: 30;
    candidateLabelledOutcomes: 100;
    minimumSkillScore: 0.05;
    maximumCalibrationError: 0.1;
  };
  limitations: string[];
}

const finite = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Convert temporal shadow evaluations into governance evidence. This function
 * can only nominate a model for named human review; it never changes release
 * status and intentionally excludes protected characteristics.
 */
export function assessModelGovernance(
  evaluations: ModelEvaluationEvidence[],
): ModelGovernanceAssessment {
  const ordered = [...evaluations].sort(
    (left, right) =>
      Date.parse(String(right.evaluated_at || "")) -
      Date.parse(String(left.evaluated_at || "")),
  );
  const latest = ordered[0] || {};
  const previous = ordered[1] || {};
  const sampleSize = Math.max(0, Number(latest.sample_size) || 0);
  const brierScore = finite(latest.brier_score);
  const baselineBrierScore = finite(latest.baseline_brier_score);
  const brierSkillScore = finite(latest.brier_skill_score);
  const expectedCalibrationError = finite(latest.expected_calibration_error);
  const previousBrier = finite(previous.brier_score);
  const driftDelta =
    brierScore != null && previousBrier != null ? brierScore - previousBrier : null;
  const driftStatus: DriftStatus =
    driftDelta == null
      ? "unknown"
      : driftDelta >= 0.05
        ? "material"
        : driftDelta >= 0.02
          ? "watch"
          : "stable";

  let governanceStatus: GovernanceStatus = "insufficient_data";
  if (sampleSize >= 30) {
    const materiallyWorseThanBaseline =
      brierScore != null &&
      baselineBrierScore != null &&
      brierScore - baselineBrierScore >= 0.05;
    if (
      materiallyWorseThanBaseline ||
      (expectedCalibrationError != null && expectedCalibrationError > 0.2) ||
      driftStatus === "material"
    ) {
      governanceStatus = "retire_review";
    } else if (
      sampleSize >= 100 &&
      (brierSkillScore || 0) >= 0.05 &&
      expectedCalibrationError != null &&
      expectedCalibrationError <= 0.1 &&
      driftStatus === "stable"
    ) {
      governanceStatus = "candidate_for_review";
    } else {
      governanceStatus = "hold";
    }
  }

  return {
    governanceStatus,
    driftStatus,
    sampleSize,
    brierScore,
    baselineBrierScore,
    brierSkillScore,
    expectedCalibrationError,
    thresholds: {
      minimumLabelledOutcomes: 30,
      candidateLabelledOutcomes: 100,
      minimumSkillScore: 0.05,
      maximumCalibrationError: 0.1,
    },
    limitations: [
      "Shadow labels are the next comparable observed attempt, not an exam-grade prediction.",
      "Aggregate calibration does not replace an independently governed fairness audit.",
      "Candidate status requires a second temporal window with no material drift.",
      "Candidate status requests human review and never changes model release status automatically.",
    ],
  };
}
