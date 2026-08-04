import { describe, expect, it } from "vitest";
import { dailyIntelligenceRunKey } from "./orchestrator";

describe("continuous intelligence orchestrator", () => {
  it("uses a stable per-school daily key for idempotent cron retries", () => {
    const now = new Date("2026-08-04T23:59:00Z");
    expect(dailyIntelligenceRunKey("school-1", now)).toBe(
      "continuous-teacher-os:school-1:2026-08-04",
    );
  });
});
