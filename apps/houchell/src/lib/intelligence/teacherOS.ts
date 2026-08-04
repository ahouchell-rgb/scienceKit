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
] as const;

export const TEACHER_OS_FLYWHEEL = [
  "ingest",
  "reconcile",
  "observe",
  "forecast_in_shadow",
  "recommend",
  "human_decide",
  "generate",
  "deliver",
  "recheck",
  "evaluate",
  "govern",
] as const;

export const TEACHER_OS_GUARDRAILS = {
  automaticConsequentialDecisions: false,
  automaticModelPromotion: false,
  fixedPupilRiskLabels: false,
  causalClaimsFromBeforeAfterData: false,
  humanAcceptanceRequired: true,
} as const;
