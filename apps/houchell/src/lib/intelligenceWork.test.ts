import { describe, expect, it } from "vitest";
import {
  canTransitionAction,
  normaliseDueAt,
  workUrgency,
  type ActionTransitionContext,
} from "./intelligenceWork";

const transition = (
  overrides: Partial<ActionTransitionContext> = {},
): ActionTransitionContext => ({
  current: "proposed",
  next: "accepted",
  actorId: "owner",
  ownerId: "owner",
  createdBy: "creator",
  canManageScope: false,
  ...overrides,
});

describe("persistent intelligence work", () => {
  it("requires an owner before an action can be accepted", () => {
    expect(canTransitionAction(transition({ ownerId: null }))).toMatchObject({
      allowed: false,
      reason: "Assign an owner before accepting the action.",
    });
  });

  it("requires the owner or a scoped leader to accept", () => {
    expect(
      canTransitionAction(
        transition({ actorId: "creator", ownerId: "someone-else", createdBy: "creator" }),
      ),
    ).toMatchObject({ allowed: false });
    expect(
      canTransitionAction(
        transition({
          actorId: "leader",
          ownerId: "someone-else",
          canManageScope: true,
        }),
      ),
    ).toEqual({ allowed: true });
  });

  it("rejects skipped workflow states", () => {
    expect(canTransitionAction(transition({ next: "completed" }))).toMatchObject({
      allowed: false,
    });
  });

  it("requires a recorded outcome before completion", () => {
    expect(
      canTransitionAction(
        transition({
          current: "in_progress",
          next: "completed",
          outcomeSummary: " ",
        }),
      ),
    ).toMatchObject({ allowed: false, reason: "Record an outcome before completing the action." });
    expect(
      canTransitionAction(
        transition({
          current: "in_progress",
          next: "completed",
          outcomeSummary: "Recheck improved by 14 points.",
        }),
      ),
    ).toEqual({ allowed: true });
  });

  it("normalises valid due dates and rejects invalid dates", () => {
    expect(normaliseDueAt("2026-08-01T09:00:00+01:00")).toBe("2026-08-01T08:00:00.000Z");
    expect(normaliseDueAt("not-a-date")).toBeNull();
  });

  it("classifies overdue and closed work without mutating it", () => {
    const now = Date.parse("2026-07-29T12:00:00Z");
    expect(workUrgency("2026-07-28T12:00:00Z", "in_progress", now)).toBe("overdue");
    expect(workUrgency("2026-07-30T12:00:00Z", "accepted", now)).toBe("due_soon");
    expect(workUrgency(null, "proposed", now)).toBe("unscheduled");
    expect(workUrgency("2026-07-28T12:00:00Z", "completed", now)).toBe("closed");
  });
});
