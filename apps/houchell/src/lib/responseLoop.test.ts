import { describe, expect, it } from "vitest";
import { buildResponseFocus, buildResponseSpec, descriptiveOutcome } from "./responseLoop";

describe("finding-to-outcome response loop", () => {
  it("builds a bounded teaching brief with hinge and delayed recheck", () => {
    const focus = buildResponseFocus({
      headline: "Ionic bonding remains insecure",
      summary: "The class confuses electron transfer with sharing.",
      objectiveLabel: "Explain ionic bonding",
      baselineMastery: 38.4,
      marked: 64,
      students: 24,
    });

    expect(focus).toContain("reviewed finding");
    expect(focus).toContain("38% mastery");
    expect(focus).toContain("diagnostic hinge question");
    expect(focus).toContain("5–10 school days later");
    expect(focus).toContain("Do not describe pupils as fixed-risk");
  });

  it("serialises a versioned generation contract with explicit safeguards", () => {
    const spec = buildResponseSpec({
      headline: "Ionic bonding remains insecure",
      summary: "Electron transfer is confused with sharing.",
      objectiveLabel: "Explain ionic bonding",
      baselineMastery: 38,
      marked: 64,
      students: 24,
    });

    expect(spec).toMatchObject({
      schemaVersion: 1,
      purpose: "misconception_reteach",
      objective: "Explain ionic bonding",
      baseline: { masteryPct: 38, markedResponses: 64, pupilsObserved: 24 },
      recheckWindowSchoolDays: { min: 5, max: 10 },
    });
    expect(spec.requiredComponents).toContain("parallel_delayed_recheck");
    expect(spec.prohibitedClaims).toEqual([
      "fixed_pupil_risk",
      "causal_impact_without_design",
    ]);
  });

  it("computes a descriptive delta without making a causal claim", () => {
    expect(descriptiveOutcome({ baseline: 38, outcome: 57, sampleSize: 22 })).toEqual({
      baseline: 38,
      outcome: 57,
      delta: 19,
      sampleSize: 22,
      attributionStrength: "descriptive",
      interpretation:
        "The recheck was 19.0 percentage points higher than the frozen baseline. This is a descriptive before/after change, not a causal estimate.",
    });
  });

  it("handles lower and unchanged outcomes honestly", () => {
    expect(descriptiveOutcome({ baseline: 60, outcome: 54 }).interpretation).toContain(
      "lower",
    );
    expect(descriptiveOutcome({ baseline: 60, outcome: 60 }).interpretation).toContain(
      "unchanged",
    );
  });

  it("rejects invalid percentages", () => {
    expect(() => descriptiveOutcome({ baseline: -1, outcome: 50 })).toThrow(
      "percentages from 0 to 100",
    );
    expect(() => descriptiveOutcome({ baseline: 40, outcome: 101 })).toThrow(
      "percentages from 0 to 100",
    );
  });
});
