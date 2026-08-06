import { artifactFingerprint } from "@/lib/artifactLineage";
import {
  RESPONSE_POLICY_KEY,
  RESPONSE_POLICY_VERSION,
} from "@/lib/intelligence/policyService";
import { skAdmin } from "@/lib/serverHelpers";

const rows = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value : [];
const DAY_MS = 86_400_000;

export type IntelligenceSignalType =
  | "learning_gap"
  | "cross_domain_hypothesis"
  | "overdue_recheck"
  | "data_quality";

export interface SignalCandidate {
  fingerprint: string;
  signalType: IntelligenceSignalType;
  classId: string | null;
  objectiveId: string | null;
  objectiveKey: string | null;
  headline: string;
  summary: string;
  evidenceSnapshot: Record<string, unknown>;
  evidenceAsOf: string;
  materialityScore: number;
  confidence: number;
  recommendationType: "reteach" | "review_evidence" | "department_brief" | "data_repair" | "monitor";
  priority: "normal" | "high" | "urgent";
  findingType: "learning_gap" | "attendance_pattern" | "curriculum_sequence" | "data_quality";
}

export function responseFromDecisionMemory(
  candidate: SignalCandidate,
  scores: Array<Record<string, unknown>>,
) {
  const allowedBySignal: Record<IntelligenceSignalType, string[]> = {
    learning_gap: ["reteach", "review_evidence", "monitor"],
    cross_domain_hypothesis: ["review_evidence", "department_brief", "monitor"],
    overdue_recheck: ["monitor", "review_evidence"],
    data_quality: ["data_repair"],
  };
  const latestBySegment = new Map<string, Record<string, unknown>>();
  for (const score of scores) {
    const key = String(score.context_signature || `${score.finding_type}:${score.objective_key}:${score.response_type}`);
    if (!latestBySegment.has(key)) latestBySegment.set(key, score);
  }
  const eligible = [...latestBySegment.values()]
    .filter((score) =>
      score.finding_type === candidate.findingType &&
      (!candidate.objectiveKey || !score.objective_key || score.objective_key === candidate.objectiveKey) &&
      allowedBySignal[candidate.signalType].includes(String(score.response_type || "")) &&
      Number(score.sample_size || 0) >= 5 &&
      Number(score.confidence || 0) >= 0.2 &&
      Number(score.operational_score || 0) >= 0.55,
    )
    .sort((left, right) => Number(right.operational_score || 0) - Number(left.operational_score || 0));
  const learned = eligible[0];
  return {
    recommendationType: learned
      ? String(learned.response_type) as SignalCandidate["recommendationType"]
      : candidate.recommendationType,
    memory: learned ? {
      scoreId: learned.id,
      sampleSize: Number(learned.sample_size || 0),
      operationalScore: Number(learned.operational_score || 0),
      confidence: Number(learned.confidence || 0),
      limitations: learned.limitations,
    } : null,
  };
}

const finite = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const recentEnough = (value: unknown, now: Date, days: number) => {
  const at = Date.parse(String(value || ""));
  return Number.isFinite(at) && now.getTime() - at <= days * DAY_MS;
};

export function learningGapCandidates(
  states: Array<Record<string, unknown>>,
  now = new Date(),
): SignalCandidate[] {
  return states.flatMap((state) => {
    const mastery = finite(state.mastery_estimate);
    const uncertainty = finite(state.uncertainty_points);
    const evidenceCount = finite(state.evidence_count) || 0;
    const pupilCount = finite(state.pupil_count) || 0;
    if (
      mastery === null || uncertainty === null || mastery > 65 || uncertainty > 35 ||
      evidenceCount < 8 || pupilCount < 3 || !recentEnough(state.last_evidence_at, now, 30)
    ) return [];

    const objective = String(state.objective_title || state.objective_key || "learning objective");
    const className = String(state.class_name || "class");
    const materiality = clamp(
      45 + (65 - mastery) * 1.2 + Math.min(15, evidenceCount / 2) + (35 - uncertainty) * 0.25,
      0,
      100,
    );
    const confidence = clamp(
      0.35 + Math.min(0.35, evidenceCount / 50) + Math.min(0.2, pupilCount / 50) + (35 - uncertainty) / 350,
    );
    const identity = {
      type: "learning_gap",
      classId: state.class_id,
      objectiveId: state.objective_id,
      objectiveKey: state.objective_key,
      modelVersion: state.model_version,
    };
    return [{
      fingerprint: artifactFingerprint(identity),
      signalType: "learning_gap" as const,
      classId: String(state.class_id || "") || null,
      objectiveId: String(state.objective_id || "") || null,
      objectiveKey: String(state.objective_key || "") || null,
      headline: `${className}: ${objective} needs review`,
      summary: `${Math.round(mastery)}% estimated mastery from ${evidenceCount} recent responses across ${pupilCount} pupils. This is a class-level signal for teacher review, not a pupil judgement.`,
      evidenceSnapshot: {
        masteryEstimate: mastery,
        uncertaintyPoints: uncertainty,
        evidenceCount,
        pupilCount,
        sourceMix: state.source_mix,
        modelVersion: state.model_version,
        thresholds: { maximumMastery: 65, maximumUncertainty: 35, minimumEvidence: 8, minimumPupils: 3 },
      },
      evidenceAsOf: String(state.last_evidence_at),
      materialityScore: Number(materiality.toFixed(2)),
      confidence: Number(confidence.toFixed(4)),
      recommendationType: "reteach" as const,
      priority: materiality >= 75 ? "high" as const : "normal" as const,
      findingType: "learning_gap" as const,
    }];
  });
}

export function crossDomainCandidates(
  states: Array<Record<string, unknown>>,
  now = new Date(),
): SignalCandidate[] {
  return states.flatMap((state) => {
    const learning = finite(state.learning_mastery);
    const evidence = finite(state.learning_evidence) || 0;
    const attendance = finite(state.attendance_rate);
    const sessions = finite(state.attendance_sessions) || 0;
    if (
      learning === null || attendance === null || learning >= 55 || attendance >= 90 ||
      evidence < 10 || sessions < 20 || !recentEnough(state.learning_as_of, now, 30) ||
      !recentEnough(state.attendance_as_of, now, 45)
    ) return [];
    const className = String(state.class_name || "Class");
    const materiality = clamp(55 + (55 - learning) + (90 - attendance), 0, 100);
    const confidence = clamp(0.45 + Math.min(0.25, evidence / 100) + Math.min(0.2, sessions / 200));
    return [{
      fingerprint: artifactFingerprint({ type: "cross_domain_hypothesis", classId: state.class_id }),
      signalType: "cross_domain_hypothesis" as const,
      classId: String(state.class_id || "") || null,
      objectiveId: null,
      objectiveKey: null,
      headline: `${className}: review co-occurring learning and attendance evidence`,
      summary: `Learning evidence (${Math.round(learning)}%) and attendance exposure (${attendance.toFixed(1)}%) are both below review thresholds. Attendance may be a hypothesis to check; this evidence does not establish causation.`,
      evidenceSnapshot: {
        learningMastery: learning,
        learningEvidence: evidence,
        attendanceRate: attendance,
        attendanceSessions: sessions,
        pupilCount: state.pupil_count,
        causalClaim: false,
        thresholds: { maximumLearningMastery: 55, maximumAttendanceRate: 90, minimumLearningEvidence: 10, minimumAttendanceSessions: 20 },
      },
      evidenceAsOf: String(state.learning_as_of),
      materialityScore: Number(materiality.toFixed(2)),
      confidence: Number(confidence.toFixed(4)),
      recommendationType: "review_evidence" as const,
      priority: materiality >= 75 ? "high" as const : "normal" as const,
      findingType: "attendance_pattern" as const,
    }];
  });
}

function operationalCandidates(input: {
  overdueRechecks: Array<Record<string, unknown>>;
  dataQualityIssues: Array<Record<string, unknown>>;
  now: Date;
}): SignalCandidate[] {
  const rechecks = input.overdueRechecks.map((recheck) => ({
    fingerprint: artifactFingerprint({ type: "overdue_recheck", recheckId: recheck.id }),
    signalType: "overdue_recheck" as const,
    classId: String((recheck.finding as any)?.class_id || "") || null,
    objectiveId: String(recheck.objective_id || "") || null,
    objectiveKey: String(recheck.objective_key || "") || null,
    headline: `Complete the overdue recheck: ${String((recheck.finding as any)?.headline || recheck.objective_key || "learning response")}`,
    summary: "A delivered teaching response is waiting for its delayed check. Complete it before drawing any conclusion about learning change.",
    evidenceSnapshot: { recheckId: recheck.id, actionId: recheck.action_id, dueAt: recheck.due_at },
    evidenceAsOf: String(recheck.due_at),
    materialityScore: 72,
    confidence: 1,
    recommendationType: "monitor" as const,
    priority: "high" as const,
    findingType: "curriculum_sequence" as const,
  }));
  const issues = input.dataQualityIssues.slice(0, 50).map((issue) => ({
    fingerprint: artifactFingerprint({ type: "data_quality", issueId: issue.id }),
    signalType: "data_quality" as const,
    classId: null,
    objectiveId: null,
    objectiveKey: null,
    headline: `Repair intelligence data: ${String(issue.issue_code || "source issue").replaceAll("_", " ")}`,
    summary: "An unresolved source-data issue reduces the reliability of downstream intelligence. Repair the data before relying on affected conclusions.",
    evidenceSnapshot: { issueId: issue.id, issueCode: issue.issue_code, severity: issue.severity, sourceSystem: issue.source_system },
    evidenceAsOf: String(issue.created_at || input.now.toISOString()),
    materialityScore: issue.severity === "blocking" ? 90 : 65,
    confidence: 1,
    recommendationType: "data_repair" as const,
    priority: issue.severity === "blocking" ? "urgent" as const : "high" as const,
    findingType: "data_quality" as const,
  }));
  return [...rechecks, ...issues];
}

const strengthFor = (confidence: number) =>
  confidence >= 0.8 ? "strong" : confidence >= 0.6 ? "developing" : "limited";

export async function detectSchoolSignals(schoolId: string, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const runKey = `adaptive-signals:${schoolId}:${day}:v1`;
  const existingRun = rows<Record<string, unknown>>(await skAdmin(
    "GET",
    `intelligence_signal_runs?school_id=eq.${schoolId}&run_key=eq.${encodeURIComponent(runKey)}&select=*&limit=1`,
  ))[0];
  if (existingRun && existingRun.status !== "failed") return { run: existingRun, reused: true };

  const run = existingRun || rows<any>(await skAdmin("POST", "intelligence_signal_runs", {
    school_id: schoolId,
    run_key: runKey,
    detector_version: 1,
    status: "running",
  }))[0];
  if (!run) throw new Error("Could not create signal detection run");

  try {
    const [learningStates, crossDomainStates, overdueRechecks, dataQualityIssues, decisionMemory] = await Promise.all([
      skAdmin("GET", `class_learning_state?school_id=eq.${schoolId}&select=*&limit=5000`),
      skAdmin("GET", `class_cross_domain_state?school_id=eq.${schoolId}&select=*&limit=1000`),
      skAdmin("GET", `intelligence_rechecks?finding.school_id=eq.${schoolId}&status=eq.scheduled&due_at=lt.${encodeURIComponent(now.toISOString())}&select=id,action_id,objective_id,objective_key,due_at,finding:intelligence_findings!inner(headline,school_id,class_id)&limit=1000`),
      skAdmin("GET", `intelligence_data_quality_issues?school_id=eq.${schoolId}&status=eq.open&select=*&limit=1000`),
      skAdmin("GET", `intelligence_response_policy_scores?school_id=eq.${schoolId}&select=*&order=evaluated_at.desc,operational_score.desc&limit=500`),
    ]);
    const candidates = [
      ...learningGapCandidates(rows(learningStates), now),
      ...crossDomainCandidates(rows(crossDomainStates), now),
      ...operationalCandidates({
        overdueRechecks: rows(overdueRechecks),
        dataQualityIssues: rows(dataQualityIssues),
        now,
      }),
    ];
    let created = 0;
    let refreshed = 0;
    let findingsCreated = 0;
    let recommendationsCreated = 0;
    const expiresAt = new Date(now.getTime() + 14 * DAY_MS).toISOString();

    for (const candidate of candidates) {
      const learnedResponse = responseFromDecisionMemory(candidate, rows(decisionMemory));
      let signal = rows<any>(await skAdmin(
        "GET",
        `intelligence_signals?school_id=eq.${schoolId}&fingerprint=eq.${candidate.fingerprint}&status=eq.active&select=*&limit=1`,
      ))[0];
      const signalBody = {
        detection_run_id: run.id,
        class_id: candidate.classId,
        objective_id: candidate.objectiveId,
        objective_key: candidate.objectiveKey,
        signal_type: candidate.signalType,
        headline: candidate.headline,
        summary: candidate.summary,
        evidence_snapshot: candidate.evidenceSnapshot,
        evidence_as_of: candidate.evidenceAsOf,
        materiality_score: candidate.materialityScore,
        confidence: candidate.confidence,
        generated_by_kind: "system_rule",
        last_detected_at: now.toISOString(),
        expires_at: expiresAt,
      };
      if (signal) {
        signal = rows<any>(await skAdmin("PATCH", `intelligence_signals?id=eq.${signal.id}`, signalBody))[0] || signal;
        refreshed += 1;
      } else {
        signal = rows<any>(await skAdmin("POST", "intelligence_signals", {
          school_id: schoolId,
          fingerprint: candidate.fingerprint,
          status: "active",
          ...signalBody,
        }))[0];
        created += 1;
      }

      let finding = rows<any>(await skAdmin(
        "GET",
        `intelligence_findings?signal_id=eq.${signal.id}&select=*&limit=1`,
      ))[0];
      if (!finding) {
        finding = rows<any>(await skAdmin("POST", "intelligence_findings", {
          school_id: schoolId,
          class_id: candidate.classId,
          objective_id: candidate.objectiveId,
          objective_key: candidate.objectiveKey,
          signal_id: signal.id,
          scope_type: candidate.classId ? "class" : candidate.objectiveId || candidate.objectiveKey ? "objective" : "school",
          finding_type: candidate.findingType,
          headline: candidate.headline,
          summary: candidate.summary,
          source_kind: "system_rule",
          evidence_snapshot: candidate.evidenceSnapshot,
          evidence_as_of: candidate.evidenceAsOf,
          evidence_strength: strengthFor(candidate.confidence),
          status: "open",
          raised_by: null,
          raised_by_kind: "system",
          updated_by: null,
          updated_by_kind: "system",
        }))[0];
        findingsCreated += 1;
      }

      const idempotencyKey = artifactFingerprint({
        signalId: signal.id,
        policyKey: RESPONSE_POLICY_KEY,
        policyVersion: RESPONSE_POLICY_VERSION,
        recommendationType: learnedResponse.recommendationType,
      });
      const existingRecommendation = rows<any>(await skAdmin(
        "GET",
        `intelligence_recommendations?school_id=eq.${schoolId}&idempotency_key=eq.${idempotencyKey}&select=id&limit=1`,
      ))[0];
      if (!existingRecommendation) {
        await skAdmin("POST", "intelligence_recommendations", {
          school_id: schoolId,
          finding_id: finding.id,
          class_id: candidate.classId,
          recommendation_type: learnedResponse.recommendationType,
          headline: candidate.headline,
          rationale: `${candidate.summary}${learnedResponse.memory ? ` Similar reviewed responses have an operational usefulness score of ${Math.round(learnedResponse.memory.operationalScore * 100)}% across ${learnedResponse.memory.sampleSize} recorded examples.` : ""} Review the evidence and local context before accepting, editing or rejecting this recommendation.`,
          priority: candidate.priority,
          purpose: learnedResponse.recommendationType === "reteach" ? "plan_next_lesson" : "review_evidence",
          policy_key: RESPONSE_POLICY_KEY,
          policy_version: RESPONSE_POLICY_VERSION,
          evidence_snapshot: { signalId: signal.id, ...candidate.evidenceSnapshot },
          explanation: {
            materialityScore: candidate.materialityScore,
            confidence: candidate.confidence,
            decisionMemory: learnedResponse.memory,
            automaticDecision: false,
            causalClaim: false,
            counterfactual: "Reject or edit when classroom, curriculum or data context contradicts the signal.",
          },
          generated_by_kind: "system_rule",
          requires_human_acceptance: true,
          status: "proposed",
          idempotency_key: idempotencyKey,
          created_by: null,
          created_by_kind: "system",
        });
        recommendationsCreated += 1;
      }
    }

    const expired = rows<any>(await skAdmin(
      "PATCH",
      `intelligence_signals?school_id=eq.${schoolId}&status=eq.active&expires_at=lte.${encodeURIComponent(now.toISOString())}`,
      { status: "expired", resolved_at: now.toISOString() },
    ));
    if (expired.length) {
      const signalIds = expired.map((row) => row.id);
      const supersededFindings: any[] = [];
      for (let index = 0; index < signalIds.length; index += 100) {
        supersededFindings.push(...rows<any>(await skAdmin(
          "PATCH",
          `intelligence_findings?signal_id=in.(${signalIds.slice(index, index + 100).join(",")})&status=in.(open,accepted)`,
          {
            status: "superseded",
            updated_by: null,
            updated_by_kind: "system",
          },
        )));
      }
      const findingIds = supersededFindings.map((row) => row.id);
      for (let index = 0; index < findingIds.length; index += 100) {
        await skAdmin(
          "PATCH",
          `intelligence_recommendations?finding_id=in.(${findingIds.slice(index, index + 100).join(",")})&status=eq.proposed`,
          { status: "superseded" },
        );
      }
    }
    const resultCounts = {
      candidates: candidates.length,
      created,
      refreshed,
      expired: expired.length,
      findingsCreated,
      recommendationsCreated,
    };
    const completed = rows<any>(await skAdmin("PATCH", `intelligence_signal_runs?id=eq.${run.id}`, {
      status: "completed",
      source_counts: {
        learningStates: rows(learningStates).length,
        crossDomainStates: rows(crossDomainStates).length,
        overdueRechecks: rows(overdueRechecks).length,
        dataQualityIssues: rows(dataQualityIssues).length,
        decisionMemorySegments: rows(decisionMemory).length,
      },
      result_counts: resultCounts,
      completed_at: now.toISOString(),
    }))[0];
    return { run: completed, ...resultCounts, reused: false };
  } catch (error) {
    await skAdmin("PATCH", `intelligence_signal_runs?id=eq.${run.id}`, {
      status: "failed",
      error_summary: String(error instanceof Error ? error.message : error).slice(0, 1000),
      completed_at: new Date().toISOString(),
    }).catch(() => null);
    throw error;
  }
}
