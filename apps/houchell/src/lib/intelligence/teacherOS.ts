import { ONTOLOGY_VERSION, type ObjectTypeKey } from "@/lib/intel/ontology";

export const TEACHER_OS_ONTOLOGY_VERSION = ONTOLOGY_VERSION;

export const TEACHER_OS_ENTITY_TYPES = [
  "School",
  "Pupil",
  "Class",
  "Objective",
  "MasteryState",
  "AttendanceSession",
  "Intervention",
] as const satisfies readonly ObjectTypeKey[];

export const CONTINUOUS_TEACHER_OS_STAGES = [
  { number: 21, key: "security", label: "Security contract", outcome: "Explicit access, audit and human decision boundaries" },
  { number: 22, key: "data_plane", label: "Live data plane", outcome: "MIS staging promoted into governed canonical identity" },
  { number: 23, key: "orchestration", label: "Continuous brain", outcome: "One durable, observable intelligence cycle per school" },
  { number: 24, key: "model_lab", label: "Model laboratory", outcome: "Calibration and drift evidence with human release review" },
  { number: 25, key: "lesson_loop", label: "Lesson learning loop", outcome: "Generation quality linked to edits, delivery and rechecks" },
  { number: 26, key: "unified_os", label: "Unified operating system", outcome: "Trust-to-teacher status through one shared contract" },
  { number: 27, key: "platform", label: "Platform foundation", outcome: "Supported runtime, typed requests and explicit data contracts" },
  { number: 28, key: "signals", label: "Automatic signal engine", outcome: "Fresh, material class hypotheses with minimum evidence thresholds" },
  { number: 29, key: "decision_memory", label: "Decision memory", outcome: "The system learns which reviewed responses are useful in context" },
  { number: 30, key: "teacher_loop", label: "Daily teacher loop", outcome: "Evidence, decision, teaching response and recheck in one workflow" },
  { number: 31, key: "copilot", label: "Scoped education copilot", outcome: "Read-only answers grounded in the user’s permitted evidence" },
  { number: 32, key: "proof", label: "Evaluation and proof", outcome: "Safety, quality, adoption and descriptive outcomes measured continuously" },
] as const;

export const TEACHER_OS_FLYWHEEL = [
  "ingest",
  "reconcile",
  "observe",
  "detect_material_signals",
  "forecast_in_shadow",
  "recommend",
  "human_decide",
  "generate",
  "deliver",
  "recheck",
  "evaluate",
  "learn_response_usefulness",
  "govern",
] as const;

export const TEACHER_OS_GUARDRAILS = {
  automaticConsequentialDecisions: false,
  automaticModelPromotion: false,
  fixedPupilRiskLabels: false,
  causalClaimsFromBeforeAfterData: false,
  humanAcceptanceRequired: true,
} as const;
