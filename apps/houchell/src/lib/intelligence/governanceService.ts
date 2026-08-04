import { assessModelGovernance } from "@/lib/intelligence/modelGovernance";
import { skAdmin } from "@/lib/serverHelpers";

const rows = <T = any>(value: unknown): T[] => Array.isArray(value) ? value : [];

export async function evaluateModelGovernance(schoolId: string) {
  const model = rows<any>(await skAdmin(
    "GET",
    "intelligence_model_versions?model_key=eq.next_attempt_beta_bernoulli&version=eq.1&status=in.(shadow,validated)&select=*&limit=1",
  ))[0];
  if (!model) return { status: "skipped", reason: "no_active_shadow_model" };
  const runKey = `model-governance:${model.id}:${new Date().toISOString().slice(0, 10)}`;
  const existing = rows<any>(await skAdmin(
    "GET",
    `intelligence_model_governance_checks?school_id=eq.${schoolId}&model_version_id=eq.${model.id}&run_key=eq.${encodeURIComponent(runKey)}&select=*&limit=1`,
  ))[0];
  if (existing) return { check: existing, reused: true };
  const evaluations = rows<any>(await skAdmin(
    "GET",
    `intelligence_model_evaluations?school_id=eq.${schoolId}&model_version_id=eq.${model.id}&select=sample_size,brier_score,baseline_brier_score,brier_skill_score,expected_calibration_error,evaluated_at&order=evaluated_at.desc&limit=2`,
  ));
  const assessment = assessModelGovernance(evaluations);
  const body = {
    school_id: schoolId,
    model_version_id: model.id,
    run_key: runKey,
    governance_status: assessment.governanceStatus,
    sample_size: assessment.sampleSize,
    brier_score: assessment.brierScore,
    baseline_brier_score: assessment.baselineBrierScore,
    brier_skill_score: assessment.brierSkillScore,
    expected_calibration_error: assessment.expectedCalibrationError,
    drift_status: assessment.driftStatus,
    thresholds: assessment.thresholds,
    evidence: { evaluationCount: evaluations.length, automaticPromotion: false },
    limitations: assessment.limitations,
    evaluator_version: 1,
  };
  const inserted = rows<any>(await skAdmin(
    "POST",
    "intelligence_model_governance_checks?on_conflict=school_id,model_version_id,run_key",
    body,
    "resolution=ignore-duplicates,return=representation",
  ));
  if (inserted[0]) return { check: inserted[0], reused: false };
  const raced = rows<any>(await skAdmin(
    "GET",
    `intelligence_model_governance_checks?school_id=eq.${schoolId}&model_version_id=eq.${model.id}&run_key=eq.${encodeURIComponent(runKey)}&select=*&limit=1`,
  ))[0];
  return { check: raced, reused: true };
}
