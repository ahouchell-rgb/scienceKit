import { describe, expect, it } from "vitest";
import { bindingConstraintHypotheses } from "./crossDomain";

describe("cross-domain constraint hypotheses", () => {
  it("labels co-occurrence as a hypothesis rather than a cause", () => {
    const rows = bindingConstraintHypotheses({
      learning_mastery: 42,
      learning_evidence: 90,
      attendance_rate: 84,
      attendance_sessions: 300,
      literacy_value: 86,
      literacy_measure: "reading_standardised_score",
      literacy_pupils: 18,
      pupil_count: 24,
    });
    expect(rows.find((row) => row.key === "attendance_exposure")?.status).toBe("plausible");
    expect(rows.find((row) => row.key === "literacy_access")?.status).toBe("plausible");
    expect(rows.map((row) => row.summary).join(" ")).not.toMatch(/caused|root cause/i);
    expect(rows[0].nextCheck).toContain("do not infer cause");
  });

  it("stops when learning evidence is too thin", () => {
    expect(bindingConstraintHypotheses({
      learning_mastery: 20,
      learning_evidence: 2,
    })).toEqual([
      expect.objectContaining({
        key: "insufficient_evidence",
        status: "insufficient_evidence",
      }),
    ]);
  });
});
