/* ─────────────────────────────────────────────────────────────────────────
   THE KINETIC LAYER — actions are the only way anything changes.

   No component and no model writes state directly. Every mutation is a named
   action with typed parameters, a permission predicate, validation, side
   effects and an immutable history row. That buys audit, undo, agent safety
   and a changelog for free — and given an LLM will eventually sit next to
   children's data, it is the single most important architectural decision in
   the whole console.

   The rule that makes it real: `dispatch` is the only export that mutates.
   ───────────────────────────────────────────────────────────────────────── */

import { LEVEL_DEFS, type Level, type PurposeKey, type Viewer } from "./scope";
import type { Finding } from "./analytics";

export type ActionKey =
  | "readability_pass"
  | "timetable_review"
  | "reorder_scheme"
  | "generate_reteach"
  | "brief_department"
  | "flag_for_scrutiny"
  | "note_professional_judgement"
  | "dismiss_finding";

export interface ActionDef {
  key: ActionKey;
  label: string;
  /** What actually happens, in the user's words. */
  effect: string;
  glyph: string;
  /** Levels permitted to invoke it. */
  levels: Level[];
  /** The purpose under which it is invoked. */
  purpose: PurposeKey;
  /** Actions that change something in the real world need a second look. */
  consequential: boolean;
  /** Free text the actor must supply — human-in-the-loop, structurally. */
  requiresNote?: boolean;
}

export const ACTIONS: Record<ActionKey, ActionDef> = {
  readability_pass: {
    key: "readability_pass", label: "Commission a readability pass", glyph: "◎",
    effect: "Raises a task on the department to rewrite the stem of every question above the target reading age, without changing what is assessed.",
    levels: ["school", "department", "teacher"], purpose: "assure_curriculum_quality", consequential: true,
  },
  timetable_review: {
    key: "timetable_review", label: "Send to timetable review", glyph: "◫",
    effect: "Adds the slot to next year's build constraints with the evidence attached. Names no member of staff.",
    levels: ["school"], purpose: "assure_curriculum_quality", consequential: true,
  },
  reorder_scheme: {
    key: "reorder_scheme", label: "Propose a sequence change", glyph: "◆",
    effect: "Drafts a scheme-of-work amendment moving the prerequisite before the dependent objective, for the HoD to accept or reject.",
    levels: ["department", "school"], purpose: "plan_department_response", consequential: true,
  },
  generate_reteach: {
    key: "generate_reteach", label: "Build the reteach", glyph: "▶",
    effect: "Generates a 15-minute reteach sequence and a recheck quiz for the affected objective, using the existing lesson engine.",
    levels: ["department", "teacher"], purpose: "plan_next_lesson", consequential: false,
  },
  brief_department: {
    key: "brief_department", label: "Brief the department", glyph: "▦",
    effect: "Produces a one-page brief — the finding, the evidence, the ranked explanations, and what would rule each in or out.",
    levels: ["trust", "school", "department"], purpose: "plan_department_response", consequential: false,
  },
  flag_for_scrutiny: {
    key: "flag_for_scrutiny", label: "Add to scrutiny agenda", glyph: "▤",
    effect: "Puts the finding on the next quality-of-education meeting with its evidence pack.",
    levels: ["trust", "school", "department"], purpose: "assure_curriculum_quality", consequential: false,
  },
  note_professional_judgement: {
    key: "note_professional_judgement", label: "Record what you know", glyph: "✎",
    effect: "Attaches your read of the situation to the finding. Your note outranks the analysis and is shown above it from then on.",
    levels: ["trust", "school", "department", "teacher"], purpose: "curate_own_findings",
    consequential: false, requiresNote: true,
  },
  dismiss_finding: {
    key: "dismiss_finding", label: "Not a finding", glyph: "✕",
    effect: "Closes it and records why, so the same thing is not raised at you again next window.",
    levels: ["trust", "school", "department", "teacher"], purpose: "curate_own_findings",
    consequential: false, requiresNote: true,
  },
};

/* ─── Permission ───────────────────────────────────────────────────────── */

/** Why an action is or isn't available. `reason` is always shown to the user —
 *  a permission system that refuses silently teaches nobody anything. */
export interface Verdict { allowed: boolean; reason?: string; }

export function can(viewer: Viewer, key: ActionKey, finding?: Finding): Verdict {
  const def = ACTIONS[key];
  if (!def) return { allowed: false, reason: `Unknown action "${key}".` };
  if (!def.levels.includes(viewer.level)) {
    return { allowed: false, reason: `${LEVEL_DEFS[viewer.level].label} cannot invoke this. It belongs to ${def.levels.map((l) => LEVEL_DEFS[l].label).join(" or ")}.` };
  }
  if (!LEVEL_DEFS[viewer.level].purposes.includes(def.purpose)) {
    return { allowed: false, reason: `This action runs under the purpose "${def.purpose}", which is not one of your granted purposes.` };
  }
  if (finding?.suppressed) {
    return { allowed: false, reason: `The underlying group is below the k-anonymity floor, so there is nothing here to act on.` };
  }
  if (finding && viewer.schoolId && finding.schoolId && finding.schoolId !== viewer.schoolId) {
    return { allowed: false, reason: `That finding is outside your school scope.` };
  }
  return { allowed: true };
}

/* ─── The immutable history ────────────────────────────────────────────── */

export interface ActionRecord {
  id: string;
  at: number;
  actor: string;
  level: Level;
  action: ActionKey;
  purpose: PurposeKey;
  findingId?: string;
  findingHeadline?: string;
  note?: string;
  /** Set when the action was undone. The original row is never deleted. */
  undoneAt?: number;
}

const history: ActionRecord[] = [];
const listeners = new Set<() => void>();
let seq = 0;

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const emit = () => listeners.forEach((f) => f());

export interface DispatchResult {
  ok: boolean;
  record?: ActionRecord;
  error?: string;
}

/** THE ONLY WRITE PATH. */
export function dispatch(
  viewer: Viewer,
  key: ActionKey,
  opts: { finding?: Finding; note?: string } = {},
): DispatchResult {
  const verdict = can(viewer, key, opts.finding);
  if (!verdict.allowed) return { ok: false, error: verdict.reason };

  const def = ACTIONS[key];
  if (def.requiresNote && !opts.note?.trim()) {
    return { ok: false, error: "This action requires you to say why. Human-in-the-loop here is structural, not decorative." };
  }

  const record: ActionRecord = {
    id: `act-${++seq}`,
    at: Date.now(),
    actor: viewer.name,
    level: viewer.level,
    action: key,
    purpose: def.purpose,
    findingId: opts.finding?.id,
    findingHeadline: opts.finding?.headline,
    note: opts.note?.trim() || undefined,
  };
  history.push(record);
  emit();
  return { ok: true, record };
}

/** Undo marks, never deletes — the original row stays in the audit trail. */
export function undo(id: string): boolean {
  const r = history.find((x) => x.id === id && !x.undoneAt);
  if (!r) return false;
  r.undoneAt = Date.now();
  emit();
  return true;
}

export const auditLog = (): readonly ActionRecord[] => history;

export const actionsOn = (findingId: string) =>
  history.filter((r) => r.findingId === findingId && !r.undoneAt);

/** Notes recorded by humans outrank the analysis and are surfaced above it. */
export const humanNotesOn = (findingId: string) =>
  actionsOn(findingId).filter((r) => r.note);
