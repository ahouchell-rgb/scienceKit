import { describe, expect, it } from "vitest";
import {
  academicYearLabel,
  isNavigationActive,
  isStaffRoute,
  routeContext,
  workspaceHome,
  workspaceLevelFor,
  workspaceNavigation,
} from "./navigation.js";

describe("workspace navigation", () => {
  it("selects the highest authorised altitude", () => {
    expect(workspaceLevelFor(null)).toBe("teacher");
    expect(workspaceLevelFor({ school_role: "hod" })).toBe("department");
    expect(workspaceLevelFor({ school_role: "slt" })).toBe("school");
    expect(workspaceLevelFor({ school_role: "slt", trust_role: "trust_lead" })).toBe("trust");
  });

  it("gives every workspace the common curriculum, intelligence and inbox objects", () => {
    const profiles = [
      {},
      { school_role: "hod" },
      { school_role: "slt" },
      { trust_role: "trust_lead" },
    ];
    for (const profile of profiles) {
      const hrefs = workspaceNavigation(profile).map((item) => item.href);
      expect(hrefs).toContain("/curriculum");
      expect(hrefs).toContain("/intel");
      expect(hrefs).toContain("/inbox");
    }
  });

  it("adds content review for authors without duplicating the navigation contract", () => {
    const hrefs = workspaceNavigation({ is_lead: true }).map((item) => item.href);
    expect(hrefs.filter((href) => href === "/content")).toHaveLength(1);
  });

  it("lands a department lead in the dedicated department workspace", () => {
    expect(workspaceHome("department")).toBe("/department");
    expect(workspaceNavigation({ school_role: "hod" })[0].href).toBe("/department");
    expect(routeContext("/department")).toBe("Department");
  });
});

describe("route ownership", () => {
  it("keeps focused pupil/content runtimes outside the staff workspace", () => {
    expect(isStaffRoute("/learn")).toBe(false);
    expect(isStaffRoute("/retrieve/topic/1")).toBe(false);
    expect(isStaffRoute("/tools")).toBe(false);
    expect(isStaffRoute("/school")).toBe(true);
  });

  it("treats unit pages as curriculum and nested routes as active", () => {
    const curriculum = { href: "/curriculum", label: "Curriculum", aliases: ["/unit"] };
    expect(isNavigationActive(curriculum, "/unit/u1/lesson/l1")).toBe(true);
    expect(routeContext("/unit/u1/lesson/l1")).toBe("Lesson");
    expect(routeContext("/school/intervention")).toBe("Interventions");
    expect(routeContext("/class/c1")).toBe("Class 360");
    expect(routeContext("/objective/o1")).toBe("Objective 360");
    expect(routeContext("/response/a1")).toBe("Response loop");
  });
});

describe("academic year", () => {
  it("rolls over in August", () => {
    expect(academicYearLabel(new Date("2026-07-29T12:00:00Z"))).toBe("2025–26");
    expect(academicYearLabel(new Date("2026-08-01T12:00:00Z"))).toBe("2026–27");
  });
});
