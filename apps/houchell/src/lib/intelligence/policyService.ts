import { artifactFingerprint } from "@/lib/artifactLineage";
import { evaluateResponsePolicy } from "@/lib/intelligence/operatingSystem";
import { skAdmin } from "@/lib/serverHelpers";

export const RESPONSE_POLICY_KEY = "reviewed_learning_gap_response";
export const RESPONSE_POLICY_VERSION = 1;

const rows = <T = any>(value: unknown): T[] => Array.isArray(value) ? value : [];

export interface EvaluationActor {
  kind: "human" | "system";
  userId: string | null;
}

export async function evaluateSchoolResponsePolicy(options: {
  schoolId: string;
  actor: EvaluationActor;
  force?: boolean;
}) {
  const dayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  if (!options.force) {
    const existing = rows<any>(await skAdmin(
      "GET",
      `intelligence_policy_evaluations?school_id=eq.${options.schoolId}&policy_key=eq.${RESPONSE_POLICY_KEY}&policy_version=eq.${RESPONSE_POLICY_VERSION}&evaluated_at=gte.${dayStart}&select=*&order=evaluated_at.desc&limit=1`,
    ))[0];
    if (existing) return { evaluation: existing, reused: true };
  }

  const recommendations = rows<any>(await skAdmin(
    "GET",
    `intelligence_recommendations?school_id=eq.${options.schoolId}&policy_key=eq.${RESPONSE_POLICY_KEY}&policy_version=eq.${RESPONSE_POLICY_VERSION}&select=*&limit=5000`,
  ));
  const actionIds = recommendations.map((row) => row.action_id).filter(Boolean);
  const actionIdSet = new Set(actionIds);
  const [deliveries, rechecks, outcomes, feedback] = await Promise.all([
    skAdmin("GET", "intelligence_deliveries?select=id,action_id,delivered_at&limit=5000"),
    skAdmin("GET", "intelligence_rechecks?select=id,action_id,status,due_at,completed_at&limit=5000"),
    skAdmin("GET", "intelligence_outcomes?select=id,action_id,delta,evaluated_at&limit=5000"),
    skAdmin("GET", "intelligence_feedback?select=id,action_id,feedback_type,rating,created_at&limit=5000"),
  ]);
  const evaluation = evaluateResponsePolicy({
    recommendations,
    deliveries: rows<any>(deliveries).filter((row) => actionIdSet.has(row.action_id)),
    rechecks: rows<any>(rechecks).filter((row) => actionIdSet.has(row.action_id)),
    outcomes: rows<any>(outcomes).filter((row) => actionIdSet.has(row.action_id)),
    feedback: rows<any>(feedback).filter((row) => actionIdSet.has(row.action_id)),
  });
  const sourceScanTruncated = [deliveries, rechecks, outcomes, feedback]
    .some((value) => rows(value).length >= 5000);
  const limitations = sourceScanTruncated
    ? [...evaluation.limitations, "The response evidence scan reached its 5,000-row operational cap and is incomplete."]
    : evaluation.limitations;
  const now = new Date();
  const firstRecommendationAt = recommendations
    .map((row) => Date.parse(row.created_at))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0];
  const windowStart = Number.isFinite(firstRecommendationAt)
    ? new Date(firstRecommendationAt)
    : new Date(now.getTime() - 90 * 86_400_000);
  const inserted = rows<any>(await skAdmin("POST", "intelligence_policy_evaluations", {
    school_id: options.schoolId,
    policy_key: RESPONSE_POLICY_KEY,
    policy_version: RESPONSE_POLICY_VERSION,
    window_started_at: windowStart.toISOString(),
    window_ended_at: now.toISOString(),
    evaluation_status: evaluation.evaluationStatus,
    recommendation_count: evaluation.recommendationCount,
    accepted_count: evaluation.acceptedCount,
    delivered_count: evaluation.deliveredCount,
    rechecked_count: evaluation.recheckedCount,
    outcome_count: evaluation.outcomeCount,
    teacher_override_count: evaluation.teacherOverrideCount,
    acceptance_rate: evaluation.acceptanceRate,
    delivery_rate: evaluation.deliveryRate,
    recheck_rate: evaluation.recheckRate,
    mean_teacher_rating: evaluation.meanTeacherRating,
    mean_descriptive_delta: evaluation.meanDescriptiveDelta,
    metrics: {
      thresholds: { minimumOutcomes: 20, minimumRecheckRate: 0.6 },
      sourceScanTruncated,
    },
    limitations,
    evaluator_version: 1,
    evaluated_by_kind: options.actor.kind,
    evaluated_by: options.actor.userId,
  }));
  await skAdmin("POST", "intelligence_monitoring_events", {
    school_id: options.schoolId,
    subsystem: "learning_policy",
    event_type: "policy.evaluated",
    severity: evaluation.evaluationStatus === "retire_review" ? "warning" : "info",
    run_key: `policy:${artifactFingerprint({ schoolId: options.schoolId, at: now.toISOString(), evaluation })}`,
    detail: {
      policyKey: RESPONSE_POLICY_KEY,
      policyVersion: RESPONSE_POLICY_VERSION,
      evaluationStatus: evaluation.evaluationStatus,
      outcomeCount: evaluation.outcomeCount,
      automaticPromotion: false,
    },
    observed_at: now.toISOString(),
  });
  return { evaluation: inserted[0], reused: false };
}
