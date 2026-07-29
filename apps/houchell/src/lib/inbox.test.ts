import { describe, expect, it } from "vitest";
import { inboxQueues } from "./inbox.js";

describe("inboxQueues", () => {
  it("keeps common teaching queues visible at every altitude", () => {
    for (const profile of [{}, { school_role: "hod" }, { school_role: "slt" }, { trust_role: "trust_lead" }]) {
      const keys = inboxQueues(profile).map((queue) => queue.key);
      expect(keys).toContain("findings");
      expect(keys).toContain("assessment");
    }
  });

  it("adds role-specific queues without exposing school interventions to teachers", () => {
    expect(inboxQueues({}).some((queue) => queue.key === "interventions")).toBe(false);
    expect(inboxQueues({ school_role: "slt" }).some((queue) => queue.key === "interventions")).toBe(true);
    expect(inboxQueues({ trust_role: "trust_lead" }).some((queue) => queue.key === "trust_support")).toBe(true);
  });
});
