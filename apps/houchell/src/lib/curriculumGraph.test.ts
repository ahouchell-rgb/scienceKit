import { describe, expect, it } from "vitest";
import {
  buildCurriculumGraphPrompt,
  curriculumGraphCoverage,
  sequenceLinkCandidates,
  wouldCreateCurriculumCycle,
} from "./curriculumGraph";

describe("curriculum graph", () => {
  it("rejects a prerequisite edge that closes a cycle", () => {
    const edges = [
      { from_objective_id: "a", to_objective_id: "b", link_type: "prerequisite_of" as const },
      { from_objective_id: "b", to_objective_id: "c", link_type: "prerequisite_of" as const },
    ];
    expect(
      wouldCreateCurriculumCycle(edges, {
        from_objective_id: "c",
        to_objective_id: "a",
        link_type: "prerequisite_of",
      }),
    ).toBe(true);
    expect(
      wouldCreateCurriculumCycle(edges, {
        from_objective_id: "c",
        to_objective_id: "d",
        link_type: "prerequisite_of",
      }),
    ).toBe(false);
  });

  it("seeds only adjacent lesson suggestions and leaves them proposed", () => {
    const rows = sequenceLinkCandidates(
      [
        { id: "a", title: "A", unit_id: "u1", lesson_id: "l1", sort_order: 1 },
        { id: "b", title: "B", unit_id: "u1", lesson_id: "l2", sort_order: 1 },
        { id: "c", title: "C", unit_id: "u1", lesson_id: "l3", sort_order: 1 },
        { id: "x", title: "No lesson", unit_id: "u1" },
      ],
      { l1: 1, l2: 2, l3: 3 },
    );
    expect(rows.map((row) => [row.from_objective_id, row.to_objective_id])).toEqual([
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(rows.every((row) => row.status === "proposed")).toBe(true);
  });

  it("counts approved coverage separately from the review queue", () => {
    expect(
      curriculumGraphCoverage({
        objectives: [{ id: "a" }, { id: "b" }],
        profiles: [
          { objective_id: "a", status: "approved" },
          { objective_id: "b", status: "proposed" },
        ],
        links: [{ status: "approved" }, { status: "proposed" }],
        objectiveMisconceptions: [{ objective_id: "a", status: "approved" }],
        objectiveVocabulary: [{ objective_id: "b", status: "proposed" }],
      }),
    ).toEqual({
      objectives: 2,
      approvedProfiles: 1,
      profileCoveragePct: 50,
      misconceptionCoveragePct: 50,
      vocabularyCoveragePct: 0,
      approvedLinks: 1,
      proposedAssertions: 3,
    });
  });

  it("builds bounded generation context with a professional-judgement warning", () => {
    const prompt = buildCurriculumGraphPrompt({
      schemaVersion: 1,
      objective: { id: "o1", code: "B1", title: "Explain diffusion" },
      statement: "Explain net movement down a concentration gradient",
      successCriteria: ["Define diffusion"],
      prerequisites: [{ id: "p1", title: "Particle model", strength: "required" }],
      unlocks: [],
      misconceptions: [
        { title: "Particles choose to move", description: "Movement is random, not intentional" },
      ],
      vocabulary: [{ term: "gradient", definition: "a difference across distance" }],
      provenance: { approvedOnly: true, graphVersion: "reviewed_curriculum_graph_v1" },
    });
    expect(prompt).toContain("Particle model [required]");
    expect(prompt).toContain("gradient");
    expect(prompt).toContain("not proof that any pupil has a misconception");
    expect(prompt.length).toBeLessThanOrEqual(8000);
  });
});
