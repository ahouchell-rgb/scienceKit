import { assessLessonQuality } from "@/lib/intelligence/lessonQuality";
import { skAdmin } from "@/lib/serverHelpers";

const rows = <T = any>(value: unknown): T[] => Array.isArray(value) ? value : [];

export async function evaluateLessonQuality(schoolId: string) {
  const specs = rows<any>(await skAdmin(
    "GET",
    `intelligence_lesson_specs?school_id=eq.${schoolId}&select=id,school_id,finding_id,action_id,specification,output_contract,created_at&order=created_at.desc&limit=100`,
  ));
  if (!specs.length) return { evaluated: 0, reused: 0 };
  const actionIds = [...new Set(specs.map((spec) => spec.action_id).filter(Boolean))];
  const actionFilter = `action_id=in.(${actionIds.join(",")})`;
  const [artifacts, feedback, deliveries, outcomes] = await Promise.all([
    skAdmin("GET", `intelligence_artifacts?${actionFilter}&select=id,action_id,created_at&limit=1000`),
    skAdmin("GET", `intelligence_feedback?${actionFilter}&select=id,action_id,artifact_id,feedback_type,rating,created_at&limit=5000`),
    skAdmin("GET", `intelligence_deliveries?${actionFilter}&select=id,action_id,artifact_id,delivered_at&limit=5000`),
    skAdmin("GET", `intelligence_outcomes?${actionFilter}&select=id,action_id,delta,evaluated_at&limit=5000`),
  ]);
  const day = new Date().toISOString().slice(0, 10);
  let evaluated = 0;
  let reused = 0;
  for (const spec of specs) {
    const runKey = `lesson-quality:${spec.id}:${day}`;
    const existing = rows<any>(await skAdmin(
      "GET",
      `intelligence_lesson_quality_evaluations?school_id=eq.${schoolId}&lesson_spec_id=eq.${spec.id}&evaluator_kind=eq.automated_contract&run_key=eq.${encodeURIComponent(runKey)}&select=id&limit=1`,
    ))[0];
    if (existing) {
      reused += 1;
      continue;
    }
    const artifact = rows<any>(artifacts).find((row) => row.action_id === spec.action_id);
    const assessment = assessLessonQuality({
      specification: spec.specification,
      outputContract: spec.output_contract,
      feedback: rows<any>(feedback).filter((row) => row.action_id === spec.action_id),
      deliveries: rows<any>(deliveries).filter((row) => row.action_id === spec.action_id),
      outcomes: rows<any>(outcomes).filter((row) => row.action_id === spec.action_id),
    });
    await skAdmin("POST", "intelligence_lesson_quality_evaluations", {
      school_id: schoolId,
      lesson_spec_id: spec.id,
      artifact_id: artifact?.id || null,
      finding_id: spec.finding_id,
      action_id: spec.action_id,
      run_key: runKey,
      evaluator_kind: "automated_contract",
      quality_status: assessment.qualityStatus,
      contract_score: assessment.contractScore,
      teacher_rating: assessment.teacherRating,
      edit_rate: assessment.editRate,
      delivery_count: assessment.deliveryCount,
      outcome_count: assessment.outcomeCount,
      mean_descriptive_delta: assessment.meanDescriptiveDelta,
      evidence: { checks: assessment.checks, automaticGeneratorChange: false },
      limitations: assessment.limitations,
      evaluated_by_kind: "system",
      evaluated_by: null,
    });
    evaluated += 1;
  }
  return { evaluated, reused };
}
