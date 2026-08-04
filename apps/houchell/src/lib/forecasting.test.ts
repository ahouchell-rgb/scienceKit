import { describe, expect, it } from "vitest";
import {
  brierScore,
  buildShadowForecasts,
  evaluateForecasts,
  forecastDistribution,
  reconstructBetaCounts,
} from "./forecasting";

describe("governed shadow forecasting", () => {
  it("reconstructs the transparent Beta state and produces bounded intervals", () => {
    expect(reconstructBetaCounts({ masteryEstimate: 75, evidenceCount: 6 })).toEqual({
      evidenceCount: 6,
      successCount: 5,
      failureCount: 1,
    });
    const [forecast] = buildShadowForecasts(
      [{
        school_id: "s1",
        pupil_id: "p1",
        objective_id: "o1",
        mastery_estimate: 75,
        evidence_count: 6,
        last_evidence_at: "2026-07-29T12:00:00.000Z",
        source_mix: ["retrieval"],
      }],
      { asOf: new Date("2026-07-30T12:00:00.000Z") },
    );
    expect(forecast.prediction).toBe(0.75);
    expect(forecast.lowerBound).toBeGreaterThanOrEqual(0);
    expect(forecast.upperBound).toBeLessThanOrEqual(1);
    expect(forecast.confidenceBand).toBe("limited");
  });

  it("excludes thin, stale and unmapped evidence", () => {
    expect(
      buildShadowForecasts(
        [
          {
            school_id: "s1",
            pupil_id: "p1",
            objective_id: "o1",
            mastery_estimate: 80,
            evidence_count: 2,
            last_evidence_at: "2026-07-29T12:00:00.000Z",
          },
          {
            school_id: "s1",
            pupil_id: "p2",
            objective_id: "o1",
            mastery_estimate: 80,
            evidence_count: 10,
            last_evidence_at: "2025-01-01T12:00:00.000Z",
          },
        ],
        { asOf: new Date("2026-07-30T12:00:00.000Z") },
      ),
    ).toEqual([]);
  });

  it("scores probability accuracy against the simple peer baseline", () => {
    expect(brierScore(0.8, 1)).toBe(0.04);
    const rows = Array.from({ length: 40 }, (_, index) => {
      const actual = index < 32 ? 1 : 0;
      return {
        prediction: actual ? 0.9 : 0.1,
        baselinePrediction: 0.5,
        actual,
      };
    });
    const evaluation = evaluateForecasts(rows);
    expect(evaluation.sampleSize).toBe(40);
    expect(evaluation.brierScore).toBeLessThan(evaluation.baselineBrierScore!);
    expect(evaluation.status).toBe("candidate_better");
  });

  it("refuses promotion conclusions when the labelled sample is small", () => {
    expect(
      evaluateForecasts([
        { prediction: 0.9, baselinePrediction: 0.5, actual: 1 },
      ]).status,
    ).toBe("insufficient_data");
  });

  it("returns cohort distributions without pupil identifiers", () => {
    expect(
      forecastDistribution([
        { prediction: 0.1, confidence_band: "limited" },
        { prediction: 0.7, confidence_band: "established" },
      ]),
    ).toEqual({
      total: 2,
      buckets: [
        { key: "0_20", label: "0–20%", count: 1 },
        { key: "20_40", label: "20–40%", count: 0 },
        { key: "40_60", label: "40–60%", count: 0 },
        { key: "60_80", label: "60–80%", count: 1 },
        { key: "80_100", label: "80–100%", count: 0 },
      ],
      confidence: { limited: 1, developing: 0, established: 1 },
    });
  });
});
