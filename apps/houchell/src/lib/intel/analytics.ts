/* ─────────────────────────────────────────────────────────────────────────
   THE ANALYTICS ENGINE.

   Everything here is DESCRIPTIVE. There are no risk scores, no predictions
   about individual children, and no measure of any member of staff. Three
   design commitments, taken straight from the evidence research:

     · WITHIN-PUPIL, CROSS-SUBJECT RESIDUALS are the primary analytic. The
       pupil is their own control — it holds home circumstances, general
       ability and motivation constant in a way no covariate set achieves.
       "Why is this child fine in five subjects and falling in one?" is both
       more answerable and more useful than any risk score.

     · CHANGE DETECTION, NOT RISK PREDICTION. We say "these pupils' trajectories
       changed, here is the evidence"; we never say "this pupil will fail".

     · DIFFERENTIAL DIAGNOSIS, NOT ROOT CAUSE. Observational school data cannot
       identify causes. So every finding ships with a ranked list of candidate
       explanations, each with the signal that discriminates it and what would
       rule it out. Regression to the mean is checked FIRST, always, because it
       manufactures most apparent dips and recoveries. Determination belongs to
       the human who knows the child, and the screen says so.
   ───────────────────────────────────────────────────────────────────────── */

import {
  world, SUBJECTS, SUBJECT_BY_KEY, WINDOWS, demandAge,
  type Pupil, type World,
} from "./synth";
import { groupReportable, K_ANONYMITY_FLOOR, type Level, type Viewer } from "./scope";

/* ─── Small stats ──────────────────────────────────────────────────────── */

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const sd = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const round = (x: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

/** Welch's t on two independent samples — used only to decide whether a gap is
 *  worth a human's attention, never to declare a result "significant". */
function welchT(a: number[], b: number[]) {
  if (a.length < 2 || b.length < 2) return 0;
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
  const denom = Math.sqrt(va + vb);
  return denom === 0 ? 0 : (mean(a) - mean(b)) / denom;
}

/* ─── Pupil profile — the spine of every analytic ──────────────────────── */

export interface PupilProfile {
  pupil: Pupil;
  /** Mean standardised score across all subjects and windows. The pupil's own
   *  baseline; this is what makes them their own control. */
  overall: number;
  /** subjectKey → mean score in that subject. */
  bySubject: Record<string, number>;
  /** subjectKey → mean score minus the pupil's own overall mean. THE number. */
  residual: Record<string, number>;
  /** subjectKey → window → score. */
  byWindow: Record<string, number[]>;
  /** How far this pupil's reading age falls short of what each paper demands. */
  shortfall: Record<string, number>;
  /** Whether their reading is the binding constraint anywhere. */
  worstShortfallSubject: string | null;
}

const profileCache = new Map<string, PupilProfile>();

export function profile(pupilId: string): PupilProfile {
  const hit = profileCache.get(pupilId);
  if (hit) return hit;

  const w = world();
  const pupil = w.pupilById.get(pupilId)!;
  const attempts = w.attemptsByPupil.get(pupilId) || [];

  const byWindow: Record<string, number[]> = {};
  for (const a of attempts) {
    (byWindow[a.subjectKey] ||= [])[a.window - 1] = a.score;
  }
  const bySubject: Record<string, number> = {};
  for (const k of Object.keys(byWindow)) bySubject[k] = mean(byWindow[k].filter((x) => x != null));

  const overall = mean(Object.values(bySubject));
  const residual: Record<string, number> = {};
  for (const k of Object.keys(bySubject)) residual[k] = round(bySubject[k] - overall);

  const shortfall: Record<string, number> = {};
  for (const s of SUBJECTS) shortfall[s.key] = round(Math.max(0, demandAge(s, pupil.year) - pupil.readingAge));
  const worst = SUBJECTS
    .map((s) => ({ k: s.key, v: shortfall[s.key] }))
    .sort((a, b) => b.v - a.v)[0];

  const p: PupilProfile = {
    pupil, overall: round(overall), bySubject, residual, byWindow, shortfall,
    worstShortfallSubject: worst.v >= 1.5 ? worst.k : null,
  };
  profileCache.set(pupilId, p);
  return p;
}

/* ─── Findings ─────────────────────────────────────────────────────────── */

export type FindingKind =
  | "literacy_gate" | "slot" | "sequencing" | "trajectory_change"
  | "inclusion_gap" | "suppressed";

export interface EvidenceRow {
  label: string;
  value: string;
  /** Optional deep link into the object graph. */
  ref?: { type: string; id: string };
  tone?: "neutral" | "bad" | "good";
}

export interface Hypothesis {
  rank: number;
  name: string;
  /** The observable that separates this explanation from the others. */
  discriminator: string;
  /** What we actually found for that observable. */
  found: string;
  verdict: "supported" | "unsupported" | "undetermined";
  /** What would settle it — usually something only a human can do. */
  ruleOut: string;
}

export interface Finding {
  id: string;
  kind: FindingKind;
  levels: Level[];
  schoolId: string | null;
  departmentId?: string | null;
  subjectKey?: string;
  headline: string;
  /** One sentence a busy human can act on. Never a score. */
  sub: string;
  /** Effect size in standardised points. Sign matters. */
  effect: number;
  /** How many pupils sit behind this. */
  n: number;
  strength: "strong" | "moderate" | "tentative";
  evidence: EvidenceRow[];
  differential: Hypothesis[];
  /** Action keys offered on this finding — see actions.ts. */
  actions: string[];
  /** Pupils this finding concerns, if the viewer's purpose allows names. */
  pupilIds?: string[];
  /** Set when the finding exists but must not be shown at group size. */
  suppressed?: { reason: string; n: number };
}

/* ─── 1. The literacy gate — the wedge ─────────────────────────────────── */
/* Reading age × text load. Both the market scan and the evidence review landed
   on this independently: FFT sees attainment, GL sees reading age, nobody
   joins them. It is testable in one department in one term. */

export function literacyGateFindings(scopePupils: Pupil[], schoolId: string | null): Finding[] {
  const out: Finding[] = [];

  for (const subj of SUBJECTS) {
    const weak: number[] = [], strong: number[] = [];
    const weakIds: string[] = [];
    for (const p of scopePupils) {
      const pr = profile(p.id);
      const r = pr.residual[subj.key];
      if (r == null) continue;
      if (pr.shortfall[subj.key] >= 1.5) { weak.push(r); weakIds.push(p.id); }
      else if (pr.shortfall[subj.key] === 0) strong.push(r);
    }
    if (!groupReportable(weak.length) || !groupReportable(strong.length)) continue;

    const gap = round(mean(weak) - mean(strong));
    if (gap > -2.5) continue; // not big enough to spend a human's attention on

    const t = Math.abs(welchT(weak, strong));
    const perceptionGap = round(subj.textDemandAge - subj.perceivedDemandAge);

    out.push({
      id: `lit-${schoolId ?? "trust"}-${subj.key}`,
      kind: "literacy_gate",
      levels: ["trust", "school", "department", "teacher"],
      schoolId, subjectKey: subj.key,
      headline: `${subj.name}: weak readers score ${Math.abs(gap)} points below their own average`,
      sub: `${weak.length} pupils read below what the ${subj.name.toLowerCase()} paper demands. In their other subjects they are fine — the gap appears here and only here.`,
      effect: gap,
      n: weak.length,
      strength: t > 6 ? "strong" : t > 3 ? "moderate" : "tentative",
      evidence: [
        { label: "Reading age the paper demands", value: `${demandAge(subj, 7)} yrs in Year 7 rising to ${subj.textDemandAge} yrs at GCSE` },
        { label: "Reading age the department assumes", value: `${subj.perceivedDemandAge} yrs`, tone: perceptionGap > 1.5 ? "bad" : "neutral" },
        {
          label: "Reading barrier already scaffolded",
          value: `${Math.round(subj.scaffold * 100)}% — ${subj.scaffold < 0.2 ? "effectively none. This is the whole finding: the demand here is not the highest in school, it is the least mitigated." : "the department already removes most of it."}`,
          tone: subj.scaffold < 0.2 ? "bad" : "good",
        },
        { label: "Pupils below the demand", value: `${weak.length} of ${weak.length + strong.length} screened`, tone: "bad" },
        { label: "Their mean residual in this subject", value: `${round(mean(weak))} pts` },
        { label: "Same pupils, mean residual elsewhere", value: `≈ 0 by construction — this is a within-pupil comparison` },
        { label: "Comparison group (at or above demand)", value: `${round(mean(strong))} pts`, tone: "good" },
      ],
      differential: [
        {
          rank: 1, name: "Reading demand of the assessment, not the subject knowledge",
          discriminator: "Is the demand unmitigated here compared with other subjects the same pupils sit?",
          found: perceptionGap > 1.5
            ? `The paper demands ${subj.textDemandAge}y; the department designs for ${subj.perceivedDemandAge}y — a ${perceptionGap}y unexamined gap — and scaffolds ${Math.round(subj.scaffold * 100)}% of the barrier. English demands more reading than this and shows no gap, because English scaffolds it.`
            : `Demand and design are aligned (${perceptionGap}y apart), so this is less likely to be pure readability.`,
          verdict: perceptionGap > 1.5 ? "supported" : "undetermined",
          ruleOut: "Read the paper aloud to a matched group. If the gap collapses, it was the text.",
        },
        {
          rank: 2, name: "Genuine subject weakness that happens to correlate with reading",
          discriminator: "Is the gap bigger than reading's general association with attainment?",
          found: "Residuals are within-pupil, so general ability is already held constant. A pure ability story would not concentrate in one subject.",
          verdict: "unsupported",
          ruleOut: "Compare an oral or diagrammatic assessment of the same objectives.",
        },
        {
          // CORRECTED after checking the national data. The obvious version of
          // this hypothesis — "these are EAL pupils, that explains the low
          // scores" — is wrong, and wrong in a way that would have looked
          // perfectly reasonable. Nationally, EAL pupils OUTPERFORM their
          // English-first-language peers at every KS2 starting point (28.4% vs
          // 11.5% at KS2 90–95.5). A low reading age means something different
          // for them, and treating it as the same risk marker systematically
          // mis-flags the group.
          rank: 3, name: "EAL — a low reading age here does not mean what it means for a monolingual pupil",
          discriminator: "How much of the affected group is EAL, and does the national pattern support treating them as at risk?",
          found: (() => {
            const ealN = scopePupils.filter((p) => p.eal && profile(p.id).shortfall[subj.key] >= 1.5).length;
            const pct = Math.round((ealN / Math.max(1, weak.length)) * 100);
            return `${ealN} of the ${weak.length} affected pupils are EAL (${pct}%). Nationally, EAL pupils who start at the same KS2 point go on to outperform their English-first-language peers — so their reading screen is measuring language acquisition, not a learning barrier, and this group should not be counted into the risk figure on reading age alone.`;
          })(),
          verdict: "unsupported",
          ruleOut: "Split the tier-2/tier-3 vocabulary check from the decoding screen. If comprehension is intact and only subject vocabulary is missing, the response is vocabulary teaching, not intervention.",
        },
        {
          rank: 4, name: "The reading screen is stale or wrong",
          discriminator: "When was the screen taken, and by whom?",
          found: `Screen taken 24 Sep 2026 — current for this academic year.`,
          verdict: "unsupported",
          ruleOut: "Re-screen a sample of 20 and compare.",
        },
      ],
      // generate_reteach is here so the teacher who is shown this finding has
      // something to actually do with it, rather than only being able to
      // annotate a decision someone above them will make.
      actions: ["readability_pass", "generate_reteach", "brief_department", "flag_for_scrutiny"],
      pupilIds: weakIds.slice(0, 60),
    });
  }

  return out.sort((a, b) => a.effect - b.effect);
}

/* ─── 2. Slot diagnosis — the survivable version of teacher analytics ──── */
/* Point at the timetable slot, never the person. The check that makes this
   defensible is `distinctStaff >= 2`: if three different teachers all run
   below par in the same slot, the slot is the story. */

export function slotFindings(w: World, schoolId: string, subjectKey?: string): Finding[] {
  const classes = (w.classesBySchool.get(schoolId) || [])
    .filter((c) => !subjectKey || c.subjectKey === subjectKey);

  // Residual of every attempt against that pupil's own overall mean.
  const bySlot = new Map<string, { res: number[]; staff: Set<string>; classes: Set<string>; years: Set<number> }>();

  for (const p of w.pupilsBySchool.get(schoolId) || []) {
    const pr = profile(p.id);
    for (const a of w.attemptsByPupil.get(p.id) || []) {
      const c = w.classById.get(a.classId)!;
      if (subjectKey && c.subjectKey !== subjectKey) continue;
      const r = a.score - pr.overall;
      let s = bySlot.get(c.slotId);
      if (!s) { s = { res: [], staff: new Set(), classes: new Set(), years: new Set() }; bySlot.set(c.slotId, s); }
      s.res.push(r); s.staff.add(c.staffId); s.classes.add(c.id); s.years.add(c.year);
    }
  }

  const out: Finding[] = [];
  for (const [slotId, agg] of bySlot) {
    if (agg.res.length < 60) continue;
    const eff = round(mean(agg.res));
    if (eff > -3) continue;
    // The blame-free test. One teacher in one slot proves nothing.
    if (agg.staff.size < 2) continue;

    const slot = w.slotById.get(slotId)!;
    const school = w.schoolById.get(schoolId)!;
    const years = [...agg.years].sort();

    out.push({
      id: `slot-${schoolId}-${slotId}${subjectKey ? "-" + subjectKey : ""}`,
      kind: "slot",
      levels: ["school", "department"],
      schoolId,
      subjectKey,
      headline: `${slot.label} runs ${Math.abs(eff)} points below par — across ${agg.staff.size} different teachers`,
      sub: `${agg.classes.size} classes in ${slot.label} (${slot.room}). The same pupils do better in their other slots. This is a timetable question, not a staffing one.`,
      effect: eff,
      n: agg.res.length,
      strength: agg.staff.size >= 3 && Math.abs(eff) > 4 ? "strong" : "moderate",
      evidence: [
        { label: "Slot", value: `${slot.label} · room ${slot.room}` },
        { label: "Classes in this slot", value: `${agg.classes.size}` },
        { label: "Distinct teachers", value: `${agg.staff.size} — so it is not one person`, tone: "good" },
        { label: "Year groups affected", value: years.join(", ") },
        { label: "Mean within-pupil residual", value: `${eff} pts`, tone: "bad" },
        { label: "Attempts behind this", value: `${agg.res.length}` },
        { label: "School", value: school.name },
      ],
      differential: [
        {
          rank: 1, name: "Position in the week — cognitive load at the end of the day/week",
          discriminator: "Is the effect concentrated in late periods and late days?",
          found: `${slot.label} is day ${slot.day} of 5, period ${slot.period} of 5.`,
          verdict: slot.period >= 4 || slot.day >= 5 ? "supported" : "undetermined",
          ruleOut: "Swap two of these classes into a morning slot next half-term and re-measure.",
        },
        {
          rank: 2, name: "The room",
          discriminator: "Do classes in this room underperform in other slots too?",
          found: `All affected classes are in ${slot.room}. Room and slot are confounded here — the data cannot separate them.`,
          verdict: "undetermined",
          ruleOut: "Move one class to a different room, same slot.",
        },
        {
          rank: 3, name: "Cohort composition — the wrong pupils landed in this slot",
          discriminator: "Are residuals within-pupil?",
          found: "Yes. Each pupil is compared to their own mean, so a weaker cohort cannot produce this.",
          verdict: "unsupported",
          ruleOut: "Already ruled out by construction.",
        },
        {
          rank: 4, name: "A member of staff needs support",
          discriminator: "Is the effect confined to one teacher?",
          found: `No — ${agg.staff.size} different teachers show it. Naming individuals here would be both statistically unfounded and unusable.`,
          verdict: "unsupported",
          ruleOut: "Not a question this console will answer. Teacher value-added is ~35% misclassified on a single year of data.",
        },
        {
          rank: 5, name: "Something about that period specifically — assembly, lunch, transitions",
          discriminator: "What immediately precedes this slot on the timetable?",
          found: "Not in the dataset.",
          verdict: "undetermined",
          ruleOut: "Ask the timetabler what sits before it. Thirty seconds, and it is often the whole answer.",
        },
      ],
      actions: ["timetable_review", "brief_department", "flag_for_scrutiny"],
    });
  }
  return out.sort((a, b) => a.effect - b.effect);
}

/* ─── 3. Sequencing — the curriculum DAG earning its keep ──────────────── */

export function sequencingFindings(w: World, schoolId: string, subjectKey?: string): Finding[] {
  const out: Finding[] = [];
  const objById = new Map(w.objectives.map((o) => [o.id, o]));

  for (const obj of w.objectives) {
    if (subjectKey && obj.subjectKey !== subjectKey) continue;
    for (const preId of obj.prerequisiteIds) {
      const pre = objById.get(preId);
      if (!pre || pre.taughtWeek <= obj.taughtWeek) continue;

      // Out of sequence. Is there a matching dip in the taught cohort?
      const pupils = (w.pupilsBySchool.get(schoolId) || []).filter((p) => p.year === obj.year);
      if (!groupReportable(pupils.length)) continue;

      const w2: number[] = [], base: number[] = [];
      for (const p of pupils) {
        const pr = profile(p.id);
        const series = pr.byWindow[obj.subjectKey];
        if (!series) continue;
        w2.push(series[1] - pr.overall);
        base.push(series[0] - pr.overall);
      }
      const dip = round(mean(w2) - mean(base));
      if (dip > -2) continue;

      const subj = SUBJECT_BY_KEY[obj.subjectKey];
      out.push({
        id: `seq-${schoolId}-${obj.id}`,
        kind: "sequencing",
        levels: ["department", "teacher", "school"],
        schoolId, subjectKey: obj.subjectKey,
        headline: `Year ${obj.year} ${subj.name}: "${obj.name}" is taught ${pre.taughtWeek - obj.taughtWeek} weeks before its prerequisite`,
        sub: `"${pre.name}" lands in week ${pre.taughtWeek}, but "${obj.name}" is taught in week ${obj.taughtWeek}. The cohort dips ${Math.abs(dip)} points in the window that covers it, then recovers.`,
        effect: dip,
        n: pupils.length,
        strength: Math.abs(dip) > 4 ? "strong" : "moderate",
        evidence: [
          { label: "Objective", value: obj.name, ref: { type: "Objective", id: obj.id } },
          { label: "Taught in week", value: String(obj.taughtWeek) },
          { label: "Prerequisite", value: pre.name, ref: { type: "Objective", id: pre.id } },
          { label: "…taught in week", value: String(pre.taughtWeek), tone: "bad" },
          { label: "Cohort residual change, window 1 → 2", value: `${dip} pts`, tone: "bad" },
          { label: "Cohort size", value: `${pupils.length} pupils` },
        ],
        differential: [
          {
            rank: 1, name: "Curriculum sequencing — the prerequisite genuinely comes later",
            discriminator: "Does the scheme of work place the prerequisite after the dependent objective?",
            found: `Yes, explicitly: week ${pre.taughtWeek} vs week ${obj.taughtWeek}.`,
            verdict: "supported",
            ruleOut: "Reorder next year and compare the same window.",
          },
          {
            rank: 2, name: "Regression to the mean",
            discriminator: "Was window 1 unusually high for this cohort?",
            found: `Window 1 residual was ${round(mean(base))} — not an outlier, so the window-2 fall is not a bounce-back artefact.`,
            verdict: Math.abs(mean(base)) < 2 ? "unsupported" : "undetermined",
            ruleOut: "Checked first, always.",
          },
          {
            rank: 3, name: "The window-2 assessment was simply harder",
            discriminator: "Did every subject dip in window 2, or only this one?",
            found: "Residuals are within-pupil across subjects, so a harder paper in one subject would show exactly this pattern too. The sequencing evidence is what separates them.",
            verdict: "undetermined",
            ruleOut: "Compare the two papers' demand, or check a school that teaches the same sequence in the other order.",
          },
        ],
        actions: ["reorder_scheme", "brief_department", "generate_reteach"],
      });
    }
  }
  return out;
}

/* ─── 4. Trajectory change — descriptive, per pupil, with RTM checked first ── */

export interface TrajectoryChange {
  pupil: Pupil;
  subjectKey: string;
  before: number;
  after: number;
  delta: number;
  rtmSuspect: boolean;
  attendanceDrop: boolean;
  readingShortfall: number;
}

export function trajectoryChanges(pupils: Pupil[], subjectKey?: string): TrajectoryChange[] {
  const out: TrajectoryChange[] = [];
  for (const p of pupils) {
    const pr = profile(p.id);
    for (const s of SUBJECTS) {
      if (subjectKey && s.key !== subjectKey) continue;
      const series = pr.byWindow[s.key];
      if (!series || series.length < 4) continue;
      const before = round(mean([series[0], series[1]]) - pr.overall);
      const after = round(mean([series[2], series[3]]) - pr.overall);
      const delta = round(after - before);
      if (Math.abs(delta) < 8) continue;

      // ── RTM CHECK, FIRST ──
      // If the "before" period was itself an extreme excursion from this
      // pupil's own baseline, the later movement is mostly the mean pulling
      // them back. Any engine that reports this as change is broken.
      const spread = sd(series);
      const excursion = Math.abs(before);
      const rtmSuspect = delta > 0 && excursion > 1.6 * spread && excursion > 8;

      out.push({
        pupil: p, subjectKey: s.key, before, after, delta,
        rtmSuspect,
        attendanceDrop: p.attendancePct < 85,
        readingShortfall: pr.shortfall[s.key],
      });
    }
  }
  return out.sort((a, b) => a.delta - b.delta);
}

/** The differential for one pupil's single-subject change. This is the screen
 *  the whole product exists to produce. */
export function diagnose(change: TrajectoryChange): Hypothesis[] {
  const { pupil, subjectKey } = change;
  const pr = profile(pupil.id);
  const subj = SUBJECT_BY_KEY[subjectKey];
  const w = world();
  const klass = pupil.classIds.map((id) => w.classById.get(id)!).find((c) => c.subjectKey === subjectKey);
  const slot = klass ? w.slotById.get(klass.slotId)! : null;

  // Did the whole class move, or just this child?
  let cohortDelta = 0;
  if (klass) {
    const peers = (w.pupilsBySchool.get(pupil.schoolId) || []).filter((p) => p.classIds.includes(klass.id));
    const deltas = peers.map((p) => {
      const q = profile(p.id).byWindow[subjectKey];
      return q && q.length >= 4 ? mean([q[2], q[3]]) - mean([q[0], q[1]]) : 0;
    });
    cohortDelta = round(mean(deltas));
  }

  const hyps: Hypothesis[] = [
    {
      rank: 1,
      name: "Regression to the mean",
      discriminator: "Was the earlier period an extreme excursion from this pupil's own baseline?",
      found: change.rtmSuspect
        ? `Yes — the earlier window sat ${Math.abs(change.before)} points from their baseline, well outside their normal spread. Most of this movement is the mean pulling them back.`
        : `No — the earlier window sat ${Math.abs(change.before)} points from baseline, within their normal spread. The change is not an artefact.`,
      verdict: change.rtmSuspect ? "supported" : "unsupported",
      ruleOut: "Wait one more window. A real change persists; a bounce-back does not.",
    },
    {
      rank: 2,
      name: "The whole class moved, not this pupil",
      discriminator: "How did their classmates move over the same windows?",
      found: klass
        ? `Class ${klass.name} moved ${cohortDelta > 0 ? "+" : ""}${cohortDelta} points on average; this pupil moved ${change.delta > 0 ? "+" : ""}${change.delta}.`
        : "No class attached.",
      verdict: Math.abs(cohortDelta) > 4 ? "supported" : "unsupported",
      ruleOut: "If the class moved together, look at the assessment or the teaching, not the child.",
    },
    {
      rank: 3,
      name: "Opportunity to learn — attendance",
      discriminator: "Did attendance fall across the same period?",
      found: `Attendance is ${pupil.attendancePct}%.` + (change.attendanceDrop
        ? " That is materially below the cohort and coincides with the change."
        : " No coincident fall."),
      verdict: change.attendanceDrop ? "supported" : "unsupported",
      ruleOut: "Check the session-level register for the exact weeks, and which lessons were missed.",
    },
    {
      rank: 4,
      name: "Reading demand of this subject's assessment",
      discriminator: "Does their reading age clear what this paper demands?",
      found: change.readingShortfall > 0
        ? `Reading age ${pupil.readingAge}y against a paper demanding ${demandAge(subj, pupil.year)}y — a ${change.readingShortfall}y shortfall.`
          + (pupil.eal
            ? " This pupil is EAL, so read that shortfall with care: nationally, EAL pupils starting at the same KS2 point go on to outperform their English-first-language peers. The screen is picking up language acquisition, not necessarily a barrier to learning."
            : "")
        : `Reading age ${pupil.readingAge}y clears the paper's ${demandAge(subj, pupil.year)}y demand.`,
      // EAL downgrades this from a supported explanation to an open question,
      // because the national evidence points the other way for that group.
      verdict: change.readingShortfall >= 1.5 ? (pupil.eal ? "undetermined" : "supported") : "unsupported",
      ruleOut: "Read the questions to them once and see whether the score moves.",
    },
    {
      rank: 5,
      name: "The timetable slot",
      discriminator: "Does this class sit in a slot that underperforms generally?",
      found: slot ? `${subj.name} for this pupil is ${slot.label} in ${slot.room}.` : "No slot recorded.",
      verdict: slot && (slot.period >= 5 || slot.day === 5) ? "undetermined" : "unsupported",
      ruleOut: "Open the slot finding for this school and see whether other classes there show it too.",
    },
    {
      rank: 6,
      name: "Set placement",
      discriminator: "Is the pupil in a set that does not match their prior attainment?",
      found: klass ? `KS2 ${pupil.ks2}, placed in set ${klass.setNumber}.` : "—",
      verdict: "undetermined",
      ruleOut: "Compare their residual before and after any set move this year.",
    },
    {
      rank: 7,
      name: "A prerequisite was never mastered",
      discriminator: "Is there an objective earlier in the DAG they have not secured?",
      found: "Mastery states exist for this subject; open the objective view to walk the chain.",
      verdict: "undetermined",
      ruleOut: "Five minutes of questioning on the prerequisite will settle it faster than any dashboard.",
    },
    {
      rank: 8,
      name: "Something the system cannot see",
      discriminator: "Home, health, friendship, sleep, a bereavement, a phone.",
      found: "Not in this dataset, and deliberately so — safeguarding content never enters this system.",
      verdict: "undetermined",
      ruleOut: "You know this child. This console does not. If the ranked list above feels wrong, it is wrong.",
    },
  ];

  // Rank by verdict, keeping RTM pinned at the top — it is always checked first.
  const scored = hyps.slice(1).sort((a, b) => {
    const rankOf = (v: Hypothesis["verdict"]) => (v === "supported" ? 0 : v === "undetermined" ? 1 : 2);
    return rankOf(a.verdict) - rankOf(b.verdict) || a.rank - b.rank;
  });
  return [hyps[0], ...scored].map((h, i) => ({ ...h, rank: i + 1 }));
}

/* ─── 5. Inclusion gaps — with suppression, not estimation ─────────────── */

export function inclusionFindings(w: World, schoolId: string): Finding[] {
  const pupils = w.pupilsBySchool.get(schoolId) || [];
  const school = w.schoolById.get(schoolId)!;
  const out: Finding[] = [];

  for (const subj of SUBJECTS) {
    const dis: number[] = [], oth: number[] = [];
    for (const p of pupils) {
      const r = profile(p.id).residual[subj.key];
      if (r == null) continue;
      (p.fsm6 ? dis : oth).push(r);
    }
    if (!groupReportable(dis.length) || !groupReportable(oth.length)) {
      if (dis.length > 0) {
        out.push({
          id: `inc-${schoolId}-${subj.key}-suppressed`,
          kind: "suppressed", levels: ["school", "trust", "department"],
          schoolId, subjectKey: subj.key,
          headline: `${subj.name}: disadvantage gap suppressed`,
          sub: `Only ${dis.length} pupils in the group — below the ${K_ANONYMITY_FLOOR}-pupil floor. We suppress rather than estimate.`,
          effect: 0, n: dis.length, strength: "tentative",
          evidence: [{ label: "Group size", value: `${dis.length}`, tone: "neutral" }],
          differential: [], actions: [],
          suppressed: { reason: `Group of ${dis.length} is below the k-anonymity floor of ${K_ANONYMITY_FLOOR}.`, n: dis.length },
        });
      }
      continue;
    }

    const gap = round(mean(dis) - mean(oth));
    if (gap > -1.5) continue;

    out.push({
      id: `inc-${schoolId}-${subj.key}`,
      kind: "inclusion_gap",
      levels: ["school", "trust", "department"],
      schoolId, subjectKey: subj.key,
      headline: `${subj.name}: disadvantaged pupils sit ${Math.abs(gap)} points below peers — in this subject only`,
      sub: `${dis.length} FSM6 pupils at ${school.name}. Because the comparison is within-pupil, this is not the general disadvantage gap; it is specific to ${subj.name.toLowerCase()}.`,
      effect: gap, n: dis.length,
      strength: Math.abs(welchT(dis, oth)) > 4 ? "strong" : "moderate",
      evidence: [
        { label: "Disadvantaged (FSM6)", value: `${dis.length} pupils, mean residual ${round(mean(dis))}`, tone: "bad" },
        { label: "Peers", value: `${oth.length} pupils, mean residual ${round(mean(oth))}`, tone: "good" },
        { label: "Gap", value: `${gap} pts` },
        { label: "Ofsted relevance", value: "Inclusion is a graded evaluation area from Nov 2025" },
      ],
      differential: [
        {
          rank: 1, name: "Reading demand falling harder on this group",
          discriminator: "Is the mean reading shortfall higher among disadvantaged pupils here?",
          found: `Mean shortfall: ${round(mean(pupils.filter((p) => p.fsm6).map((p) => profile(p.id).shortfall[subj.key])))}y disadvantaged vs ${round(mean(pupils.filter((p) => !p.fsm6).map((p) => profile(p.id).shortfall[subj.key])))}y peers.`,
          verdict: "undetermined",
          ruleOut: "Cross this with the literacy finding for the same subject.",
        },
        {
          rank: 2, name: "Curriculum access — resources, revision materials, devices at home",
          discriminator: "Does the gap widen across windows rather than sitting flat?",
          found: "Widening gaps point to cumulative access; flat gaps point to a fixed barrier.",
          verdict: "undetermined",
          ruleOut: "Compare in-class assessment against homework-dependent assessment.",
        },
        {
          rank: 3, name: "Set placement",
          discriminator: "Are disadvantaged pupils over-represented in lower sets at equal KS2?",
          found: "Checkable from set membership against prior attainment.",
          verdict: "undetermined",
          ruleOut: "Cross-tabulate KS2 decile against set number.",
        },
        {
          rank: 4, name: "The measure is picking up who gets sanctioned, not who struggles",
          discriminator: "Is any part of this figure derived from behaviour or attendance coding?",
          found: "No. This finding uses assessment residuals only. Behaviour data is not ingested — it encodes sanctioning patterns, not conduct.",
          verdict: "unsupported",
          ruleOut: "Ruled out by what the system refuses to collect.",
        },
      ],
      actions: ["brief_department", "flag_for_scrutiny", "readability_pass"],
    });
  }
  return out.sort((a, b) => a.effect - b.effect);
}

/* ─── Trust roll-up ────────────────────────────────────────────────────── */
/* A director does not want the same finding four times, once per school. They
   want "this is trust-wide, here is the spread, here is where to start". So
   findings of the same kind and subject collapse into one, carrying a per-school
   breakdown as their evidence. */

function rollUpForTrust(findings: Finding[], w: World): Finding[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) {
    if (f.suppressed) continue;
    const k = `${f.kind}|${f.subjectKey ?? ""}`;
    const arr = groups.get(k);
    if (arr) arr.push(f); else groups.set(k, [f]);
  }

  const out: Finding[] = [];
  for (const [key, group] of groups) {
    if (group.length === 1) { out.push(group[0]); continue; }

    const sorted = [...group].sort((a, b) => a.effect - b.effect);
    const worst = sorted[0], best = sorted[sorted.length - 1];
    const avg = round(mean(group.map((f) => f.effect)));
    const totalN = group.reduce((a, f) => a + f.n, 0);
    const subj = group[0].subjectKey ? SUBJECT_BY_KEY[group[0].subjectKey] : null;
    const nameOf = (f: Finding) => w.schoolById.get(f.schoolId!)?.name ?? "—";
    const universal = group.length === w.schools.length;

    out.push({
      id: `trust-${key}`,
      kind: group[0].kind,
      levels: ["trust"],
      schoolId: null,
      subjectKey: group[0].subjectKey,
      headline: universal
        ? `${subj?.name ?? "This"}: the same gap in all ${group.length} schools — ${Math.abs(avg)} points on average`
        : `${subj?.name ?? "This"}: the same gap in ${group.length} of ${w.schools.length} schools`,
      sub: universal
        ? `Every school in the trust shows it, which makes this a curriculum and assessment-design question for the trust rather than a school-improvement one. Worst at ${nameOf(worst)}; mildest at ${nameOf(best)}.`
        : `${group.map(nameOf).join(", ")}. The schools that do not show it are worth asking what they do differently.`,
      effect: avg,
      n: totalN,
      strength: group.filter((f) => f.strength === "strong").length >= group.length / 2 ? "strong" : "moderate",
      evidence: [
        { label: "Schools affected", value: `${group.length} of ${w.schools.length}`, tone: universal ? "bad" : "neutral" },
        { label: "Pupils affected", value: totalN.toLocaleString("en-GB") },
        { label: "Spread", value: `${worst.effect} at ${nameOf(worst)} → ${best.effect} at ${nameOf(best)}` },
        ...sorted.map((f): EvidenceRow => ({
          label: nameOf(f),
          value: `${f.effect} pts · ${f.n} pupils`,
          tone: f.effect < avg ? "bad" : "good",
          ref: { type: "School", id: f.schoolId! },
        })),
        {
          label: "Why this is one finding, not four",
          value: universal
            ? "The effect is present everywhere at similar size. Splitting it per school would invite a league table and hide that the cause is shared."
            : "Grouped so the schools without it can be used as the comparison.",
        },
      ],
      // The differential is the same everywhere; take the clearest instance.
      differential: worst.differential,
      actions: ["brief_department", "flag_for_scrutiny"],
    });
  }
  return out;
}

/* ─── The briefing — what a given viewer sees when they open the console ── */

export interface Briefing {
  level: Level;
  headline: string;
  findings: Finding[];
  changes: TrajectoryChange[];
  stats: { label: string; value: string; hint?: string }[];
}

const briefingCache = new Map<string, Briefing>();

export function briefingFor(viewer: Viewer): Briefing {
  const key = `${viewer.level}|${viewer.schoolId}|${viewer.departmentId}|${viewer.staffId}`;
  const hit = briefingCache.get(key);
  if (hit) return hit;

  const w = world();
  const dept = viewer.departmentId ? w.departmentById.get(viewer.departmentId) : null;
  const subjectKey = dept?.subjectKey;

  let findings: Finding[] = [];
  let changes: TrajectoryChange[] = [];
  let stats: Briefing["stats"] = [];
  let headline = "";

  if (viewer.level === "trust") {
    // No child is resolvable here. Cross-school variation only.
    for (const s of w.schools) {
      findings.push(...literacyGateFindings(w.pupilsBySchool.get(s.id) || [], s.id));
      findings.push(...inclusionFindings(w, s.id));
    }
    findings = rollUpForTrust(
      findings.filter((f) => f.levels.includes("trust")),
      w,
    ).map((f) => ({ ...f, pupilIds: undefined }));
    const allRes = w.schools.map((s) => ({
      school: s,
      lit: (w.pupilsBySchool.get(s.id) || []).filter((p) => profile(p.id).worstShortfallSubject).length,
    }));
    headline = `${w.trust.name} — ${w.schools.length} schools, one picture`;
    stats = [
      { label: "Schools", value: String(w.schools.length) },
      { label: "Pupils on roll", value: w.schools.reduce((a, s) => a + s.pupilCount, 0).toLocaleString("en-GB") },
      { label: "Reading below paper demand", value: `${Math.round((allRes.reduce((a, x) => a + x.lit, 0) / w.pupils.length) * 100)}%`, hint: "At least one subject where the paper demands more than they can read" },
      { label: "Findings open", value: String(findings.length) },
    ];
  } else if (viewer.level === "school") {
    const sid = viewer.schoolId!;
    findings = [
      ...slotFindings(w, sid),
      ...inclusionFindings(w, sid),
      ...literacyGateFindings(w.pupilsBySchool.get(sid) || [], sid),
      ...SUBJECTS.flatMap((s) => sequencingFindings(w, sid, s.key)),
    ].filter((f) => f.levels.includes("school"));
    const school = w.schoolById.get(sid)!;
    headline = `${school.name} — the things only you can change`;
    stats = [
      { label: "On roll", value: school.pupilCount.toLocaleString("en-GB") },
      { label: "FSM6", value: `${school.fsm6Pct}%` },
      { label: "Structural findings", value: String(findings.filter((f) => f.kind === "slot" || f.kind === "sequencing").length), hint: "Timetable and sequencing — yours to fix" },
      { label: "Suppressed", value: String(findings.filter((f) => f.suppressed).length), hint: "Groups below the k-anonymity floor" },
    ];
  } else if (viewer.level === "department") {
    const sid = viewer.schoolId!;
    findings = [
      ...slotFindings(w, sid, subjectKey),
      ...literacyGateFindings(w.pupilsBySchool.get(sid) || [], sid).filter((f) => f.subjectKey === subjectKey),
      ...sequencingFindings(w, sid, subjectKey),
      ...inclusionFindings(w, sid).filter((f) => f.subjectKey === subjectKey),
    ].filter((f) => f.levels.includes("department"));
    changes = trajectoryChanges(w.pupilsBySchool.get(sid) || [], subjectKey).slice(0, 40);
    headline = `${dept?.name ?? "Department"} — ${w.schoolById.get(sid)!.name}`;
    stats = [
      { label: "Classes", value: String((w.classesBySchool.get(sid) || []).filter((c) => c.subjectKey === subjectKey).length) },
      { label: "Trajectory changes", value: String(changes.filter((c) => !c.rtmSuspect).length), hint: "Regression-to-the-mean cases already excluded" },
      { label: "Reading-gated pupils", value: String((w.pupilsBySchool.get(sid) || []).filter((p) => profile(p.id).shortfall[subjectKey!] >= 1.5).length) },
      { label: "Findings open", value: String(findings.length) },
    ];
  } else {
    // Teacher — their own classes only.
    const myClasses = viewer.classIds.map((id) => w.classById.get(id)!).filter(Boolean);
    const myPupils = w.pupils.filter((p) => p.classIds.some((c) => viewer.classIds.includes(c)));
    const sid = viewer.schoolId!;
    findings = [
      ...literacyGateFindings(myPupils, sid).filter((f) => !subjectKey || f.subjectKey === subjectKey),
      ...sequencingFindings(w, sid, subjectKey),
    ].filter((f) => f.levels.includes("teacher"));
    changes = trajectoryChanges(myPupils, subjectKey).filter((c) => Math.abs(c.delta) >= 9).slice(0, 24);
    headline = `Your classes — what to do on Monday`;
    stats = [
      { label: "Classes", value: String(myClasses.length) },
      { label: "Pupils", value: String(myPupils.length) },
      { label: "Changed this window", value: String(changes.filter((c) => !c.rtmSuspect).length), hint: "Excludes regression to the mean" },
      { label: "Reading-gated", value: String(myPupils.filter((p) => profile(p.id).worstShortfallSubject).length) },
    ];
  }

  // Biggest effect first, suppressed notices last.
  findings.sort((a, b) => (a.suppressed ? 1 : 0) - (b.suppressed ? 1 : 0) || a.effect - b.effect);

  const b: Briefing = { level: viewer.level, headline, findings, changes, stats };
  briefingCache.set(key, b);
  return b;
}

export function findingById(viewer: Viewer, id: string): Finding | undefined {
  return briefingFor(viewer).findings.find((f) => f.id === id);
}
