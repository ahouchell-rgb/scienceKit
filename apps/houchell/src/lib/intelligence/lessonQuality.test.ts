import { describe, expect, it } from "vitest";
import { assessLessonQuality } from "./lessonQuality";

const completeSpec = {
  schemaVersion: 2,
  curriculum: { approvedGraphOnly: true },
  sequence: [{ phase: "entry_diagnostic" }, { phase: "diagnostic_hinge" }],
  adaptiveBranches: [{ when: "secure" }, { when: "not_secure" }],
  outputBundle: ["lesson_deck", "teacher_notes", "student_task", "exit_check", "delayed_recheck"],
  delayedRecheck: { required: true },
  guardrails: ["Keep teacher review and editing available before delivery."],
};

describe("lesson quality loop", () => {
  it("passes a complete structured lesson contract", () => {
    const result = assessLessonQuality({
      specification: completeSpec,
      outputContract: { format: "deck" },
    });
    expect(result.contractScore).toBe(1);
    expect(result.qualityStatus).toBe("passes_contract");
  });

  it("combines edits, ratings and descriptive outcomes without a causal claim", () => {
    const result = assessLessonQuality({
      specification: completeSpec,
      outputContract: { format: "deck" },
      feedback: [
        { feedback_type: "edited" },
        { feedback_type: "accepted" },
        { feedback_type: "rating", rating: 4 },
      ],
      deliveries: [{ id: "delivery-1" }],
      outcomes: [{ delta: 8 }, { delta: 4 }],
    });
    expect(result).toMatchObject({
      editRate: 0.5,
      teacherRating: 4,
      deliveryCount: 1,
      outcomeCount: 2,
      meanDescriptiveDelta: 6,
    });
    expect(result.limitations.join(" ")).toContain("descriptive");
  });
});
