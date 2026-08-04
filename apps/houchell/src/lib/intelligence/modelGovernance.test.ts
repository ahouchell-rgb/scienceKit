import { describe, expect, it } from "vitest";
import { assessModelGovernance } from "./modelGovernance";

describe("model governance", () => {
  it("holds small samples regardless of apparent performance", () => {
    const result = assessModelGovernance([{
      sample_size: 29,
      brier_score: 0.1,
      baseline_brier_score: 0.25,
      brier_skill_score: 0.6,
      expected_calibration_error: 0.03,
    }]);
    expect(result.governanceStatus).toBe("insufficient_data");
  });

  it("only nominates strong, calibrated evidence for human review", () => {
    const result = assessModelGovernance([
      {
        sample_size: 150,
        brier_score: 0.16,
        baseline_brier_score: 0.2,
        brier_skill_score: 0.2,
        expected_calibration_error: 0.06,
        evaluated_at: "2026-08-04T00:00:00Z",
      },
      {
        sample_size: 130,
        brier_score: 0.15,
        evaluated_at: "2026-07-04T00:00:00Z",
      },
    ]);
    expect(result.governanceStatus).toBe("candidate_for_review");
    expect(result.limitations.join(" ")).toContain("never changes");
  });

  it("raises a retirement review when recent error materially drifts", () => {
    const result = assessModelGovernance([
      {
        sample_size: 120,
        brier_score: 0.27,
        baseline_brier_score: 0.25,
        brier_skill_score: -0.08,
        expected_calibration_error: 0.12,
        evaluated_at: "2026-08-04T00:00:00Z",
      },
      {
        sample_size: 120,
        brier_score: 0.2,
        evaluated_at: "2026-07-04T00:00:00Z",
      },
    ]);
    expect(result.driftStatus).toBe("material");
    expect(result.governanceStatus).toBe("retire_review");
  });
});
