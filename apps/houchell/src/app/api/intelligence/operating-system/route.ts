import { artifactFingerprint } from "@/lib/artifactLineage";
import {
  buildTodayQueue,
  operatingContract,
  summariseBrainHealth,
} from "@/lib/intelligence/operatingSystem";
import {
  evaluateSchoolResponsePolicy,
  RESPONSE_POLICY_KEY,
  RESPONSE_POLICY_VERSION,
} from "@/lib/intelligence/policyService";
import {
  CONTINUOUS_TEACHER_OS_STAGES,
  TEACHER_OS_ENTITY_TYPES,
  TEACHER_OS_FLYWHEEL,
  TEACHER_OS_GUARDRAILS,
  TEACHER_OS_ONTOLOGY_VERSION,
} from "@/lib/intelligence/teacherOS";
import {
  authenticateIntelligence,
  canControlIntelligenceWork,
  canManageSchool,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
  UUID_RE,
} from "@/lib/intelligence/server";
import { runSchoolIntelligenceCycle } from "@/lib/intelligence/orchestrator";
import { availableIntelligenceSchools } from "@/lib/intelligence/scopeService";
import { parseOperatingSystemCommand, ValidationError } from "@/lib/intelligence/validation";
import { skAdmin } from "@/lib/serverHelpers";

export const runtime = "nodejs";
export const maxDuration = 120;

const rows = <T = any>(value: unknown): T[] => Array.isArray(value) ? value : [];

async function resolveSchool(request: Request, auth: Parameters<typeof availableIntelligenceSchools>[0]) {
  const schools = await availableIntelligenceSchools(auth);
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
      continuousSummaries,
      orchestrationRuns,
      dataQualityIssues,
      modelGovernanceChecks,
      modelReleaseReviews,
      lessonQualityChecks,
      adaptiveSummaries,
      signals,
      decisionMemory,
      proofSnapshots,
      safetyRuns,
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
      restAsUser(
        `intelligence_continuous_os_summary?school_id=eq.${schoolId}&select=*&limit=1`,
        auth.token,
      ),
      restAsUser(
        `intelligence_orchestration_runs?school_id=eq.${schoolId}&select=*&order=started_at.desc&limit=12`,
        auth.token,
      ),
      restAsUser(
        `intelligence_data_quality_issues?school_id=eq.${schoolId}&status=eq.open&select=*&order=severity.desc,created_at.desc&limit=50`,
        auth.token,
      ),
      restAsUser(
        `intelligence_model_governance_checks?school_id=eq.${schoolId}&select=*&order=created_at.desc&limit=12`,
        auth.token,
      ),
      restAsUser(
        `intelligence_model_release_reviews?school_id=eq.${schoolId}&select=*&order=reviewed_at.desc&limit=12`,
        auth.token,
      ),
      restAsUser(
        `intelligence_lesson_quality_evaluations?school_id=eq.${schoolId}&select=*&order=evaluated_at.desc&limit=30`,
        auth.token,
      ),
      restAsUser(
        `intelligence_adaptive_os_summary?school_id=eq.${schoolId}&select=*&limit=1`,
        auth.token,
      ),
      restAsUser(
        `intelligence_signals?school_id=eq.${schoolId}&status=eq.active&select=*&order=materiality_score.desc,last_detected_at.desc&limit=100`,
        auth.token,
      ),
      restAsUser(
        `intelligence_response_policy_scores?school_id=eq.${schoolId}&select=*&order=evaluated_at.desc,operational_score.desc&limit=30`,
        auth.token,
      ),
      restAsUser(
        `intelligence_proof_snapshots?school_id=eq.${schoolId}&select=*&order=created_at.desc&limit=12`,
        auth.token,
      ),
      restAsUser(
        `intelligence_evaluation_runs?school_id=eq.${schoolId}&select=*,suite:intelligence_evaluation_suites(name,suite_type)&order=evaluated_at.desc&limit=12`,
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
    const latestDecisionMemory = [
      ...new Map(rows<any>(decisionMemory).map((row) => [
        `${row.context_signature}:${row.response_type}`,
        row,
      ])).values(),
    ];
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
      continuous: {
        ontologyVersion: TEACHER_OS_ONTOLOGY_VERSION,
        entityTypes: TEACHER_OS_ENTITY_TYPES,
        summary: rows(continuousSummaries)[0] || null,
        stages: CONTINUOUS_TEACHER_OS_STAGES,
        flywheel: TEACHER_OS_FLYWHEEL,
        orchestrationRuns: rows(orchestrationRuns),
        dataQualityIssues: rows(dataQualityIssues),
        modelGovernanceChecks: rows(modelGovernanceChecks),
        modelReleaseReviews: rows(modelReleaseReviews),
        lessonQualityChecks: rows(lessonQualityChecks),
      },
      adaptive: {
        summary: rows(adaptiveSummaries)[0] || null,
        signals: rows(signals),
        decisionMemory: latestDecisionMemory,
        proofSnapshots: rows(proofSnapshots),
        safetyRuns: rows(safetyRuns),
      },
      guardrails: {
        automatedDecisions: false,
        pupilRiskScore: false,
        automaticPolicyPromotion: false,
        causalClaims: false,
        humanAcceptanceRequired: true,
        ...TEACHER_OS_GUARDRAILS,
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
        "intelligence_continuous_os_summary",
        "intelligence_orchestration_runs",
        "intelligence_data_quality_issues",
        "intelligence_model_governance_checks",
        "intelligence_model_release_reviews",
        "intelligence_lesson_quality_evaluations",
        "intelligence_adaptive_os_summary",
        "intelligence_signals",
        "intelligence_response_policy_scores",
        "intelligence_proof_snapshots",
        "intelligence_evaluation_runs",
      ])
    ) {
      return jsonNoStore({ enabled: false, reason: "stage_27_32_migration_pending" });
    }
    return jsonNoStore({ error: "Couldn't load the teacher operating system" }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  let body;
  try {
    body = parseOperatingSystemCommand(await request.json());
  } catch (error) {
    return jsonNoStore({ error: error instanceof ValidationError ? error.message : "Invalid JSON" }, 400);
  }

  const schoolId = body.schoolId;
  const schools = await availableIntelligenceSchools(auth).catch(() => []);
  if (!schools.some((school) => school.id === schoolId)) {
    return jsonNoStore({ error: "School is outside your permitted scope" }, 403);
  }

  const operation = String(body.operation || "");
  if (operation === "run_adaptive_cycle") {
    if (!(await canManageSchool(auth, schoolId))) {
      return jsonNoStore({ error: "School intelligence management scope required" }, 403);
    }
    try {
      const result = await runSchoolIntelligenceCycle(schoolId);
      return jsonNoStore(result, result.reused ? 200 : 201);
    } catch (error) {
      if (isMissingDatabaseObject(error, ["intelligence_signal_runs", "audit_adaptive_education_os_security"])) {
        return jsonNoStore({ error: "Apply the Stage 27-32 migration before running the adaptive cycle" }, 503);
      }
      return jsonNoStore({ error: "Couldn't run the adaptive intelligence cycle" }, 500);
    }
  }
  if (operation === "refresh_health") {
    if (!(await canManageSchool(auth, schoolId))) {
      return jsonNoStore({ error: "School intelligence management scope required" }, 403);
    }
    try {
      const result = await skAdmin("POST", "rpc/refresh_intelligence_brain_health", {
        p_school_id: schoolId,
        p_checked_by: auth.userId,
      });
      await skAdmin(
        "PATCH",
        `intelligence_source_health?school_id=eq.${schoolId}&checked_by=eq.${auth.userId}`,
        { checked_by_kind: "human" },
      ).catch(() => null);
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
      const requestedRecommendationType = String(body.recommendationType || "");
      const requestedPriority = String(body.priority || "");
      const recommendationType = allowedTypes.includes(requestedRecommendationType)
        ? requestedRecommendationType
        : finding.finding_type === "data_quality" ? "data_repair" : "reteach";
      const priority = ["low", "normal", "high", "urgent"].includes(requestedPriority)
        ? requestedPriority
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
        policyKey: RESPONSE_POLICY_KEY,
        policyVersion: RESPONSE_POLICY_VERSION,
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
        policy_key: RESPONSE_POLICY_KEY,
        policy_version: RESPONSE_POLICY_VERSION,
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
      const result = await evaluateSchoolResponsePolicy({
        schoolId,
        actor: { kind: "human", userId: auth.userId },
        force: true,
      });
      return jsonNoStore(result, 201);
    } catch (error) {
      if (isMissingDatabaseObject(error, ["intelligence_policy_evaluations"])) {
        return jsonNoStore({ error: "Apply the Stage 15-20 migration before evaluating policy" }, 503);
      }
      return jsonNoStore({ error: "Couldn't evaluate the response policy" }, 500);
    }
  }

  if (operation === "review_model") {
    if (!(await canManageSchool(auth, schoolId))) {
      return jsonNoStore({ error: "School intelligence management scope required" }, 403);
    }
    const governanceCheckId = String(body.governanceCheckId || "");
    const decision = String(body.decision || "");
    const rationale = String(body.rationale || "").trim().slice(0, 4000);
    if (!UUID_RE.test(governanceCheckId)) {
      return jsonNoStore({ error: "A valid governance check is required" }, 400);
    }
    if (!["approve_shadow", "hold", "retire"].includes(decision)) {
      return jsonNoStore({ error: "Choose approve shadow, hold or retire" }, 400);
    }
    if (rationale.length < 12) {
      return jsonNoStore({ error: "Add a governance rationale of at least 12 characters" }, 400);
    }
    try {
      const check = rows<any>(await restAsUser(
        `intelligence_model_governance_checks?id=eq.${governanceCheckId}&school_id=eq.${schoolId}&select=*&limit=1`,
        auth.token,
      ))[0];
      if (!check) return jsonNoStore({ error: "Governance check not found in your scope" }, 404);
      const review = rows<any>(await skAdmin("POST", "intelligence_model_release_reviews", {
        school_id: schoolId,
        model_version_id: check.model_version_id,
        governance_check_id: check.id,
        decision,
        rationale,
        reviewed_by: auth.userId,
      }))[0];
      return jsonNoStore({ review }, 201);
    } catch (error) {
      if (isMissingDatabaseObject(error, ["intelligence_model_release_reviews"])) {
        return jsonNoStore({ error: "Apply the Stage 21-26 migration before reviewing models" }, 503);
      }
      return jsonNoStore({ error: "Couldn't record the model governance review" }, 500);
    }
  }

  return jsonNoStore({ error: "Unsupported operating-system operation" }, 400);
}
