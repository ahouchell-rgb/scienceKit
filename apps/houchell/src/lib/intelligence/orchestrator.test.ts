import { describe, expect, it } from "vitest";
import { dailyIntelligenceRunKey } from "./orchestrator";

describe("adaptive intelligence orchestrator", () => {
  it("uses a stable per-school daily key for idempotent cron retries", () => {
    const now = new Date("2026-08-04T23:59:00Z");
    expect(dailyIntelligenceRunKey("school-1", now)).toBe(
      "adaptive-education-os:school-1:2026-08-04",
    );
  });
});
