export const PUPIL_SOURCE_SYSTEMS = [
  "retrieval_profile",
  "mis_student",
  "springboard_pupil",
  "guardian_student",
  "assessment_roster",
  "manual",
] as const;

export type PupilSourceSystem = (typeof PUPIL_SOURCE_SYSTEMS)[number];

export interface SourceIdentityRef {
  sourceSystem: PupilSourceSystem;
  sourceRecordId: string;
  sourceTenantKey?: string | null;
  upn?: string | null;
}

export interface IncomingPupilIdentity extends SourceIdentityRef {
  schoolId: string;
  displayName: string;
  yearGroup?: number | null;
  formGroup?: string | null;
}

export interface IdentityCandidate {
  pupilId: string;
  schoolId: string;
  displayName: string;
  yearGroup?: number | null;
  formGroup?: string | null;
  sourceIdentities?: SourceIdentityRef[];
}

export type IdentityReasonCode =
  | "source_record_already_linked"
  | "unique_verified_upn"
  | "shared_legacy_uuid"
  | "same_name_year_and_form"
  | "same_name_and_year"
  | "same_name_only"
  | "multiple_strong_candidates"
  | "authoritative_source_new_pupil"
  | "no_safe_match";

export interface RankedIdentityCandidate {
  pupilId: string;
  confidence: number;
  reasons: IdentityReasonCode[];
}

export type IdentityRecommendation =
  | {
      action: "use_existing";
      pupilId: string;
      confidence: 1;
      matchMethod: "existing_link";
      requiresReview: false;
      reasons: IdentityReasonCode[];
      candidates: RankedIdentityCandidate[];
    }
  | {
      action: "propose_link";
      pupilId: string;
      confidence: number;
      matchMethod: "verified_upn" | "shared_legacy_uuid" | "manual_review";
      requiresReview: true;
      reasons: IdentityReasonCode[];
      candidates: RankedIdentityCandidate[];
    }
  | {
      action: "create_pupil";
      confidence: 1;
      matchMethod: "manual_create";
      requiresReview: false;
      reasons: IdentityReasonCode[];
      candidates: [];
    }
  | {
      action: "manual_review";
      confidence: number;
      matchMethod: "manual_review";
      requiresReview: true;
      reasons: IdentityReasonCode[];
      candidates: RankedIdentityCandidate[];
    };

function canonicalTenantKey(value?: string | null): string {
  return value?.trim() ?? "";
}

export function normalizePupilName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-GB")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeUpn(value?: string | null): string | null {
  const normalized = value?.toUpperCase().replace(/\s+/g, "").trim();
  return normalized || null;
}

function sameSourceRecord(incoming: IncomingPupilIdentity, ref: SourceIdentityRef): boolean {
  return (
    incoming.sourceSystem === ref.sourceSystem &&
    canonicalTenantKey(incoming.sourceTenantKey) === canonicalTenantKey(ref.sourceTenantKey) &&
    incoming.sourceRecordId.trim() === ref.sourceRecordId.trim()
  );
}

function hasSharedLegacyUuid(incoming: IncomingPupilIdentity, ref: SourceIdentityRef): boolean {
  const legacySources: PupilSourceSystem[] = [
    "retrieval_profile",
    "springboard_pupil",
    "guardian_student",
  ];

  return (
    legacySources.includes(incoming.sourceSystem) &&
    legacySources.includes(ref.sourceSystem) &&
    incoming.sourceRecordId.trim().toLowerCase() === ref.sourceRecordId.trim().toLowerCase()
  );
}

export function rankIdentityCandidates(
  incoming: IncomingPupilIdentity,
  candidates: IdentityCandidate[],
): RankedIdentityCandidate[] {
  const incomingName = normalizePupilName(incoming.displayName);
  const incomingUpn = normalizeUpn(incoming.upn);

  return candidates
    .filter((candidate) => candidate.schoolId === incoming.schoolId)
    .map((candidate) => {
      const reasons: IdentityReasonCode[] = [];
      let confidence = 0;
      const refs = candidate.sourceIdentities ?? [];

      if (refs.some((ref) => sameSourceRecord(incoming, ref))) {
        reasons.push("source_record_already_linked");
        confidence = 1;
      } else {
        const candidateUpns = refs.map((ref) => normalizeUpn(ref.upn)).filter(Boolean);
        if (incomingUpn && candidateUpns.includes(incomingUpn)) {
          reasons.push("unique_verified_upn");
          confidence = Math.max(confidence, 0.99);
        }

        if (refs.some((ref) => hasSharedLegacyUuid(incoming, ref))) {
          reasons.push("shared_legacy_uuid");
          confidence = Math.max(confidence, 0.96);
        }

        if (incomingName && incomingName === normalizePupilName(candidate.displayName)) {
          const sameYear =
            incoming.yearGroup != null &&
            candidate.yearGroup != null &&
            incoming.yearGroup === candidate.yearGroup;
          const sameForm =
            Boolean(incoming.formGroup?.trim()) &&
            Boolean(candidate.formGroup?.trim()) &&
            incoming.formGroup?.trim().toLocaleLowerCase("en-GB") ===
              candidate.formGroup?.trim().toLocaleLowerCase("en-GB");

          if (sameYear && sameForm) {
            reasons.push("same_name_year_and_form");
            confidence = Math.max(confidence, 0.78);
          } else if (sameYear) {
            reasons.push("same_name_and_year");
            confidence = Math.max(confidence, 0.7);
          } else {
            reasons.push("same_name_only");
            confidence = Math.max(confidence, 0.55);
          }
        }
      }

      return { pupilId: candidate.pupilId, confidence, reasons };
    })
    .filter((candidate) => candidate.confidence > 0)
    .sort((left, right) => right.confidence - left.confidence || left.pupilId.localeCompare(right.pupilId));
}

export function recommendIdentityResolution(
  incoming: IncomingPupilIdentity,
  candidates: IdentityCandidate[],
): IdentityRecommendation {
  const ranked = rankIdentityCandidates(incoming, candidates);
  const exactSource = ranked.find((candidate) =>
    candidate.reasons.includes("source_record_already_linked"),
  );

  if (exactSource) {
    return {
      action: "use_existing",
      pupilId: exactSource.pupilId,
      confidence: 1,
      matchMethod: "existing_link",
      requiresReview: false,
      reasons: exactSource.reasons,
      candidates: ranked,
    };
  }

  const strong = ranked.filter((candidate) => candidate.confidence >= 0.95);
  if (strong.length === 1) {
    const winner = strong[0];
    return {
      action: "propose_link",
      pupilId: winner.pupilId,
      confidence: winner.confidence,
      matchMethod: winner.reasons.includes("unique_verified_upn")
        ? "verified_upn"
        : "shared_legacy_uuid",
      requiresReview: true,
      reasons: winner.reasons,
      candidates: ranked,
    };
  }

  if (strong.length > 1) {
    return {
      action: "manual_review",
      confidence: strong[0].confidence,
      matchMethod: "manual_review",
      requiresReview: true,
      reasons: ["multiple_strong_candidates"],
      candidates: ranked,
    };
  }

  if (ranked.length > 0) {
    return {
      action: "manual_review",
      confidence: ranked[0].confidence,
      matchMethod: "manual_review",
      requiresReview: true,
      reasons: ranked[0].reasons,
      candidates: ranked,
    };
  }

  if (incoming.sourceSystem === "mis_student") {
    return {
      action: "create_pupil",
      confidence: 1,
      matchMethod: "manual_create",
      requiresReview: false,
      reasons: ["authoritative_source_new_pupil"],
      candidates: [],
    };
  }

  return {
    action: "manual_review",
    confidence: 0,
    matchMethod: "manual_review",
    requiresReview: true,
    reasons: ["no_safe_match"],
    candidates: [],
  };
}
