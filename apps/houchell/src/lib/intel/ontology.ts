/* ─────────────────────────────────────────────────────────────────────────
   THE ONTOLOGY — one versioned artefact.

   This is the semantic layer of the intelligence console: object types, their
   properties, and the link types between them. It is deliberately a single
   module so that the DB views, the typed client, the ⌘K palette and (later)
   the LLM tool definitions are all generated from the same source of truth.

   Education's ontology is stable, so it is hard-coded rather than runtime
   extensible — see docs/education-intelligence/00-SYNTHESIS.md §3.

   Two rules this file exists to enforce:
     1. Every property carries a `sensitivity` marking that propagates
        downstream through lineage (see scope.ts).
     2. Every property is justified against a named question (`why`) — Art
        5(1)(c) data minimisation is a design constraint, not a policy PDF.
   ───────────────────────────────────────────────────────────────────────── */

export const ONTOLOGY_VERSION = "0.3.0";

/** How closely a property is held. Propagates: any derived value inherits the
 *  strongest marking of its inputs. */
export type Sensitivity =
  | "open"        // aggregate, non-identifying
  | "internal"    // pupil-grain but ordinary school business
  | "restricted"  // pupil-grain and consequential (attainment, attendance)
  | "special";    // Art 9 / SEND / health — never leaves the tenant, never to an LLM

export const SENSITIVITY_RANK: Record<Sensitivity, number> = {
  open: 0, internal: 1, restricted: 2, special: 3,
};

export const strongestMarking = (...m: Sensitivity[]): Sensitivity =>
  m.reduce((a, b) => (SENSITIVITY_RANK[b] > SENSITIVITY_RANK[a] ? b : a), "open");

export interface PropertyDef {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "boolean" | "enum";
  sensitivity: Sensitivity;
  /** The named question this field exists to answer. No question, no field. */
  why: string;
  unit?: string;
  values?: readonly string[];
}

export interface ObjectTypeDef {
  key: ObjectTypeKey;
  label: string;
  plural: string;
  /** Single glyph used in the console and the command palette. */
  glyph: string;
  accent: "accent" | "accent2" | "accent3" | "red" | "amb";
  /** Property used as the human-readable title of an instance. */
  titleProp: string;
  properties: PropertyDef[];
  /** Lowest role level that may open an instance of this type. */
  minLevel: "teacher" | "hod" | "head" | "trust";
}

export type ObjectTypeKey =
  | "Trust" | "School" | "Department" | "Staff" | "Class" | "TimetableSlot"
  | "Pupil" | "Subject" | "Objective" | "Assessment" | "Attempt"
  | "MasteryState" | "LiteracyScreen" | "AttendanceSession" | "Intervention";

export interface LinkTypeDef {
  key: string;
  from: ObjectTypeKey;
  to: ObjectTypeKey;
  label: string;
  /** Why this edge earns its keep — the analytic it unlocks. */
  unlocks: string;
  cardinality: "one" | "many";
}

/* ─── Object types ─────────────────────────────────────────────────────── */

export const OBJECT_TYPES: Record<ObjectTypeKey, ObjectTypeDef> = {
  Trust: {
    key: "Trust", label: "Trust", plural: "Trusts", glyph: "◈", accent: "accent2",
    titleProp: "name", minLevel: "trust",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "open", why: "Identify the tenant." },
      { key: "schoolCount", label: "Schools", type: "number", sensitivity: "open", why: "Scale of the comparison set." },
    ],
  },
  School: {
    key: "School", label: "School", plural: "Schools", glyph: "▤", accent: "accent2",
    titleProp: "name", minLevel: "trust",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "open", why: "Identify the school." },
      { key: "phase", label: "Phase", type: "enum", sensitivity: "open", values: ["secondary"], why: "Comparability of cohorts." },
      { key: "pupilCount", label: "On roll", type: "number", sensitivity: "open", why: "Denominator for every rate." },
      { key: "fsm6Pct", label: "FSM6", type: "number", unit: "%", sensitivity: "open", why: "Context for gap analysis — Ofsted Inclusion." },
    ],
  },
  Department: {
    key: "Department", label: "Department", plural: "Departments", glyph: "▦", accent: "accent",
    titleProp: "name", minLevel: "head",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "open", why: "Identify the department." },
      { key: "subjectKey", label: "Subject", type: "string", sensitivity: "open", why: "Join to curriculum." },
      { key: "staffCount", label: "Staff", type: "number", sensitivity: "internal", why: "Capacity when planning a response." },
    ],
  },
  Staff: {
    key: "Staff", label: "Staff", plural: "Staff", glyph: "◍", accent: "amb",
    titleProp: "name", minLevel: "hod",
    // NOTE: there is deliberately no performance property on Staff. Teacher
    // value-added is r≈0.4 year-to-year and ~35% misclassified on one year of
    // data; the console diagnoses SLOTS and SEQUENCES, never people.
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "internal", why: "Who to talk to about a slot." },
      { key: "role", label: "Role", type: "string", sensitivity: "internal", why: "Who can action a finding." },
      { key: "departmentId", label: "Department", type: "string", sensitivity: "internal", why: "Route the finding." },
    ],
  },
  Class: {
    key: "Class", label: "Class", plural: "Classes", glyph: "▣", accent: "accent",
    titleProp: "name", minLevel: "teacher",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "open", why: "Identify the teaching group." },
      { key: "year", label: "Year group", type: "number", sensitivity: "open", why: "Cohort comparability." },
      { key: "setNumber", label: "Set", type: "number", sensitivity: "internal", why: "Set boundaries are a candidate explanation." },
      { key: "size", label: "Size", type: "number", sensitivity: "open", why: "Denominator; k-anonymity floor." },
    ],
  },
  TimetableSlot: {
    key: "TimetableSlot", label: "Timetable slot", plural: "Timetable slots", glyph: "◫", accent: "accent3",
    titleProp: "label", minLevel: "hod",
    properties: [
      { key: "label", label: "Slot", type: "string", sensitivity: "open", why: "Name the slot under diagnosis." },
      { key: "day", label: "Day", type: "number", sensitivity: "open", why: "Day-of-week effects are real and fixable." },
      { key: "period", label: "Period", type: "number", sensitivity: "open", why: "Period-5 effects are real and fixable." },
      { key: "room", label: "Room", type: "string", sensitivity: "open", why: "Room/facility is a candidate explanation." },
    ],
  },
  Pupil: {
    key: "Pupil", label: "Pupil", plural: "Pupils", glyph: "●", accent: "accent",
    titleProp: "name", minLevel: "teacher",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "restricted", why: "The teacher must know which child." },
      { key: "year", label: "Year", type: "number", sensitivity: "internal", why: "Cohort comparability." },
      { key: "ks2", label: "KS2 scaled score", type: "number", sensitivity: "restricted", why: "Best available prior attainment covariate." },
      { key: "readingAge", label: "Reading age", type: "number", unit: "yrs", sensitivity: "restricted", why: "The literacy gate — the core join." },
      { key: "attendancePct", label: "Attendance", type: "number", unit: "%", sensitivity: "restricted", why: "Opportunity-to-learn; a candidate explanation." },
      { key: "fsm6", label: "FSM6", type: "boolean", sensitivity: "restricted", why: "Disaggregated accuracy + Ofsted Inclusion. Never an input to inference." },
      { key: "sen", label: "SEN status", type: "enum", values: ["none", "K", "E"], sensitivity: "special", why: "Fairness monitoring only. Physically separate from the inference pipeline." },
      { key: "eal", label: "EAL", type: "boolean", sensitivity: "restricted", why: "Distinguishes decoding from comprehension in the literacy join." },
    ],
  },
  Subject: {
    key: "Subject", label: "Subject", plural: "Subjects", glyph: "◇", accent: "accent2",
    titleProp: "name", minLevel: "teacher",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "open", why: "Identify the subject." },
      { key: "textLoad", label: "Text load", type: "number", sensitivity: "open", why: "Reading demand of the assessment — the other half of the literacy join." },
    ],
  },
  Objective: {
    key: "Objective", label: "Objective", plural: "Objectives", glyph: "◆", accent: "accent",
    titleProp: "name", minLevel: "teacher",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "open", why: "Identify the learning objective." },
      { key: "subjectKey", label: "Subject", type: "string", sensitivity: "open", why: "Curriculum placement." },
      { key: "taughtWeek", label: "Taught in week", type: "number", sensitivity: "open", why: "Sequencing — did the prerequisite come first?" },
    ],
  },
  Assessment: {
    key: "Assessment", label: "Assessment", plural: "Assessments", glyph: "▢", accent: "accent3",
    titleProp: "name", minLevel: "teacher",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "open", why: "Identify the assessment point." },
      { key: "window", label: "Window", type: "number", sensitivity: "open", why: "Order the trajectory." },
      { key: "textLoad", label: "Text load", type: "number", sensitivity: "open", why: "Reading demand of this paper." },
    ],
  },
  Attempt: {
    key: "Attempt", label: "Attempt", plural: "Attempts", glyph: "·", accent: "accent",
    titleProp: "label", minLevel: "teacher",
    properties: [
      { key: "label", label: "Attempt", type: "string", sensitivity: "restricted", why: "The evidence behind every claim." },
      { key: "score", label: "Standardised score", type: "number", sensitivity: "restricted", why: "The measurement itself." },
    ],
  },
  MasteryState: {
    key: "MasteryState", label: "Mastery state", plural: "Mastery states", glyph: "◐", accent: "accent",
    titleProp: "label", minLevel: "teacher",
    properties: [
      { key: "label", label: "State", type: "string", sensitivity: "restricted", why: "Per-pupil per-objective learning state — the moat." },
      { key: "pct", label: "Mastery", type: "number", unit: "%", sensitivity: "restricted", why: "What to reteach." },
    ],
  },
  LiteracyScreen: {
    key: "LiteracyScreen", label: "Literacy screen", plural: "Literacy screens", glyph: "◎", accent: "accent2",
    titleProp: "label", minLevel: "teacher",
    properties: [
      { key: "label", label: "Screen", type: "string", sensitivity: "restricted", why: "Provenance of the reading age." },
      { key: "readingAge", label: "Reading age", type: "number", unit: "yrs", sensitivity: "restricted", why: "Gates access to every written assessment." },
      { key: "takenOn", label: "Taken", type: "date", sensitivity: "internal", why: "Staleness — a two-year-old screen is not evidence." },
    ],
  },
  AttendanceSession: {
    key: "AttendanceSession", label: "Attendance", plural: "Attendance", glyph: "◌", accent: "amb",
    titleProp: "label", minLevel: "teacher",
    properties: [
      { key: "label", label: "Session", type: "string", sensitivity: "restricted", why: "Opportunity to learn." },
      { key: "presentPct", label: "Present", type: "number", unit: "%", sensitivity: "restricted", why: "Rules a trajectory change in or out." },
    ],
  },
  Intervention: {
    key: "Intervention", label: "Intervention", plural: "Interventions", glyph: "▶", accent: "accent",
    titleProp: "name", minLevel: "teacher",
    properties: [
      { key: "name", label: "Name", type: "string", sensitivity: "internal", why: "What was actually done." },
      { key: "startedOn", label: "Started", type: "date", sensitivity: "internal", why: "Before/after boundary for the efficacy loop." },
      { key: "status", label: "Status", type: "enum", values: ["proposed", "running", "closed"], why: "Did anything happen?", sensitivity: "internal" },
    ],
  },
};

/* ─── Link types ───────────────────────────────────────────────────────── */

export const LINK_TYPES: LinkTypeDef[] = [
  { key: "school_in_trust", from: "School", to: "Trust", label: "part of", cardinality: "one", unlocks: "School-vs-trust benchmarking." },
  { key: "department_in_school", from: "Department", to: "School", label: "within", cardinality: "one", unlocks: "Department-level scoping." },
  { key: "staff_in_department", from: "Staff", to: "Department", label: "member of", cardinality: "one", unlocks: "Routing a finding to a person who can act." },
  { key: "class_of_subject", from: "Class", to: "Subject", label: "teaches", cardinality: "one", unlocks: "Cross-subject residuals." },
  { key: "class_in_slot", from: "Class", to: "TimetableSlot", label: "timetabled at", cardinality: "one", unlocks: "Diagnose the SLOT, not the teacher. The politically survivable version of teacher analytics." },
  { key: "pupil_in_class", from: "Pupil", to: "Class", label: "member of", cardinality: "many", unlocks: "Every cohort roll-up." },
  { key: "attempt_by_pupil", from: "Attempt", to: "Pupil", label: "by", cardinality: "one", unlocks: "Pupil-grain trajectory." },
  { key: "attempt_on_assessment", from: "Attempt", to: "Assessment", label: "on", cardinality: "one", unlocks: "Windowed change detection." },
  { key: "attempt_evidences_mastery", from: "Attempt", to: "MasteryState", label: "evidences", cardinality: "one", unlocks: "Claims are always clickable through to raw evidence." },
  { key: "mastery_against_objective", from: "MasteryState", to: "Objective", label: "against", cardinality: "one", unlocks: "What to reteach on Monday." },
  { key: "objective_prerequisite_of", from: "Objective", to: "Objective", label: "prerequisite of", cardinality: "many", unlocks: "The curriculum DAG — distinguishes 'never learned the prerequisite' from 'didn't get this topic'." },
  { key: "screen_gates_assessment", from: "LiteracyScreen", to: "Assessment", label: "gates", cardinality: "many", unlocks: "THE WEDGE: reading age × text load. No incumbent joins these." },
  { key: "intervention_targets_mastery", from: "Intervention", to: "MasteryState", label: "targets", cardinality: "many", unlocks: "Closes the efficacy loop — did the action work?" },
];

/** Every link into or out of a type. Powers the console's "related objects" rail. */
export function linksFor(type: ObjectTypeKey) {
  return {
    out: LINK_TYPES.filter((l) => l.from === type),
    in: LINK_TYPES.filter((l) => l.to === type),
  };
}

export const propertyDef = (type: ObjectTypeKey, key: string) =>
  OBJECT_TYPES[type].properties.find((p) => p.key === key);

/** Marking of a derived figure = strongest marking of its inputs. */
export function derivedMarking(inputs: { type: ObjectTypeKey; prop: string }[]): Sensitivity {
  return strongestMarking(
    ...inputs.map((i) => propertyDef(i.type, i.prop)?.sensitivity ?? "internal"),
  );
}
