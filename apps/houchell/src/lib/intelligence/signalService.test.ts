import { describe, expect, it } from "vitest";
import {
  crossDomainCandidates,
  learningGapCandidates,
  responseFromDecisionMemory,
} from "./signalService";

const now = new Date("2026-08-06T12:00:00.000Z");

describe("adaptive intelligence signal detection", () => {
  it("requires enough fresh, multi-pupil evidence for a learning gap", () => {
    const base = {
      school_id: "school-1",
      class_id: "class-1",
      class_name: "10X1",
      objective_key: "bio.cells",
      objective_title: "Cell structure",
      mastery_estimate: 48,
      uncertainty_points: 20,
      evidence_count: 24,
      pupil_count: 12,
      last_evidence_at: "2026-08-05T12:00:00.000Z",
      model_version: 1,
    };
    expect(learningGapCandidates([base], now)).toHaveLength(1);
    expect(learningGapCandidates([{ ...base, evidence_count: 7 }], now)).toHaveLength(0);
    expect(learningGapCandidates([{ ...base, pupil_count: 2 }], now)).toHaveLength(0);
    expect(learningGapCandidates([{ ...base, last_evidence_at: "2026-01-01" }], now)).toHaveLength(0);
  });

  it("describes cross-domain evidence as a hypothesis and never as causation", () => {
    const [candidate] = crossDomainCandidates([{
      class_id: "class-1",
      class_name: "9Y2",
      learning_mastery: 49,
      learning_evidence: 50,
      learning_as_of: "2026-08-05T12:00:00.000Z",
      attendance_rate: 86,
      attendance_sessions: 120,
      attendance_as_of: "2026-08-05T12:00:00.000Z",
      pupil_count: 28,
    }], now);
    expect(candidate.signalType).toBe("cross_domain_hypothesis");
    expect(candidate.summary).toContain("may be a hypothesis to check");
    expect(candidate.summary).toContain("does not establish causation");
    expect(candidate.evidenceSnapshot.causalClaim).toBe(false);
  });

  it("uses mature operational memory but ignores small or weak samples", () => {
    const [candidate] = learningGapCandidates([{
      class_id: "class-1",
      class_name: "10X1",
      objective_key: "cells",
      mastery_estimate: 48,
      uncertainty_points: 20,
      evidence_count: 24,
      pupil_count: 12,
      last_evidence_at: "2026-08-05T12:00:00.000Z",
      model_version: 1,
    }], now);
    expect(responseFromDecisionMemory(candidate, [{
      id: "score-1",
      finding_type: "learning_gap",
      objective_key: "cells",
      response_type: "review_evidence",
      sample_size: 12,
      confidence: 0.48,
      operational_score: 0.82,
    }]).recommendationType).toBe("review_evidence");
    expect(responseFromDecisionMemory(candidate, [{
      finding_type: "learning_gap",
      response_type: "monitor",
      sample_size: 2,
      confidence: 0.08,
      operational_score: 1,
    }]).recommendationType).toBe("reteach");
  });
});
