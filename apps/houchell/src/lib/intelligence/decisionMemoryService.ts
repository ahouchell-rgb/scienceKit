import { artifactFingerprint } from "@/lib/artifactLineage";
import {
  RESPONSE_POLICY_KEY,
  RESPONSE_POLICY_VERSION,
} from "@/lib/intelligence/policyService";
import { skAdmin } from "@/lib/serverHelpers";

const rows = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value : [];

interface DecisionMemoryInput {
  recommendations: any[];
  deliveries: any[];
  rechecks: any[];
  outcomes: any[];
  feedback: any[];
}

export interface DecisionMemorySegment {
  contextSignature: string;
  findingType: string;
  objectiveKey: string | null;
  responseType: string;
  sampleSize: number;
  acceptedCount: number;
  deliveredCount: number;
  recheckedCount: number;
  outcomeCount: number;
  acceptanceRate: number | null;
  deliveryRate: number | null;
  recheckRate: number | null;
  meanTeacherRating: number | null;
  meanDescriptiveDelta: number | null;
  operationalScore: number;
  confidence: number;
  limitations: string[];
}

const rate = (numerator: number, denominator: number) =>
  denominator ? Number((numerator / denominator).toFixed(4)) : null;

const mean = (values: number[]) => values.length
  ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  : null;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function buildDecisionMemory(input: DecisionMemoryInput): DecisionMemorySegment[] {
  const byAction = <T extends { action_id?: string | null }>(values: T[]) => {
    const map = new Map<string, T[]>();
    for (const value of values) {
      if (!value.action_id) continue;
      map.set(value.action_id, [...(map.get(value.action_id) || []), value]);
    }
    return map;
  };
  const deliveries = byAction(input.deliveries);
  const rechecks = byAction(input.rechecks);
  const outcomes = byAction(input.outcomes);
  const feedback = byAction(input.feedback);
  const groups = new Map<string, any[]>();
  for (const recommendation of input.recommendations) {
    const findingType = String(recommendation.finding?.finding_type || "unknown");
    const objectiveKey = String(recommendation.finding?.objective_key || "") || null;
    const responseType = String(recommendation.recommendation_type || "unknown");
    const key = JSON.stringify([findingType, objectiveKey, responseType]);
    groups.set(key, [...(groups.get(key) || []), recommendation]);
  }

  return [...groups.values()].map((recommendations) => {
    const first = recommendations[0];
    const findingType = String(first.finding?.finding_type || "unknown");
    const objectiveKey = String(first.finding?.objective_key || "") || null;
    const responseType = String(first.recommendation_type || "unknown");
    const accepted = recommendations.filter((item) => item.status === "accepted" && item.action_id);
    const acceptedActionIds = accepted.map((item) => item.action_id as string);
    const deliveredCount = acceptedActionIds.filter((id) => (deliveries.get(id) || []).length > 0).length;
    const recheckedCount = acceptedActionIds.filter((id) =>
      (rechecks.get(id) || []).some((item: any) => item.status === "completed"),
    ).length;
    const outcomeValues = acceptedActionIds.flatMap((id) => outcomes.get(id) || []);
    const ratings = acceptedActionIds
      .flatMap((id) => feedback.get(id) || [])
      .map((item: any) => Number(item.rating))
      .filter(Number.isFinite);
    const deltas = outcomeValues.map((item: any) => Number(item.delta)).filter(Number.isFinite);
    const acceptanceRate = rate(accepted.length, recommendations.length);
    const deliveryRate = rate(deliveredCount, accepted.length);
    const recheckRate = rate(recheckedCount, deliveredCount);
    const rating = mean(ratings);
    const operationalScore = clamp(
      (acceptanceRate || 0) * 0.25 +
      (deliveryRate || 0) * 0.25 +
      (recheckRate || 0) * 0.3 +
      (rating ? (rating - 1) / 4 : 0) * 0.2,
    );
    const limitations = [
      "This score describes workflow usefulness and completion; it does not estimate causal impact.",
    ];
    if (recommendations.length < 10) limitations.push("The segment has fewer than 10 recommendations.");
    if (!outcomeValues.length) limitations.push("No delayed outcome evidence is available for this segment.");
    if (!ratings.length) limitations.push("No teacher rating is available for this segment.");
    return {
      contextSignature: artifactFingerprint({ findingType, objectiveKey, responseType }),
      findingType,
      objectiveKey,
      responseType,
      sampleSize: recommendations.length,
      acceptedCount: accepted.length,
      deliveredCount,
      recheckedCount,
      outcomeCount: outcomeValues.length,
      acceptanceRate,
      deliveryRate,
      recheckRate,
      meanTeacherRating: rating,
      meanDescriptiveDelta: mean(deltas),
      operationalScore: Number(operationalScore.toFixed(4)),
      confidence: Number(Math.min(1, recommendations.length / 25).toFixed(4)),
      limitations,
    };
  }).sort((left, right) => right.operationalScore - left.operationalScore);
}

async function fetchRelated(table: string, actionIds: string[], select: string) {
  const chunks: string[][] = [];
  for (let index = 0; index < actionIds.length; index += 100) {
    chunks.push(actionIds.slice(index, index + 100));
  }
  const values = await Promise.all(chunks.map((chunk) => skAdmin(
    "GET",
    `${table}?action_id=in.(${chunk.join(",")})&select=${select}&limit=5000`,
  )));
  return values.flatMap((value) => rows(value));
}

export async function refreshSchoolDecisionMemory(schoolId: string, now = new Date()) {
  const runKey = `decision-memory:${schoolId}:${now.toISOString().slice(0, 10)}:v1`;
  const existing = rows<any>(await skAdmin(
    "GET",
    `intelligence_response_policy_scores?school_id=eq.${schoolId}&run_key=eq.${encodeURIComponent(runKey)}&select=*&limit=1`,
  ));
  if (existing.length) return { scores: existing, reused: true };

  const recommendations = rows<any>(await skAdmin(
    "GET",
    `intelligence_recommendations?school_id=eq.${schoolId}&select=*,finding:intelligence_findings(finding_type,objective_key)&limit=5000`,
  ));
  const actionIds = [...new Set(recommendations.map((row) => row.action_id).filter(Boolean))].slice(0, 5000) as string[];
  const [deliveries, rechecks, outcomes, feedback] = await Promise.all(
    actionIds.length ? [
      fetchRelated("intelligence_deliveries", actionIds, "id,action_id,delivered_at"),
      fetchRelated("intelligence_rechecks", actionIds, "id,action_id,status,due_at,completed_at"),
      fetchRelated("intelligence_outcomes", actionIds, "id,action_id,delta,evaluated_at"),
      fetchRelated("intelligence_feedback", actionIds, "id,action_id,feedback_type,rating,created_at"),
    ] : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([]), Promise.resolve([])],
  );
  const segments = buildDecisionMemory({
    recommendations,
    deliveries: rows(deliveries),
    rechecks: rows(rechecks),
    outcomes: rows(outcomes),
    feedback: rows(feedback),
  });
  const inserted = segments.length ? rows<any>(await skAdmin(
    "POST",
    "intelligence_response_policy_scores",
    segments.map((segment) => ({
      school_id: schoolId,
      policy_key: RESPONSE_POLICY_KEY,
      policy_version: RESPONSE_POLICY_VERSION,
      run_key: runKey,
      context_signature: segment.contextSignature,
      finding_type: segment.findingType,
      objective_key: segment.objectiveKey,
      response_type: segment.responseType,
      sample_size: segment.sampleSize,
      accepted_count: segment.acceptedCount,
      delivered_count: segment.deliveredCount,
      rechecked_count: segment.recheckedCount,
      outcome_count: segment.outcomeCount,
      acceptance_rate: segment.acceptanceRate,
      delivery_rate: segment.deliveryRate,
      recheck_rate: segment.recheckRate,
      mean_teacher_rating: segment.meanTeacherRating,
      mean_descriptive_delta: segment.meanDescriptiveDelta,
      operational_score: segment.operationalScore,
      confidence: segment.confidence,
      limitations: segment.limitations,
      evaluated_at: now.toISOString(),
    })),
  )) : [];
  return { scores: inserted, segmentCount: segments.length, reused: false };
}
