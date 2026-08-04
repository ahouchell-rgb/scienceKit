import { describe, expect, it } from "vitest";
import {
  CONTINUOUS_TEACHER_OS_STAGES,
  TEACHER_OS_ENTITY_TYPES,
  TEACHER_OS_FLYWHEEL,
  TEACHER_OS_GUARDRAILS,
  TEACHER_OS_ONTOLOGY_VERSION,
} from "./teacherOS";

describe("continuous teacher OS contract", () => {
  it("keeps stages 21-26 complete and ordered", () => {
    expect(CONTINUOUS_TEACHER_OS_STAGES.map((stage) => stage.number)).toEqual([21, 22, 23, 24, 25, 26]);
    expect(new Set(CONTINUOUS_TEACHER_OS_STAGES.map((stage) => stage.key)).size).toBe(6);
    expect(TEACHER_OS_ONTOLOGY_VERSION).toMatch(/^0\./);
    expect(TEACHER_OS_ENTITY_TYPES).toContain("MasteryState");
  });

  it("closes the evidence loop without removing human governance", () => {
    expect(TEACHER_OS_FLYWHEEL.at(-1)).toBe("govern");
    expect(TEACHER_OS_GUARDRAILS.automaticModelPromotion).toBe(false);
    expect(TEACHER_OS_GUARDRAILS.humanAcceptanceRequired).toBe(true);
  });
});
