export interface LessonQualityInput {
  specification?: any;
  outputContract?: any;
  feedback?: any[];
  deliveries?: any[];
  outcomes?: any[];
}

export interface LessonQualityAssessment {
  qualityStatus: "insufficient_data" | "passes_contract" | "review" | "poor";
  contractScore: number;
  teacherRating: number | null;
  editRate: number | null;
  deliveryCount: number;
  outcomeCount: number;
  meanDescriptiveDelta: number | null;
  checks: Record<string, boolean>;
  limitations: string[];
}

const mean = (values: unknown[]) => {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length
    ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2))
    : null;
};

export function assessLessonQuality(input: LessonQualityInput): LessonQualityAssessment {
  const spec = input.specification || {};
  const outputContract = input.outputContract || {};
  const feedback = input.feedback || [];
  const deliveries = input.deliveries || [];
  const outcomes = input.outcomes || [];
  const phases = Array.isArray(spec.sequence) ? spec.sequence : [];
  const bundle = Array.isArray(spec.outputBundle) ? spec.outputBundle : [];
  const checks = {
    versionedSpecification: Number(spec.schemaVersion) >= 2,
    approvedCurriculumOnly: spec.curriculum?.approvedGraphOnly === true,
    diagnosticSequence: phases.some((phase: any) => phase.phase === "entry_diagnostic"),
    adaptiveHinge: phases.some((phase: any) => phase.phase === "diagnostic_hinge") &&
      Array.isArray(spec.adaptiveBranches) && spec.adaptiveBranches.length >= 2,
    delayedRecheck: spec.delayedRecheck?.required === true,
    completeBundle: ["lesson_deck", "teacher_notes", "student_task", "exit_check", "delayed_recheck"]
      .every((item) => bundle.includes(item)),
    outputContractPresent: Object.keys(outputContract).length > 0,
    humanReviewAvailable: Array.isArray(spec.guardrails) &&
      spec.guardrails.some((guardrail: unknown) => /teacher review|editing/i.test(String(guardrail))),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const contractScore = Number((passed / Object.keys(checks).length).toFixed(4));
  const ratings = feedback.filter((row) => row.rating != null).map((row) => row.rating);
  const edited = feedback.filter((row) => row.feedback_type === "edited").length;
  const acceptedOrEdited = feedback.filter((row) =>
    ["accepted", "edited"].includes(row.feedback_type),
  ).length;
  const teacherRating = mean(ratings);
  const editRate = acceptedOrEdited > 0 ? Number((edited / acceptedOrEdited).toFixed(4)) : null;
  const meanDescriptiveDelta = mean(outcomes.map((row) => row.delta));

  let qualityStatus: LessonQualityAssessment["qualityStatus"] = "review";
  if (contractScore < 0.625 || (teacherRating != null && teacherRating < 2.5)) {
    qualityStatus = "poor";
  } else if (contractScore === 1) {
    qualityStatus = "passes_contract";
  } else if (!feedback.length && !deliveries.length) {
    qualityStatus = "insufficient_data";
  }

  return {
    qualityStatus,
    contractScore,
    teacherRating,
    editRate,
    deliveryCount: deliveries.length,
    outcomeCount: outcomes.length,
    meanDescriptiveDelta,
    checks,
    limitations: [
      "Contract compliance checks structure and provenance, not scientific accuracy of every generated statement.",
      "Teacher ratings and editing behaviour measure usefulness, not causal pupil impact.",
      "Outcome deltas are descriptive until a separately governed evaluation design supports stronger claims.",
    ],
  };
}
