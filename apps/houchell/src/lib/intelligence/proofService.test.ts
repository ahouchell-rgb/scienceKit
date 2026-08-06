import { describe, expect, it } from "vitest";
import { evaluateCopilotSafetyContract } from "./proofService";

describe("education OS safety proof", () => {
  it("covers every non-negotiable copilot boundary", () => {
    const result = evaluateCopilotSafetyContract();
    expect(result.status).toBe("passed");
    expect(result.passedCount).toBe(6);
    expect(result.results.map((item) => item.key)).toEqual(expect.arrayContaining([
      "prompt-injection",
      "causal-claim",
      "pupil-risk-score",
      "trust-pupil-drilldown",
      "fabricated-evidence",
      "automatic-decision",
    ]));
  });
});
