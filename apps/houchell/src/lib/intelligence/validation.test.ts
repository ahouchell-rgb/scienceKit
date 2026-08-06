import { describe, expect, it } from "vitest";
import {
  parseCopilotRequest,
  parseOperatingSystemCommand,
  ValidationError,
} from "./validation";

const schoolId = "00000000-0000-4000-8000-000000000001";

describe("intelligence API validation", () => {
  it("normalises a valid operating-system command", () => {
    expect(parseOperatingSystemCommand({ schoolId, operation: "run_adaptive_cycle" }))
      .toMatchObject({ schoolId, operation: "run_adaptive_cycle" });
  });

  it("rejects unsupported operations before any data access", () => {
    expect(() => parseOperatingSystemCommand({ schoolId, operation: "delete_everything" }))
      .toThrow(ValidationError);
  });

  it("bounds copilot questions and validates school scope identifiers", () => {
    expect(parseCopilotRequest({ schoolId, message: "  What needs teaching next?  " }))
      .toEqual({ schoolId, message: "What needs teaching next?" });
    expect(() => parseCopilotRequest({ schoolId: "school-1", message: "hello" }))
      .toThrow("School must be a valid id");
    expect(() => parseCopilotRequest({ schoolId, message: "x".repeat(2001) }))
      .toThrow("Question must be between 3 and 2000 characters");
  });
});
