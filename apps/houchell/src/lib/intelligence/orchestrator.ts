import { scoreForecastOutcomes, runShadowForecast } from "@/lib/intelligence/forecastService";
import { evaluateModelGovernance } from "@/lib/intelligence/governanceService";
import { evaluateLessonQuality } from "@/lib/intelligence/lessonQualityService";
import { refreshSchoolDecisionMemory } from "@/lib/intelligence/decisionMemoryService";
import { evaluateSchoolResponsePolicy } from "@/lib/intelligence/policyService";
import { refreshSchoolProofSnapshot } from "@/lib/intelligence/proofService";
import { detectSchoolSignals } from "@/lib/intelligence/signalService";
import { reportError } from "@/lib/observe";
import { skAdmin } from "@/lib/serverHelpers";

export interface IntelligenceCycleStep {
  key: string;
  stage: number;
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  result?: unknown;
  error?: string;
}

const rows = <T = any>(value: unknown): T[] => Array.isArray(value) ? value : [];

export function dailyIntelligenceRunKey(schoolId: string, now = new Date()) {
  return `adaptive-education-os:${schoolId}:${now.toISOString().slice(0, 10)}`;
}

export async function runSchoolIntelligenceCycle(schoolId: string) {
  const baseRunKey = dailyIntelligenceRunKey(schoolId);
  const existing = rows<any>(await skAdmin(
    "GET",
    `intelligence_orchestration_runs?school_id=eq.${schoolId}&workflow_key=eq.adaptive_education_os_v2&run_key=eq.${encodeURIComponent(baseRunKey)}&select=*&limit=1`,
  ))[0];
  if (existing && existing.status !== "failed") return { run: existing, reused: true };
  const runKey = existing?.status === "failed"
    ? `${baseRunKey}:retry-${new Date().toISOString().slice(11, 19).replaceAll(":", "")}`
    : baseRunKey;
  const insertBody = {
    school_id: schoolId,
    workflow_key: "adaptive_education_os_v2",
    run_key: runKey,
    status: "running",
    current_stage: 27,
    steps: [],
    counts: {},
  };
  let run = rows<any>(await skAdmin(
    "POST",
    "intelligence_orchestration_runs?on_conflict=school_id,workflow_key,run_key",
    insertBody,
    "resolution=ignore-duplicates,return=representation",
  ))[0];
  if (!run) {
    run = rows<any>(await skAdmin(
      "GET",
      `intelligence_orchestration_runs?school_id=eq.${schoolId}&workflow_key=eq.adaptive_education_os_v2&run_key=eq.${encodeURIComponent(runKey)}&select=*&limit=1`,
    ))[0];
    if (run) return { run, reused: true };
    throw new Error("Could not create or recover the intelligence orchestration run");
  }
  const steps: IntelligenceCycleStep[] = [];
  const counts: Record<string, unknown> = {};

  const execute = async (stage: number, key: string, task: () => Promise<unknown>) => {
    const startedAt = new Date().toISOString();
    let ok = true;
    try {
      const result = await task();
      steps.push({ key, stage, status: "completed", startedAt, completedAt: new Date().toISOString(), result });
      counts[key] = result;
    } catch (error: any) {
      ok = false;
      const message = String(error?.message || `${key} failed`).slice(0, 1000);
      steps.push({ key, stage, status: "failed", startedAt, completedAt: new Date().toISOString(), error: message });
      await reportError(error, { route: "adaptive-education-os", school_id: schoolId, stage, step: key });
    }
    await skAdmin("PATCH", `intelligence_orchestration_runs?id=eq.${run.id}`, {
      current_stage: stage,
      steps,
      counts,
    });
    return ok;
  };

  const securityContractHealthy = await execute(27, "audit_adaptive_security_contract", async () => {
    const [continuous, adaptive] = await Promise.all([
      skAdmin("POST", "rpc/audit_continuous_teacher_os_security", {}),
      skAdmin("POST", "rpc/audit_adaptive_education_os_security", {}),
    ]);
    if (continuous?.status !== "healthy" || adaptive?.status !== "healthy") {
      throw new Error(`Adaptive OS security contract blocked: ${JSON.stringify({ continuous, adaptive }).slice(0, 700)}`);
    }
    return { continuous, adaptive };
  });
  if (!securityContractHealthy) {
    const blocked = rows<any>(await skAdmin(
      "PATCH",
      `intelligence_orchestration_runs?id=eq.${run.id}`,
      {
        status: "failed",
        current_stage: 27,
        steps,
        counts,
        error_summary: steps.at(-1)?.error || "Continuous OS security contract blocked",
        completed_at: new Date().toISOString(),
      },
    ))[0];
    return { run: blocked, reused: false };
  }
  await execute(27, "promote_mis", async () => {
    const result = await skAdmin("POST", "rpc/promote_mis_to_intelligence", {
      p_school_id: schoolId,
      p_run_key: `mis-promotion:${schoolId}:${new Date().toISOString().slice(0, 10)}`,
    });
    if (result?.status === "failed") {
      throw new Error(`MIS promotion failed: ${result.error || "unknown database error"}`);
    }
    return result;
  });
  await execute(27, "backfill_learning_events", () => skAdmin("POST", "rpc/backfill_retrieval_education_events", {
    p_school_id: schoolId,
  }));
  await execute(27, "run_shadow_forecast", () => runShadowForecast(
    { kind: "system", userId: null }, schoolId, 1000,
  ));
  await execute(27, "score_forecast_outcomes", () => scoreForecastOutcomes(
    { kind: "system", userId: null }, schoolId,
  ));
  await execute(27, "evaluate_response_policy", () => evaluateSchoolResponsePolicy({
    schoolId,
    actor: { kind: "system", userId: null },
  }));
  await execute(27, "govern_model", () => evaluateModelGovernance(schoolId));
  await execute(27, "evaluate_lesson_quality", () => evaluateLessonQuality(schoolId));
  await execute(27, "refresh_brain_health", () => skAdmin(
    "POST", "rpc/refresh_intelligence_brain_health_system", { p_school_id: schoolId },
  ));
  await execute(28, "detect_material_signals", () => detectSchoolSignals(schoolId));
  await execute(29, "refresh_decision_memory", () => refreshSchoolDecisionMemory(schoolId));
  await execute(30, "prepare_daily_teacher_loop", () => skAdmin(
    "GET", `intelligence_adaptive_os_summary?school_id=eq.${schoolId}&select=*&limit=1`,
  ));
  await execute(31, "verify_read_only_copilot", () => skAdmin(
    "POST", "rpc/audit_adaptive_education_os_security", {},
  ));
  await execute(32, "refresh_proof_snapshot", () => refreshSchoolProofSnapshot(schoolId));

  const failed = steps.filter((step) => step.status === "failed");
  const status = failed.length ? "completed_with_issues" : "completed";
  const completed = rows<any>(await skAdmin(
    "PATCH",
    `intelligence_orchestration_runs?id=eq.${run.id}`,
    {
      status,
      current_stage: 32,
      steps,
      counts,
      error_summary: failed.length
        ? failed.map((step) => `${step.key}: ${step.error}`).join(" | ").slice(0, 1000)
        : null,
      completed_at: new Date().toISOString(),
    },
  ))[0];
  return { run: completed, reused: false };
}
