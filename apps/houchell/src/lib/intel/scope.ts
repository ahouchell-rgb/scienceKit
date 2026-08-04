/* ─────────────────────────────────────────────────────────────────────────
   SCOPE — who sees what, and why they are allowed to.

   Access is requested against a named PURPOSE, not against a dataset. A trust
   director can see cross-school variation for the purpose of "allocate trust
   support"; that same purpose does not grant them a named child's reading age.
   Purpose limitation is enforced here, in code, rather than in a policy PDF.

   Three hard rules, taken from the compliance research:
     · k-anonymity floor on every disaggregated group (suppress, never estimate).
     · Individual staff views are visible only to that member of staff. Nothing
       in this module can produce a teacher-quality ranking.
     · `special` marked properties (SEN/EHCP) are available for fairness
       monitoring only, on a physically separate path, and never as an input to
       an inference shown next to a child's name.
   ───────────────────────────────────────────────────────────────────────── */

import { SENSITIVITY_RANK, type Sensitivity } from "./ontology";
import {
  WORKSPACE_LABEL, WORKSPACE_PURPOSE, workspaceLevelFor,
  type NavigationProfile, type WorkspaceLevel,
} from "@/lib/navigation";

/* ─── ONE altitude model ───────────────────────────────────────────────────
   `WorkspaceLevel` in lib/navigation.ts is the single source of truth for
   what altitude a person is at. The console used to carry its own parallel
   copy of this idea ("head" / "hod"), which meant the app's navigation and
   the console's scoping could drift apart — two answers to the same question
   about the same user. `Level` is now an alias, not a second type, so
   changing altitude is one concept across the whole product.

   Naming follows navigation.ts deliberately: an altitude is an ORGANISATIONAL
   SCOPE, not a job title. A school-level view is not only for the
   headteacher — deputies and SLT sit there too. */
export type Level = WorkspaceLevel;

export const LEVELS: Level[] = ["trust", "school", "department", "teacher"];

/** The altitude a real signed-in profile sits at. Lets the console open where
 *  the user actually is instead of at a hardcoded default. */
export const levelForProfile = (profile?: NavigationProfile | null): Level =>
  workspaceLevelFor(profile);

/** The smallest group we will ever report a statistic about. */
export const K_ANONYMITY_FLOOR = 10;

export interface LevelDef {
  key: Level;
  label: string;
  role: string;
  glyph: string;
  /** One line describing the job this person is actually trying to do. */
  job: string;
  /** The named purposes this level may invoke. */
  purposes: PurposeKey[];
  /** Strongest property marking this level may see at pupil grain. */
  maxPupilGrain: Sensitivity | null;
  accent: string;
}

export type PurposeKey =
  | "allocate_trust_support"
  | "assure_curriculum_quality"
  | "monitor_inclusion_gaps"
  | "plan_department_response"
  | "plan_next_lesson"
  | "support_individual_pupil"
  | "curate_own_findings";

export interface PurposeDef {
  key: PurposeKey;
  label: string;
  /** The question this purpose exists to answer. */
  question: string;
  /** Whether this purpose may resolve individual children at all. */
  pupilGrain: boolean;
}

export const PURPOSES: Record<PurposeKey, PurposeDef> = {
  allocate_trust_support: {
    key: "allocate_trust_support", label: "Allocate trust support",
    question: "Which school needs help, with what, and is it working?",
    pupilGrain: false,
  },
  assure_curriculum_quality: {
    key: "assure_curriculum_quality", label: "Assure curriculum quality",
    question: "Is the taught curriculum landing, and where is it not?",
    pupilGrain: false,
  },
  monitor_inclusion_gaps: {
    key: "monitor_inclusion_gaps", label: "Monitor inclusion gaps",
    question: "Are disadvantaged, SEND and EAL pupils getting the same deal?",
    pupilGrain: false,
  },
  plan_department_response: {
    key: "plan_department_response", label: "Plan a department response",
    question: "What should this department change, and for which groups?",
    pupilGrain: false,
  },
  plan_next_lesson: {
    key: "plan_next_lesson", label: "Plan the next lesson",
    question: "What do I reteach this class on Monday?",
    pupilGrain: true,
  },
  support_individual_pupil: {
    key: "support_individual_pupil", label: "Support an individual pupil",
    question: "What changed for this child, and what would help?",
    pupilGrain: true,
  },
  // Held by every level, deliberately. Anyone shown a finding must be able to
  // annotate it or reject it — a system you can only agree with is not a tool,
  // and "the human can always overrule it" has to be true at the bottom of the
  // hierarchy as well as the top.
  curate_own_findings: {
    key: "curate_own_findings", label: "Curate what I am shown",
    question: "Is this actually a finding, and what do I know that the data does not?",
    pupilGrain: false,
  },
};

// `label` and `job` are NOT redefined here — they come from navigation.ts, so
// the nav rail and the console can never disagree about what an altitude is
// called or what the person there is trying to do.
export const LEVEL_DEFS: Record<Level, LevelDef> = {
  trust: {
    key: "trust", label: WORKSPACE_LABEL.trust, role: "Director of Education", glyph: "◈",
    job: WORKSPACE_PURPOSE.trust,
    purposes: ["allocate_trust_support", "monitor_inclusion_gaps", "curate_own_findings"],
    maxPupilGrain: null, // never resolves a child
    accent: "#7aa7ff",
  },
  school: {
    key: "school", label: WORKSPACE_LABEL.school, role: "Headteacher / SLT", glyph: "▤",
    job: WORKSPACE_PURPOSE.school,
    purposes: ["assure_curriculum_quality", "monitor_inclusion_gaps", "allocate_trust_support", "curate_own_findings"],
    maxPupilGrain: "internal",
    accent: "#58e0c2",
  },
  department: {
    key: "department", label: WORKSPACE_LABEL.department, role: "Head of Department", glyph: "▦",
    job: WORKSPACE_PURPOSE.department,
    purposes: ["plan_department_response", "assure_curriculum_quality", "monitor_inclusion_gaps", "curate_own_findings"],
    maxPupilGrain: "restricted",
    accent: "#ffd166",
  },
  teacher: {
    key: "teacher", label: WORKSPACE_LABEL.teacher, role: "Class teacher", glyph: "●",
    job: WORKSPACE_PURPOSE.teacher,
    purposes: ["plan_next_lesson", "support_individual_pupil", "curate_own_findings"],
    maxPupilGrain: "restricted",
    accent: "#ff9166",
  },
};

/** Can this level see a property at pupil grain? */
export function canSeePupilProperty(level: Level, marking: Sensitivity): boolean {
  const max = LEVEL_DEFS[level].maxPupilGrain;
  if (max === null) return false;
  // `special` is never readable next to a name, at any level.
  if (marking === "special") return false;
  return SENSITIVITY_RANK[marking] <= SENSITIVITY_RANK[max];
}

export function hasPurpose(level: Level, purpose: PurposeKey): boolean {
  return LEVEL_DEFS[level].purposes.includes(purpose);
}

/** True when a group is large enough to report on at all. */
export const groupReportable = (n: number) => n >= K_ANONYMITY_FLOOR;

/** The identity a session is acting as. In production this comes from the JWT;
 *  here it is chosen in the UI so the same console can be demonstrated at all
 *  four levels. */
export interface Viewer {
  level: Level;
  schoolId: string | null;      // null = whole trust
  departmentId: string | null;  // hod scope
  staffId: string | null;       // teacher scope
  classIds: string[];           // teacher's own classes
  name: string;
}

/** Does this viewer's scope contain the given school? */
export function inScope(viewer: Viewer, schoolId: string): boolean {
  return viewer.schoolId === null || viewer.schoolId === schoolId;
}
