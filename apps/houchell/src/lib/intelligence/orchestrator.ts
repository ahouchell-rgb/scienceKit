import { scoreForecastOutcomes, runShadowForecast } from "@/lib/intelligence/forecastService";
import { evaluateModelGovernance } from "@/lib/intelligence/governanceService";
import { evaluateLessonQuality } from "@/lib/intelligence/lessonQualityService";
import { evaluateSchoolResponsePolicy } from "@/lib/intelligence/policyService";
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
  return `continuous-teacher-os:${schoolId}:${now.toISOString().slice(0, 10)}`;
}

export async function runSchoolIntelligenceCycle(schoolId: string) {
  const baseRunKey = dailyIntelligenceRunKey(schoolId);
  const existing = rows<any>(await skAdmin(
    "GET",
    `intelligence_orchestration_runs?school_id=eq.${schoolId}&workflow_key=eq.continuous_teacher_os_v1&run_key=eq.${encodeURIComponent(baseRunKey)}&select=*&limit=1`,
  ))[0];
  if (existing && existing.status !== "failed") return { run: existing, reused: true };
  const runKey = existing?.status === "failed"
    ? `${baseRunKey}:retry-${new Date().toISOString().slice(11, 19).replaceAll(":", "")}`
    : baseRunKey;
  const insertBody = {
    school_id: schoolId,
    workflow_key: "continuous_teacher_os_v1",
    run_key: runKey,
    status: "running",
    current_stage: 21,
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
      `intelligence_orchestration_runs?school_id=eq.${schoolId}&workflow_key=eq.continuous_teacher_os_v1&run_key=eq.${encodeURIComponent(runKey)}&select=*&limit=1`,
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
      await reportError(error, { route: "continuous-teacher-os", school_id: schoolId, stage, step: key });
    }
    await skAdmin("PATCH", `intelligence_orchestration_runs?id=eq.${run.id}`, {
      current_stage: stage,
      steps,
      counts,
    });
    return ok;
  };

  const securityContractHealthy = await execute(21, "audit_security_contract", async () => {
    const result = await skAdmin("POST", "rpc/audit_continuous_teacher_os_security", {});
    if (result?.status !== "healthy") {
      throw new Error(`Continuous OS security contract blocked: ${JSON.stringify(result).slice(0, 700)}`);
    }
    return result;
  });
  if (!securityContractHealthy) {
    const blocked = rows<any>(await skAdmin(
      "PATCH",
      `intelligence_orchestration_runs?id=eq.${run.id}`,
      {
        status: "failed",
        current_stage: 21,
        steps,
        counts,
        error_summary: steps.at(-1)?.error || "Continuous OS security contract blocked",
        completed_at: new Date().toISOString(),
      },
    ))[0];
    return { run: blocked, reused: false };
  }
  await execute(22, "promote_mis", async () => {
    const result = await skAdmin("POST", "rpc/promote_mis_to_intelligence", {
      p_school_id: schoolId,
      p_run_key: `mis-promotion:${schoolId}:${new Date().toISOString().slice(0, 10)}`,
    });
    if (result?.status === "failed") {
      throw new Error(`MIS promotion failed: ${result.error || "unknown database error"}`);
    }
    return result;
  });
  await execute(23, "backfill_learning_events", () => skAdmin("POST", "rpc/backfill_retrieval_education_events", {
    p_school_id: schoolId,
  }));
  await execute(23, "run_shadow_forecast", () => runShadowForecast(
    { kind: "system", userId: null }, schoolId, 1000,
  ));
  await execute(23, "score_forecast_outcomes", () => scoreForecastOutcomes(
    { kind: "system", userId: null }, schoolId,
  ));
  await execute(23, "evaluate_response_policy", () => evaluateSchoolResponsePolicy({
    schoolId,
    actor: { kind: "system", userId: null },
  }));
  await execute(24, "govern_model", () => evaluateModelGovernance(schoolId));
  await execute(25, "evaluate_lesson_quality", () => evaluateLessonQuality(schoolId));
  await execute(26, "refresh_brain_health", () => skAdmin(
    "POST", "rpc/refresh_intelligence_brain_health_system", { p_school_id: schoolId },
  ));

  const failed = steps.filter((step) => step.status === "failed");
  const status = failed.length ? "completed_with_issues" : "completed";
  const completed = rows<any>(await skAdmin(
    "PATCH",
    `intelligence_orchestration_runs?id=eq.${run.id}`,
    {
      status,
      current_stage: 26,
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
