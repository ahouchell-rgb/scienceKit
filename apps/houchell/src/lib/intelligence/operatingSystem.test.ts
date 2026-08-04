import { describe, expect, it } from "vitest";
import {
  buildLessonBundlePrompt,
  buildLessonBundleSpec,
  buildTodayQueue,
  evaluateResponsePolicy,
  operatingContract,
  summariseBrainHealth,
} from "./operatingSystem";

describe("teacher operating system", () => {
  it("uses the shared role altitude contract", () => {
    expect(operatingContract({ trust_role: "trust_lead" }).level).toBe("trust");
    expect(operatingContract({ school_role: "slt" }).level).toBe("school");
    expect(operatingContract({ school_role: "hod" }).level).toBe("department");
    expect(operatingContract({ role: "teacher" }).level).toBe("teacher");
  });

  it("marks required blocked sources before optional unknown sources", () => {
    const summary = summariseBrainHealth([
      { source_key: "forecast", domain: "forecast", required: false, status: "unknown" },
      { source_key: "identity", domain: "identity", required: true, status: "blocked" },
      { source_key: "events", domain: "learning", required: true, status: "healthy" },
    ]);

    expect(summary.status).toBe("blocked");
    expect(summary.attention).toBe(1);
    expect(summary.sources[0].required).toBe(true);
  });

  it("places human decisions and overdue rechecks at the top of today", () => {
    const queue = buildTodayQueue({
      now: new Date("2026-08-04T12:00:00Z"),
      recommendations: [{
        id: "rec-1",
        status: "proposed",
        priority: "high",
        headline: "Reteach particle models",
        rationale: "A strong reviewed finding is waiting for a teacher decision.",
      }],
      rechecks: [{
        id: "check-1",
        status: "scheduled",
        due_at: "2026-08-03T12:00:00Z",
        action_id: "action-1",
        finding: { headline: "Particle models" },
      }],
    });

    expect(queue.map((item) => item.kind)).toEqual(["recommendation", "recheck"]);
    expect(queue[0].humanDecisionRequired).toBe(true);
    expect(queue[1].href).toBe("/response/action-1");
  });

  it("freezes a structured lesson bundle with adaptive branches and safeguards", () => {
    const spec = buildLessonBundleSpec({
      finding: {
        id: "finding-1",
        class_id: "class-1",
        objective_key: "Explain diffusion",
        evidence_as_of: "2026-08-01T10:00:00Z",
        evidence_snapshot: { masteryPct: 42, students: 28 },
      },
      responseSpec: { objective: "Explain diffusion" },
      liveState: { evidence_count: 83, uncertainty_points: 9.4 },
      curriculumGraph: {
        prerequisites: [{ title: "Particle model" }],
        misconceptions: [{ title: "Particles move because they want space" }],
        vocabulary: [{ term: "concentration gradient" }],
        provenance: { graphVersion: 3 },
      },
      unitId: "unit-1",
      lessonId: "lesson-2",
    });

    expect(spec).toMatchObject({
      schemaVersion: 2,
      purpose: "evidence_responsive_lesson",
      curriculum: { approvedGraphOnly: true, graphVersion: 3 },
      delayedRecheck: { required: true, parallel: true },
    });
    expect(spec.outputBundle).toContain("teacher_notes");
    expect(buildLessonBundlePrompt(spec)).toContain("hinge_not_secure");
    expect(buildLessonBundlePrompt(spec)).toContain("Do not claim");
  });

  it("keeps policy learning governed and sample-gated", () => {
    const insufficient = evaluateResponsePolicy({
      recommendations: Array.from({ length: 10 }, (_, index) => ({
        id: index,
        status: "accepted",
      })),
      outcomes: Array.from({ length: 10 }, () => ({ delta: 12 })),
    });
    expect(insufficient.evaluationStatus).toBe("insufficient_data");

    const candidate = evaluateResponsePolicy({
      recommendations: Array.from({ length: 30 }, (_, index) => ({
        id: index,
        status: "accepted",
      })),
      deliveries: Array.from({ length: 25 }, (_, id) => ({ id })),
      rechecks: Array.from({ length: 20 }, (_, id) => ({ id, status: "completed" })),
      outcomes: Array.from({ length: 20 }, () => ({ delta: 8 })),
      feedback: Array.from({ length: 20 }, () => ({ feedback_type: "rating", rating: 4 })),
    });
    expect(candidate.evaluationStatus).toBe("candidate");
    expect(candidate.limitations.join(" ")).toContain("never promotes");
  });
});
