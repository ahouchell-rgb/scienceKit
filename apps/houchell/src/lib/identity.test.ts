import { describe, expect, it } from "vitest";
import {
  normalizePupilName,
  normalizeUpn,
  recommendIdentityResolution,
  type IdentityCandidate,
  type IncomingPupilIdentity,
} from "./identity";

const incoming: IncomingPupilIdentity = {
  schoolId: "school-a",
  sourceSystem: "mis_student",
  sourceTenantKey: "wonde-school-1",
  sourceRecordId: "mis-42",
  displayName: "Zoë O’Neil",
  yearGroup: 9,
  formGroup: "9B",
  upn: " A123 456 789 ",
};

const candidate = (overrides: Partial<IdentityCandidate> = {}): IdentityCandidate => ({
  pupilId: "pupil-1",
  schoolId: "school-a",
  displayName: "Zoe O'Neil",
  yearGroup: 9,
  formGroup: "9b",
  sourceIdentities: [],
  ...overrides,
});

describe("canonical pupil identity resolution", () => {
  it("normalises names and UPNs for comparison without treating names as identifiers", () => {
    expect(normalizePupilName("  Zoë  O’Neil ")).toBe("zoe oneil");
    expect(normalizeUpn(" A123 456 789 ")).toBe("A123456789");
  });

  it("reuses an existing source mapping deterministically", () => {
    const result = recommendIdentityResolution(incoming, [
      candidate({
        sourceIdentities: [
          {
            sourceSystem: "mis_student",
            sourceTenantKey: "wonde-school-1",
            sourceRecordId: "mis-42",
          },
        ],
      }),
    ]);

    expect(result).toMatchObject({
      action: "use_existing",
      pupilId: "pupil-1",
      confidence: 1,
      requiresReview: false,
    });
  });

  it("proposes but does not silently merge a unique exact UPN", () => {
    const result = recommendIdentityResolution(incoming, [
      candidate({
        sourceIdentities: [
          {
            sourceSystem: "retrieval_profile",
            sourceRecordId: "legacy-1",
            upn: "A123456789",
          },
        ],
      }),
    ]);

    expect(result).toMatchObject({
      action: "propose_link",
      pupilId: "pupil-1",
      matchMethod: "verified_upn",
      confidence: 0.99,
      requiresReview: true,
    });
  });

  it("sends name, year and form matches to human review", () => {
    const result = recommendIdentityResolution(incoming, [candidate()]);

    expect(result).toMatchObject({
      action: "manual_review",
      confidence: 0.78,
      requiresReview: true,
      reasons: ["same_name_year_and_form"],
    });
  });

  it("does not compare pupils across schools", () => {
    const result = recommendIdentityResolution(incoming, [
      candidate({
        schoolId: "school-b",
        sourceIdentities: [
          {
            sourceSystem: "retrieval_profile",
            sourceRecordId: "legacy-1",
            upn: "A123456789",
          },
        ],
      }),
    ]);

    expect(result).toMatchObject({
      action: "create_pupil",
      reasons: ["authoritative_source_new_pupil"],
    });
  });

  it("creates a new canonical pupil only from an unmatched authoritative MIS row", () => {
    const result = recommendIdentityResolution(incoming, []);
    const nonAuthoritative = recommendIdentityResolution(
      { ...incoming, sourceSystem: "assessment_roster" },
      [],
    );

    expect(result.action).toBe("create_pupil");
    expect(nonAuthoritative).toMatchObject({
      action: "manual_review",
      confidence: 0,
      requiresReview: true,
      reasons: ["no_safe_match"],
    });
  });

  it("requires review when a strong identifier resolves to multiple pupils", () => {
    const ref = {
      sourceSystem: "retrieval_profile" as const,
      sourceRecordId: "legacy",
      upn: "A123456789",
    };
    const result = recommendIdentityResolution(incoming, [
      candidate({ pupilId: "pupil-1", sourceIdentities: [ref] }),
      candidate({ pupilId: "pupil-2", sourceIdentities: [ref] }),
    ]);

    expect(result).toMatchObject({
      action: "manual_review",
      requiresReview: true,
      reasons: ["multiple_strong_candidates"],
    });
  });
});
