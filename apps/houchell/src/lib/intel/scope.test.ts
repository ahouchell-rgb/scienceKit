import { describe, expect, it } from "vitest";
import {
  WORKSPACE_LABEL, WORKSPACE_PURPOSE, workspaceLevelFor,
  type WorkspaceLevel,
} from "@/lib/navigation";
import { LEVELS, LEVEL_DEFS, levelForProfile, canSeePupilProperty } from "./scope";

/* These tests exist to stop ONE specific regression.

   The app's navigation and the intelligence console were built separately and
   each grew its own altitude model — navigation.ts had trust/school/department/
   teacher, the console had trust/head/hod/teacher. Same concept, two types,
   no shared source. That is how a product ends up telling a head of department
   one thing in the nav rail and another inside a screen.

   They are now one type. If someone adds a fifth altitude to either side, or
   renames one, these fail. */

describe("the altitude model is shared with app navigation", () => {
  it("declares exactly the workspace levels the nav declares", () => {
    const navLevels = Object.keys(WORKSPACE_LABEL) as WorkspaceLevel[];
    expect([...LEVELS].sort()).toEqual([...navLevels].sort());
  });

  it("takes its labels and purposes from navigation, never redefining them", () => {
    for (const level of LEVELS) {
      expect(LEVEL_DEFS[level].label).toBe(WORKSPACE_LABEL[level]);
      expect(LEVEL_DEFS[level].job).toBe(WORKSPACE_PURPOSE[level]);
    }
  });

  it("has a definition for every level, keyed consistently", () => {
    for (const level of LEVELS) expect(LEVEL_DEFS[level].key).toBe(level);
  });

  it("resolves a profile to the same altitude the nav would", () => {
    const profiles = [
      { trust_role: "trust_lead" },
      { school_role: "slt" },
      { school_role: "hod" },
      { role: "hod" },
      { is_lead: true },
      {},
      null,
    ];
    for (const p of profiles) expect(levelForProfile(p)).toBe(workspaceLevelFor(p));
  });
});

describe("what each altitude may see at pupil grain", () => {
  it("never resolves a child at trust level", () => {
    expect(LEVEL_DEFS.trust.maxPupilGrain).toBeNull();
    expect(canSeePupilProperty("trust", "internal")).toBe(false);
    expect(canSeePupilProperty("trust", "restricted")).toBe(false);
  });

  it("never exposes special-category data next to a name, at any altitude", () => {
    // SEND/EHCP/health are Art 9. Available for fairness monitoring on a
    // separate path only — see equality.ts.
    for (const level of LEVELS) expect(canSeePupilProperty(level, "special")).toBe(false);
  });

  it("lets department and teacher altitudes see restricted pupil data, school less", () => {
    expect(canSeePupilProperty("department", "restricted")).toBe(true);
    expect(canSeePupilProperty("teacher", "restricted")).toBe(true);
    expect(canSeePupilProperty("school", "restricted")).toBe(false);
    expect(canSeePupilProperty("school", "internal")).toBe(true);
  });
});
