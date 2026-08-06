import { describe, expect, it } from "vitest";
import { buildDecisionMemory } from "./decisionMemoryService";

describe("decision memory", () => {
  it("learns operational usefulness without turning outcome change into causation", () => {
    const [segment] = buildDecisionMemory({
      recommendations: [
        { status: "accepted", action_id: "a1", recommendation_type: "reteach", finding: { finding_type: "learning_gap", objective_key: "cells" } },
        { status: "rejected", action_id: null, recommendation_type: "reteach", finding: { finding_type: "learning_gap", objective_key: "cells" } },
      ],
      deliveries: [{ action_id: "a1" }],
      rechecks: [{ action_id: "a1", status: "completed" }],
      outcomes: [{ action_id: "a1", delta: 12 }],
      feedback: [{ action_id: "a1", rating: 5 }],
    });
    expect(segment.acceptanceRate).toBe(0.5);
    expect(segment.deliveryRate).toBe(1);
    expect(segment.recheckRate).toBe(1);
    expect(segment.meanDescriptiveDelta).toBe(12);
    expect(segment.limitations.join(" ")).toContain("does not estimate causal impact");
    expect(segment.confidence).toBeLessThan(0.1);
  });
});
