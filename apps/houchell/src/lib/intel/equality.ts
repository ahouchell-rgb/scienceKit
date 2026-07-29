/* ─────────────────────────────────────────────────────────────────────────
   EQUALITY MONITORING — SEN, EAL and ethnicity, within KS2 starting point.

   ── THE HARD RULE THIS MODULE EXISTS TO ENFORCE ───────────────────────────

   DPA 2018 Schedule 1, paragraph 8(3) permits processing racial or ethnic
   origin for the purpose of identifying and reviewing the existence or absence
   of equality of opportunity — and EXPLICITLY NOT for "measures or decisions
   with respect to a particular data subject".

   So fairness evaluation and inference must be PHYSICALLY SEPARATE pipelines,
   not the same pipeline with a flag. That is why this is its own module with
   its own data, holding only national aggregates:

     · Nothing here is at pupil grain, and nothing here can be.
     · `analytics.ts` MUST NOT import this module. The console's per-pupil
       findings are computed without ever seeing these characteristics.
     · These figures answer "is our provision equitable?" — never "what should
       we predict about this child?"

   If someone later wires an ethnicity term into a per-pupil model, they will
   have to delete this comment to do it.

   Source: DfE Key stage 4 performance, 2023/24, England, state-funded,
   pulled from the statistics API. National published aggregate.
   ───────────────────────────────────────────────────────────────────────── */

import { TRANSITION } from "./progression";

export interface EqualityRow {
  band: string;
  /** % achieving grade 4+ in English and maths, for this group, at this
   *  KS2 starting point. */
  pct4: number;
}

export interface EqualityGroup {
  key: string;
  label: string;
  /** How the group compares to the whole cohort, in one line. */
  summary: string;
  rows: EqualityRow[];
}

/* ── SEN ────────────────────────────────────────────────────────────────
   NOTE ON THE COMPARATOR: the DfE API returns "Any SEN" crossed with KS2
   band but not "No SEN", so the comparison here is against the WHOLE COHORT
   at the same starting point — which includes the SEN pupils themselves. The
   true SEN / non-SEN gap is therefore slightly WIDER than shown. Stating the
   conservative version. */
export const SEN_WITHIN_BAND: EqualityGroup = {
  key: "sen",
  label: "Pupils with any identified SEN",
  summary:
    "At every starting point, pupils with SEN convert prior attainment into a grade 4 markedly less often — about 16 points lower in the middle of the range. This is not the familiar 'SEND pupils start lower' story: prior attainment is already held constant here.",
  rows: [
    { band: "under 80", pct4: 0.8 },
    { band: "80–89.5", pct4: 2.8 },
    { band: "90–95.5", pct4: 10.5 },
    { band: "96–99.5", pct4: 24.5 },
    { band: "100–102", pct4: 35.8 },
    { band: "102.5–104.5", pct4: 47.1 },
    { band: "105–107", pct4: 59.3 },
    { band: "107.5–109.5", pct4: 70.8 },
    { band: "110–113", pct4: 80.1 },
    { band: "113.5–116.5", pct4: 90.0 },
    { band: "117–120", pct4: 93.4 },
  ],
};

/* ── EAL ───────────────────────────────────────────────────────────────── */
export const EAL_WITHIN_BAND: EqualityGroup = {
  key: "eal",
  label: "Pupils whose first language is not English",
  summary:
    "EAL pupils OUTPERFORM their English-first-language peers at every single starting point, and by the widest margin at the bottom — 28.4% against 11.5% at KS2 90–95.5. At equal prior attainment, EAL is not a risk factor. It is the opposite.",
  rows: [
    { band: "under 80", pct4: 9.7 },
    { band: "80–89.5", pct4: 10.2 },
    { band: "90–95.5", pct4: 28.4 },
    { band: "96–99.5", pct4: 50.4 },
    { band: "100–102", pct4: 66.2 },
    { band: "102.5–104.5", pct4: 77.3 },
    { band: "105–107", pct4: 85.6 },
    { band: "107.5–109.5", pct4: 92.9 },
    { band: "110–113", pct4: 96.4 },
    { band: "113.5–116.5", pct4: 98.9 },
    { band: "117–120", pct4: 99.6 },
  ],
};

export const ENGLISH_FIRST_WITHIN_BAND: EqualityGroup = {
  key: "english_first",
  label: "Pupils whose first language is English",
  summary: "The comparison group for the EAL row above.",
  rows: [
    { band: "under 80", pct4: 0.8 },
    { band: "80–89.5", pct4: 2.4 },
    { band: "90–95.5", pct4: 11.5 },
    { band: "96–99.5", pct4: 30.2 },
    { band: "100–102", pct4: 48.8 },
    { band: "102.5–104.5", pct4: 63.6 },
    { band: "105–107", pct4: 76.5 },
    { band: "107.5–109.5", pct4: 86.6 },
    { band: "110–113", pct4: 93.5 },
    { band: "113.5–116.5", pct4: 97.6 },
    { band: "117–120", pct4: 99.0 },
  ],
};

/* ── Ethnicity ─────────────────────────────────────────────────────────── */
export const ETHNICITY_WITHIN_BAND: EqualityGroup[] = [
  {
    key: "asian", label: "Asian / Asian British",
    summary: "Highest-converting major group at every starting point.",
    rows: [
      { band: "under 80", pct4: 7.4 }, { band: "80–89.5", pct4: 8.6 },
      { band: "90–95.5", pct4: 26.0 }, { band: "96–99.5", pct4: 49.5 },
      { band: "100–102", pct4: 67.1 }, { band: "102.5–104.5", pct4: 77.9 },
      { band: "105–107", pct4: 87.4 }, { band: "107.5–109.5", pct4: 94.0 },
      { band: "110–113", pct4: 97.0 }, { band: "113.5–116.5", pct4: 99.1 },
      { band: "117–120", pct4: 99.7 },
    ],
  },
  {
    key: "black", label: "Black / African / Caribbean / Black British",
    summary: "Above the cohort at every starting point.",
    rows: [
      { band: "under 80", pct4: 4.6 }, { band: "80–89.5", pct4: 7.8 },
      { band: "90–95.5", pct4: 21.1 }, { band: "96–99.5", pct4: 42.1 },
      { band: "100–102", pct4: 61.1 }, { band: "102.5–104.5", pct4: 72.6 },
      { band: "105–107", pct4: 83.0 }, { band: "107.5–109.5", pct4: 90.2 },
      { band: "110–113", pct4: 95.6 }, { band: "113.5–116.5", pct4: 98.4 },
      { band: "117–120", pct4: 99.5 },
    ],
  },
  {
    key: "mixed", label: "Mixed / multiple ethnic groups",
    summary: "Close to the cohort average throughout.",
    rows: [
      { band: "under 80", pct4: 3.6 }, { band: "80–89.5", pct4: 4.4 },
      { band: "90–95.5", pct4: 14.4 }, { band: "96–99.5", pct4: 32.6 },
      { band: "100–102", pct4: 49.5 }, { band: "102.5–104.5", pct4: 64.4 },
      { band: "105–107", pct4: 76.9 }, { band: "107.5–109.5", pct4: 86.1 },
      { band: "110–113", pct4: 93.8 }, { band: "113.5–116.5", pct4: 97.5 },
      { band: "117–120", pct4: 99.1 },
    ],
  },
  {
    key: "white", label: "White",
    summary: "The LOWEST-converting major ethnic group at every single starting point.",
    rows: [
      { band: "under 80", pct4: 1.5 }, { band: "80–89.5", pct4: 2.7 },
      { band: "90–95.5", pct4: 11.9 }, { band: "96–99.5", pct4: 30.2 },
      { band: "100–102", pct4: 48.4 }, { band: "102.5–104.5", pct4: 63.1 },
      { band: "105–107", pct4: 75.9 }, { band: "107.5–109.5", pct4: 86.4 },
      { band: "110–113", pct4: 93.3 }, { band: "113.5–116.5", pct4: 97.4 },
      { band: "117–120", pct4: 98.9 },
    ],
  },
];

/* ─── Comparison against the whole cohort ──────────────────────────────── */

export const cohortPct4 = (band: string) =>
  TRANSITION.find((t) => t.band === band)?.pct4 ?? 0;

export interface Deviation { band: string; pct4: number; vsCohort: number; }

/** A group's deviation from the whole cohort at each starting point. */
export function deviations(group: EqualityGroup): Deviation[] {
  return group.rows.map((r) => ({
    band: r.band,
    pct4: r.pct4,
    vsCohort: Math.round((r.pct4 - cohortPct4(r.band)) * 10) / 10,
  }));
}

/** Where the deviation is widest — the band a SENDCo or inclusion lead should
 *  look at first. Uses the middle of the range only; at the extremes the
 *  ceiling and floor compress every group together. */
export function widestGap(group: EqualityGroup): Deviation | null {
  const mid = new Set(["96–99.5", "100–102", "102.5–104.5", "105–107", "107.5–109.5"]);
  const d = deviations(group).filter((x) => mid.has(x.band));
  if (!d.length) return null;
  return d.reduce((a, b) => (Math.abs(b.vsCohort) > Math.abs(a.vsCohort) ? b : a));
}

/* ─── The three findings, and what may be done with them ───────────────── */

export const EQUALITY_FINDINGS = [
  {
    key: "sen",
    headline: "SEN is a conversion gap, not just a starting-point gap.",
    detail:
      "At KS2 105–107, 77.8% of all pupils reach grade 4 in English and maths but only 59.3% of pupils with identified SEN — an 18-point gap at identical prior attainment. The usual framing, that SEND pupils arrive further behind, is true and is ALREADY REMOVED from this comparison. Something is happening between Year 7 and Year 11 on top of it.",
    action:
      "This is the analysis SENDCos have never been given, and Inclusion became its own graded Ofsted evaluation area in November 2025. Note the comparator is the whole cohort, which includes SEN pupils — so the real gap is slightly wider than shown.",
  },
  {
    key: "eal",
    headline: "EAL is not a risk factor. At equal prior attainment it is an advantage.",
    detail:
      "EAL pupils outperform their English-first-language peers at every single starting point, and by the widest margin at the bottom: 28.4% against 11.5% at KS2 90–95.5. Their KS2 score understates them because it was taken while they were still acquiring the language, and they close the gap by 16.",
    action:
      "Any system that treats a low reading age as a risk marker WITHOUT separating EAL from weak decoding will systematically mis-flag this group — and it will look like a reasonable, evidence-based rule while doing it. The console's literacy finding was written that way and has been corrected.",
  },
  {
    key: "ethnicity",
    headline: "White pupils are the lowest-converting major ethnic group at every starting point.",
    detail:
      "At KS2 100–102: Asian 67.1%, Black 61.1%, Mixed 49.5%, White 48.4%, against a cohort figure of 51.5%. The ordering is identical in all eleven bands. This inverts what most schools assume, and it is the reason the naive expectation is worth testing rather than trusting.",
    action:
      "Under DPA Sch 1 para 8(3) this may inform provision and review of equality of opportunity. It may NOT inform a measure or decision about a particular pupil, and nothing in this module is at pupil grain.",
  },
];

/** Stated once, and shown on the screen: what this data may be used for. */
export const LAWFUL_USE = {
  permitted:
    "Reviewing whether provision is equitable, at cohort level: which groups convert their starting point into outcomes and which do not, so that provision, curriculum and support can be examined.",
  prohibited:
    "Any measure or decision with respect to a particular pupil. Ethnicity must never enter a per-pupil inference, target, prediction or intervention allocation — DPA 2018 Sch 1 para 8(3) is explicit, and this module is deliberately isolated from the console's analytics so it cannot.",
};
