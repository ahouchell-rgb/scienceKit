import { artifactFingerprint } from "@/lib/artifactLineage";
import {
  buildTodayQueue,
  evaluateResponsePolicy,
  operatingContract,
  summariseBrainHealth,
} from "@/lib/intelligence/operatingSystem";
import {
  authenticateIntelligence,
  canControlIntelligenceWork,
  canManageSchool,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
  UUID_RE,
  type IntelligenceAuth,
} from "@/lib/intelligence/server";
import { skAdmin } from "@/lib/serverHelpers";

export const runtime = "nodejs";
export const maxDuration = 120;

const POLICY_KEY = "reviewed_learning_gap_response";
const POLICY_VERSION = 1;

const rows = <T = any>(value: unknown): T[] => Array.isArray(value) ? value : [];

async function availableSchools(auth: IntelligenceAuth) {
  if (auth.profile.trust_role === "trust_lead" && auth.profile.trust_id) {
    return rows<{ id: string; name: string; trust_id?: string | null }>(
      await restAsUser(
        `schools?trust_id=eq.${auth.profile.trust_id}&select=id,name,trust_id&order=name.asc`,
        auth.token,
      ),
    );
  }
  if (!auth.profile.school_id) return [];
  return rows<{ id: string; name: string; trust_id?: string | null }>(
    await restAsUser(
      `schools?id=eq.${auth.profile.school_id}&select=id,name,trust_id&limit=1`,
      auth.token,
    ),
  );
}

async function resolveSchool(request: Request, auth: IntelligenceAuth) {
  const schools = await availableSchools(auth);
  const requested = new URL(request.url).searchParams.get("schoolId") || "";
  const selected = requested
    ? schools.find((school) => school.id === requested)
    : schools[0];
  return { schools, selected: selected || null, requested };
}

export async function GET(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  try {
    const { schools, selected, requested } = await resolveSchool(request, auth);
    if (requested && !selected) {
      return jsonNoStore({ error: "School is outside your permitted scope" }, 403);
    }
    if (!selected) {
      return jsonNoStore({
        enabled: true,
        reason: "no_school_scope",
        profile: auth.profile,
        schools,
        role: operatingContract(auth.profile),
        queue: [],
      });
    }

    const schoolId = selected.id;
    const [
      summaries,
      health,
      recommendations,
      findings,
      rechecks,
      lessonSpecs,
      policyEvaluations,
      monitoringEvents,
      evaluations,
    ] = await Promise.all([
      restAsUser(
        `intelligence_operating_system_summary?school_id=eq.${schoolId}&select=*&limit=1`,
        auth.token,
      ),
      restAsUser(
        `intelligence_source_health?school_id=eq.${schoolId}&select=*&order=required.desc,source_key.asc`,
        auth.token,
      ),
      restAsUser(
        `intelligence_recommendations?school_id=eq.${schoolId}&select=*,finding:intelligence_findings(scope_type)&order=created_at.desc&limit=100`,
        auth.token,
      ),
      restAsUser(
        `intelligence_findings?school_id=eq.${schoolId}&select=id,school_id,trust_id,class_id,objective_id,objective_key,scope_type,headline,summary,evidence_snapshot,evidence_as_of,evidence_strength,status,raised_by,actions:intelligence_actions(id,title,description,priority,status,due_at,owner_id,created_by,requires_human_acceptance)&order=created_at.desc&limit=200`,
        auth.token,
      ),
      restAsUser(
        `intelligence_rechecks?select=id,action_id,finding_id,objective_key,status,due_at,created_at,finding:intelligence_findings!inner(school_id,headline)&finding.school_id=eq.${schoolId}&status=eq.scheduled&order=due_at.asc&limit=100`,
        auth.token,
      ),
      restAsUser(
        `intelligence_lesson_specs?school_id=eq.${schoolId}&select=id,action_id,finding_id,unit_id,lesson_id,schema_version,output_contract,created_at,finding:intelligence_findings(scope_type)&order=created_at.desc&limit=30`,
        auth.token,
      ),
      restAsUser(
        `intelligence_policy_evaluations?school_id=eq.${schoolId}&select=*&order=evaluated_at.desc&limit=12`,
        auth.token,
      ),
      restAsUser(
        `intelligence_monitoring_events?school_id=eq.${schoolId}&select=*&order=observed_at.desc&limit=30`,
        auth.token,
      ),
      restAsUser(
        `intelligence_evaluation_summary?school_id=eq.${schoolId}&select=*&limit=1`,
        auth.token,
      ),
    ]);

    const contract = operatingContract(auth.profile);
    const trustSafe = (row: any) => contract.level !== "trust" || row?.finding?.scope_type !== "pupil";
    const recommendationRows = rows(recommendations).filter(trustSafe);
    const findingRows = rows<any>(findings).filter(
      (row) => contract.level !== "trust" || row.scope_type !== "pupil",
    );
    const recheckRows = rows(rechecks);
    return jsonNoStore({
      enabled: true,
      profile: auth.profile,
      selectedSchoolId: schoolId,
      schools,
      role: contract,
      permissions: {
        canManageSchool: await canManageSchool(auth, schoolId),
      },
      summary: rows(summaries)[0] || null,
      brain: summariseBrainHealth(rows(health)),
      queue: buildTodayQueue({
        findings: findingRows,
        recommendations: recommendationRows,
        rechecks: recheckRows,
        limit: contract.queueLimit,
      }),
      recommendations: recommendationRows,
      lessonSpecs: rows(lessonSpecs).filter(trustSafe),
      policyEvaluations: rows(policyEvaluations),
      monitoringEvents: rows(monitoringEvents),
      evaluation: rows(evaluations)[0] || null,
      guardrails: {
        automatedDecisions: false,
        pupilRiskScore: false,
        automaticPolicyPromotion: false,
        causalClaims: false,
        humanAcceptanceRequired: true,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (
      isMissingDatabaseObject(error, [
        "intelligence_operating_system_summary",
        "intelligence_source_health",
        "intelligence_recommendations",
        "intelligence_lesson_specs",
        "intelligence_policy_evaluations",
        "intelligence_monitoring_events",
      ])
    ) {
      return jsonNoStore({ enabled: false, reason: "stage_15_20_migration_pending" });
    }
    return jsonNoStore({ error: "Couldn't load the teacher operating system" }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, 400);
  }

  const schoolId = String(body.schoolId || "");
  if (!UUID_RE.test(schoolId)) return jsonNoStore({ error: "A valid school is required" }, 400);
  const schools = await availableSchools(auth).catch(() => []);
  if (!schools.some((school) => school.id === schoolId)) {
    return jsonNoStore({ error: "School is outside your permitted scope" }, 403);
  }

  const operation = String(body.operation || "");
  if (operation === "refresh_health") {
    if (!(await canManageSchool(auth, schoolId))) {
      return jsonNoStore({ error: "School intelligence management scope required" }, 403);
    }
    try {
      const result = await skAdmin("POST", "rpc/refresh_intelligence_brain_health", {
        p_school_id: schoolId,
        p_checked_by: auth.userId,
      });
      return jsonNoStore({ brain: result });
    } catch (error) {
      if (isMissingDatabaseObject(error, ["refresh_intelligence_brain_health"])) {
        return jsonNoStore({ error: "Apply the Stage 15-20 migration before activating brain health" }, 503);
      }
      return jsonNoStore({ error: "Couldn't refresh brain health" }, 500);
    }
  }

  if (operation === "prepare_recommendation") {
    const findingId = String(body.findingId || "");
    if (!UUID_RE.test(findingId)) return jsonNoStore({ error: "Invalid finding id" }, 400);
    try {
      const finding = rows<any>(await restAsUser(
        `intelligence_findings?id=eq.${findingId}&school_id=eq.${schoolId}&select=*&limit=1`,
        auth.token,
      ))[0];
      if (!finding) return jsonNoStore({ error: "Finding not found in your scope" }, 404);
      if (!(await canControlIntelligenceWork(auth, finding))) {
        return jsonNoStore({ error: "You cannot prepare a response for this finding" }, 403);
      }
      if (finding.status !== "open" && finding.status !== "accepted") {
        return jsonNoStore({ error: "Only active reviewed findings can become recommendations" }, 409);
      }

      const allowedTypes = [
        "reteach", "review_evidence", "curriculum_change", "department_brief",
        "pupil_support", "data_repair", "monitor",
      ];
      const recommendationType = allowedTypes.includes(body.recommendationType)
        ? body.recommendationType
        : finding.finding_type === "data_quality" ? "data_repair" : "reteach";
      const priority = ["low", "normal", "high", "urgent"].includes(body.priority)
        ? body.priority
        : finding.evidence_strength === "strong" ? "high" : "normal";
      const level = operatingContract(auth.profile).level;
      const defaultPurpose =
        level === "trust" ? "allocate_trust_support" :
        level === "school" ? "assure_curriculum_quality" :
        level === "department" ? "plan_department_response" :
        "plan_next_lesson";
      const idempotencyKey = artifactFingerprint({
        findingId,
        evidenceAsOf: finding.evidence_as_of,
        policyKey: POLICY_KEY,
        policyVersion: POLICY_VERSION,
        recommendationType,
      });
      const existing = rows<any>(await skAdmin(
        "GET",
        `intelligence_recommendations?school_id=eq.${schoolId}&idempotency_key=eq.${idempotencyKey}&select=*&limit=1`,
      ))[0];
      if (existing) return jsonNoStore({ recommendation: existing, reused: true });

      const inserted = rows<any>(await skAdmin("POST", "intelligence_recommendations", {
        school_id: schoolId,
        finding_id: findingId,
        class_id: finding.class_id,
        recommendation_type: recommendationType,
        headline: String(body.headline || `${recommendationType === "reteach" ? "Reteach" : "Respond"}: ${finding.headline}`).trim().slice(0, 240),
        rationale: String(body.rationale || `${finding.summary || finding.headline} The recommendation is advisory and must be accepted, edited or rejected by a named member of staff.`).trim().slice(0, 3000),
        priority,
        purpose: String(body.purpose || defaultPurpose).slice(0, 100),
        policy_key: POLICY_KEY,
        policy_version: POLICY_VERSION,
        evidence_snapshot: {
          reviewedFinding: finding.evidence_snapshot,
          evidenceAsOf: finding.evidence_as_of,
          evidenceStrength: finding.evidence_strength,
        },
        explanation: {
          reasonCodes: [finding.finding_type, finding.evidence_strength],
          counterfactual: "Reject this recommendation if classroom or curriculum context contradicts the reviewed evidence.",
          automatedDecision: false,
        },
        generated_by_kind: "system_rule",
        requires_human_acceptance: true,
        status: "proposed",
        idempotency_key: idempotencyKey,
        created_by: auth.userId,
      }));
      return jsonNoStore({ recommendation: inserted[0] }, 201);
    } catch (error) {
      if (isMissingDatabaseObject(error, ["intelligence_recommendations"])) {
        return jsonNoStore({ error: "Apply the Stage 15-20 migration before preparing recommendations" }, 503);
      }
      return jsonNoStore({ error: "Couldn't prepare the recommendation" }, 500);
    }
  }

  if (operation === "decide_recommendation") {
    const recommendationId = String(body.recommendationId || "");
    const decision = String(body.decision || "");
    const note = String(body.note || "").trim().slice(0, 2000);
    if (!UUID_RE.test(recommendationId)) return jsonNoStore({ error: "Invalid recommendation id" }, 400);
    if (!(["accepted", "rejected"] as string[]).includes(decision)) {
      return jsonNoStore({ error: "Choose accepted or rejected" }, 400);
    }
    if (decision === "rejected" && note.length < 3) {
      return jsonNoStore({ error: "Add a short reason when rejecting a recommendation" }, 400);
    }
    try {
      const recommendation = rows<any>(await restAsUser(
        `intelligence_recommendations?id=eq.${recommendationId}&school_id=eq.${schoolId}&select=*,finding:intelligence_findings(*)&limit=1`,
        auth.token,
      ))[0];
      if (!recommendation) return jsonNoStore({ error: "Recommendation not found in your scope" }, 404);
      if (!(await canControlIntelligenceWork(auth, { ...recommendation, finding: recommendation.finding }))) {
        return jsonNoStore({ error: "You cannot decide this recommendation" }, 403);
      }
      const result = await skAdmin("POST", "rpc/decide_intelligence_recommendation", {
        p_recommendation_id: recommendationId,
        p_decision: decision,
        p_decided_by: auth.userId,
        p_decision_note: note || null,
      });
      return jsonNoStore(result);
    } catch (error) {
      if (isMissingDatabaseObject(error, ["decide_intelligence_recommendation"])) {
        return jsonNoStore({ error: "Apply the Stage 15-20 migration before deciding recommendations" }, 503);
      }
      return jsonNoStore({ error: "Couldn't record the recommendation decision" }, 500);
    }
  }

  if (operation === "evaluate_policy") {
    if (!(await canManageSchool(auth, schoolId))) {
      return jsonNoStore({ error: "School intelligence management scope required" }, 403);
    }
    try {
      const [recommendations, deliveries, rechecks, outcomes, feedback] = await Promise.all([
        restAsUser(`intelligence_recommendations?school_id=eq.${schoolId}&policy_key=eq.${POLICY_KEY}&policy_version=eq.${POLICY_VERSION}&select=*&limit=5000`, auth.token),
        restAsUser("intelligence_deliveries?select=id,action_id,delivered_at&limit=5000", auth.token),
        restAsUser("intelligence_rechecks?select=id,action_id,status,due_at,completed_at&limit=5000", auth.token),
        restAsUser("intelligence_outcomes?select=id,action_id,delta,evaluated_at&limit=5000", auth.token),
        restAsUser("intelligence_feedback?select=id,action_id,feedback_type,rating,created_at&limit=5000", auth.token),
      ]);
      const recommendationRows = rows<any>(recommendations);
      const actionIds = new Set(
        recommendationRows.map((row) => row.action_id).filter(Boolean),
      );
      const evaluation = evaluateResponsePolicy({
        recommendations: recommendationRows,
        deliveries: rows<any>(deliveries).filter((row) => actionIds.has(row.action_id)),
        rechecks: rows<any>(rechecks).filter((row) => actionIds.has(row.action_id)),
        outcomes: rows<any>(outcomes).filter((row) => actionIds.has(row.action_id)),
        feedback: rows<any>(feedback).filter((row) => actionIds.has(row.action_id)),
      });
      const now = new Date();
      const firstRecommendationAt = recommendationRows
        .map((row) => Date.parse(row.created_at))
        .filter(Number.isFinite)
        .sort((a, b) => a - b)[0];
      const windowStart = Number.isFinite(firstRecommendationAt)
        ? new Date(firstRecommendationAt)
        : new Date(now.getTime() - 90 * 86_400_000);
      const inserted = rows<any>(await skAdmin("POST", "intelligence_policy_evaluations", {
        school_id: schoolId,
        policy_key: POLICY_KEY,
        policy_version: POLICY_VERSION,
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
        metrics: { thresholds: { minimumOutcomes: 20, minimumRecheckRate: 0.6 } },
        limitations: evaluation.limitations,
        evaluator_version: 1,
        evaluated_by: auth.userId,
      }));
      await skAdmin("POST", "intelligence_monitoring_events", {
        school_id: schoolId,
        subsystem: "learning_policy",
        event_type: "policy.evaluated",
        severity: evaluation.evaluationStatus === "retire_review" ? "warning" : "info",
        run_key: `policy:${artifactFingerprint({ schoolId, at: now.toISOString(), evaluation })}`,
        detail: {
          policyKey: POLICY_KEY,
          policyVersion: POLICY_VERSION,
          evaluationStatus: evaluation.evaluationStatus,
          outcomeCount: evaluation.outcomeCount,
          automaticPromotion: false,
        },
        observed_at: now.toISOString(),
      });
      return jsonNoStore({ evaluation: inserted[0] }, 201);
    } catch (error) {
      if (isMissingDatabaseObject(error, ["intelligence_policy_evaluations"])) {
        return jsonNoStore({ error: "Apply the Stage 15-20 migration before evaluating policy" }, 503);
      }
      return jsonNoStore({ error: "Couldn't evaluate the response policy" }, 500);
    }
  }

  return jsonNoStore({ error: "Unsupported operating-system operation" }, 400);
}
