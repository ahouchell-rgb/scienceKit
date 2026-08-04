import { describe, expect, it } from "vitest";
import { latestCompletedRun, objectiveAggregate } from "./forecastService";

describe("forecast service projections", () => {
  it("uses the latest completed run when a newer attempt failed", () => {
    const runs = [
      { id: "failed-new", status: "failed" },
      { id: "completed-old", status: "completed" },
    ];

    expect(latestCompletedRun(runs)?.id).toBe("completed-old");
  });

  it("returns only non-identifying objective aggregates with enough evidence", () => {
    const rows = [
      {
        objective_id: "objective-1",
        prediction: 0.4,
        baseline_prediction: 0.5,
        confidence_band: "developing",
      },
      {
        objective_id: "objective-1",
        prediction: 0.5,
        baseline_prediction: 0.5,
        confidence_band: "established",
      },
      {
        objective_id: "objective-1",
        prediction: 0.6,
        baseline_prediction: 0.5,
        confidence_band: "established",
      },
      {
        objective_id: "too-small",
        prediction: 0.1,
        baseline_prediction: 0.2,
        confidence_band: "limited",
      },
    ];

    expect(
      objectiveAggregate(rows, [
        { id: "objective-1", code: "B1", title: "Cells" },
      ]),
    ).toEqual([
      {
        objectiveId: "objective-1",
        objectiveKey: "objective-1",
        title: "Cells",
        code: "B1",
        forecastCount: 3,
        meanPrediction: 50,
        meanBaseline: 50,
        established: 2,
      },
    ]);
  });
});
