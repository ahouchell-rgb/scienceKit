/* ─────────────────────────────────────────────────────────────────────────
   KS2 → KS4 PROGRESSION.

   This is the only module in the console built on REAL DATA about REAL
   CHILDREN. Every figure below was pulled from the DfE statistics API —
   "Key stage 4 performance", academic year 2023/24, England, state-funded
   schools, 586,507 pupils — and is national published aggregate, so no pupil
   is identifiable and nothing here is confidential.

     https://api.education.gov.uk/statistics/v1/data-sets/
       b3e19901-5d2b-b676-bb4c-e60937d74725

   Two things this unlocks that no amount of modelling could:

   1. "Pupils who started where this one started actually landed HERE" — as a
      DISTRIBUTION, not a target grade. The distribution is the honest object;
      a single predicted grade is a lie about precision we do not have.

   2. THE THRESHOLD-LEVERAGE FINDING (see MARGINAL_RETURN below). The
      disadvantage gap is roughly a constant ~8 Attainment 8 points at every
      starting point. But its effect on whether a pupil PASSES peaks hard in
      the middle, because that is where an 8-point gap straddles the grade-4
      boundary. Same gap, wildly different consequence.
   ───────────────────────────────────────────────────────────────────────── */

export const PROGRESSION_SOURCE = {
  source: "DfE, Key stage 4 performance — all state-funded pupil characteristics and geography",
  year: 2024,
  period: "2023/24",
  n: "586,507 pupils, England, state-funded",
  url: "https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2023-24",
} as const;

export type PriorBand = "Low" | "Mid" | "High";

export interface TransitionRow {
  /** KS2 average of reading and maths scaled scores. */
  band: string;
  /** Midpoint, for placing a pupil and for interpolation. */
  mid: number;
  lo: number;
  hi: number;
  prior: PriorBand;
  pupils: number;
  /** Mean Attainment 8 for this band, nationally. */
  a8: number;
  /** % achieving grade 4+ in English AND maths. */
  pct4: number;
  /** % achieving grade 5+ in English AND maths. */
  pct5: number;
  /** Mean Progress 8. Near zero everywhere BY CONSTRUCTION — P8 is centred
   *  within prior-attainment group, so it cannot tell you anything about
   *  which starting points do better. That is exactly why this table matters. */
  p8: number;
}

/** The real transition matrix. Ordered by starting point. */
export const TRANSITION: TransitionRow[] = [
  { band: "under 80",    mid: 78,    lo: 0,     hi: 79.9,  prior: "Low",  pupils: 13238, a8:  6.7, pct4:  3.0, pct5:  1.2, p8: -0.93 },
  { band: "80–89.5",     mid: 85,    lo: 80,    hi: 89.5,  prior: "Low",  pupils: 21916, a8: 17.3, pct4:  4.0, pct5:  0.9, p8: -0.13 },
  { band: "90–95.5",     mid: 92.75, lo: 90,    hi: 95.5,  prior: "Low",  pupils: 41832, a8: 25.4, pct4: 14.5, pct5:  3.6, p8: -0.04 },
  { band: "96–99.5",     mid: 97.75, lo: 96,    hi: 99.5,  prior: "Low",  pupils: 57687, a8: 32.2, pct4: 33.5, pct5: 10.9, p8: -0.03 },
  { band: "100–102",     mid: 101,   lo: 100,   hi: 102,   prior: "Mid",  pupils: 59753, a8: 37.6, pct4: 51.5, pct5: 21.6, p8: -0.01 },
  { band: "102.5–104.5", mid: 103.5, lo: 102.5, hi: 104.5, prior: "Mid",  pupils: 80056, a8: 42.5, pct4: 65.6, pct5: 34.5, p8: -0.02 },
  { band: "105–107",     mid: 106,   lo: 105,   hi: 107,   prior: "Mid",  pupils: 88907, a8: 47.9, pct4: 77.8, pct5: 50.4, p8:  0.01 },
  { band: "107.5–109.5", mid: 108.5, lo: 107.5, hi: 109.5, prior: "Mid",  pupils: 81127, a8: 54.4, pct4: 87.5, pct5: 67.5, p8: -0.01 },
  { band: "110–113",     mid: 111.5, lo: 110,   hi: 113,   prior: "High", pupils: 84076, a8: 61.8, pct4: 93.9, pct5: 82.5, p8:  0.02 },
  { band: "113.5–116.5", mid: 115,   lo: 113.5, hi: 116.5, prior: "High", pupils: 45147, a8: 70.6, pct4: 97.8, pct5: 93.3, p8:  0.01 },
  { band: "117–120",     mid: 118.5, lo: 117,   hi: 120,   prior: "High", pupils: 12768, a8: 78.1, pct4: 99.1, pct5: 97.7, p8:  0.04 },
];

/** The same pupils, split by disadvantage. Identical starting point. */
export interface DisadvantageRow {
  band: string;
  a8Disadvantaged: number;
  a8Other: number;
  pct4Disadvantaged: number;
  pct4Other: number;
}

export const DISADVANTAGE_SPLIT: DisadvantageRow[] = [
  { band: "under 80",    a8Disadvantaged:  5.6, a8Other:  7.9, pct4Disadvantaged:  2.4, pct4Other:  3.7 },
  { band: "80–89.5",     a8Disadvantaged: 14.6, a8Other: 20.0, pct4Disadvantaged:  2.9, pct4Other:  5.2 },
  { band: "90–95.5",     a8Disadvantaged: 21.7, a8Other: 28.0, pct4Disadvantaged:  9.6, pct4Other: 18.0 },
  { band: "96–99.5",     a8Disadvantaged: 27.5, a8Other: 34.8, pct4Disadvantaged: 22.4, pct4Other: 39.4 },
  { band: "100–102",     a8Disadvantaged: 32.4, a8Other: 40.0, pct4Disadvantaged: 36.9, pct4Other: 58.0 },
  { band: "102.5–104.5", a8Disadvantaged: 36.8, a8Other: 44.7, pct4Disadvantaged: 50.1, pct4Other: 71.6 },
  { band: "105–107",     a8Disadvantaged: 41.6, a8Other: 50.0, pct4Disadvantaged: 62.9, pct4Other: 82.5 },
  { band: "107.5–109.5", a8Disadvantaged: 47.8, a8Other: 56.1, pct4Disadvantaged: 75.5, pct4Other: 90.6 },
  { band: "110–113",     a8Disadvantaged: 54.7, a8Other: 63.2, pct4Disadvantaged: 85.0, pct4Other: 95.7 },
  { band: "113.5–116.5", a8Disadvantaged: 63.2, a8Other: 71.7, pct4Disadvantaged: 92.9, pct4Other: 98.4 },
  { band: "117–120",     a8Disadvantaged: 71.6, a8Other: 78.7, pct4Disadvantaged: 97.3, pct4Other: 99.3 },
];

/* ─── Derived: where effort actually converts into outcomes ────────────── */

export interface MarginalReturn {
  band: string;
  mid: number;
  /** Percentage points of grade-4 gained per Attainment 8 point, at this
   *  starting point. Derived from adjacent rows of the real table. */
  pctPerA8Point: number;
  /** The disadvantage gap in grade-4 terms at this starting point. */
  disadvantageGapPct: number;
  /** The disadvantage gap in A8 terms — nearly constant across the range. */
  disadvantageGapA8: number;
}

/** The leverage curve. Computed from the published table rather than assumed. */
export const MARGINAL_RETURN: MarginalReturn[] = TRANSITION.map((row, i) => {
  const prev = TRANSITION[i - 1];
  const next = TRANSITION[i + 1];
  // Central difference where possible; one-sided at the ends.
  const a = prev ?? row, b = next ?? row;
  const dA8 = b.a8 - a.a8;
  const dPct = b.pct4 - a.pct4;
  const dis = DISADVANTAGE_SPLIT.find((d) => d.band === row.band)!;
  return {
    band: row.band,
    mid: row.mid,
    pctPerA8Point: dA8 === 0 ? 0 : Math.round((dPct / dA8) * 100) / 100,
    disadvantageGapPct: Math.round((dis.pct4Other - dis.pct4Disadvantaged) * 10) / 10,
    disadvantageGapA8: Math.round((dis.a8Other - dis.a8Disadvantaged) * 10) / 10,
  };
});

/** The band a KS2 average scaled score falls into. */
export function bandFor(ks2: number): TransitionRow {
  return (
    TRANSITION.find((r) => ks2 >= r.lo && ks2 <= r.hi) ??
    (ks2 < 80 ? TRANSITION[0] : TRANSITION[TRANSITION.length - 1])
  );
}

export interface Outcome {
  row: TransitionRow;
  marginal: MarginalReturn;
  disadvantage: DisadvantageRow;
  /** How many pupils nationally started here. */
  cohort: number;
  /** Share of the national cohort at or below this starting point. */
  percentile: number;
  /** True where a marginal gain converts into grade outcomes most efficiently. */
  inLeverageZone: boolean;
}

const TOTAL_PUPILS = TRANSITION.reduce((a, r) => a + r.pupils, 0);

export function outcomeFor(ks2: number): Outcome {
  const row = bandFor(ks2);
  const idx = TRANSITION.indexOf(row);
  const below = TRANSITION.slice(0, idx).reduce((a, r) => a + r.pupils, 0);
  const marginal = MARGINAL_RETURN[idx];
  // The leverage zone: the top third of the marginal-return curve.
  const peak = Math.max(...MARGINAL_RETURN.map((m) => m.pctPerA8Point));
  return {
    row,
    marginal,
    disadvantage: DISADVANTAGE_SPLIT.find((d) => d.band === row.band)!,
    cohort: row.pupils,
    percentile: Math.round(((below + row.pupils / 2) / TOTAL_PUPILS) * 100),
    inLeverageZone: marginal.pctPerA8Point >= peak * 0.75,
  };
}

/** The plain-English reading of a starting point. Deliberately expressed as a
 *  distribution and never as a predicted grade for the individual. */
export function narrate(ks2: number): string[] {
  const o = outcomeFor(ks2);
  const r = o.row;
  const missed = Math.round(100 - r.pct4);
  const lines = [
    `Nationally, ${r.pupils.toLocaleString("en-GB")} pupils started Year 7 in the ${r.band} band — about ${Math.round((r.pupils / TOTAL_PUPILS) * 100)}% of the cohort.`,
    `Of those, ${r.pct4}% went on to grade 4+ in English and maths, and ${r.pct5}% reached grade 5+. Mean Attainment 8 was ${r.a8}.`,
    `So ${missed}% of pupils who started exactly here did NOT get a grade 4. That spread is the point: a starting point is a distribution, not a destiny, and anyone quoting you a single predicted grade for one child is overstating what this data can support.`,
  ];
  if (o.inLeverageZone) {
    lines.push(
      `This band sits in the leverage zone. Around here, each additional Attainment 8 point converts into roughly ${o.marginal.pctPerA8Point} percentage points of grade-4 achievement — the steepest conversion anywhere on the curve, because the grade-4 boundary runs straight through this group.`,
    );
  } else if (r.pct4 >= 70) {
    // Above the boundary: low marginal return because they have already cleared it.
    lines.push(
      `Marginal gains here barely move grade-4 outcomes (${o.marginal.pctPerA8Point} pp per A8 point) because ${r.pct4}% already clear it. Effort here shows up in grades 5–9 and in Attainment 8, not in the pass rate — which is a reason to stop judging this group by a threshold measure at all.`,
    );
  } else {
    // Below the boundary: low marginal return because it is still far away.
    lines.push(
      `Marginal gains here convert weakly into grade-4 outcomes (${o.marginal.pctPerA8Point} pp per A8 point) — the boundary is still a long way off, so a year of good progress moves the score without moving the grade. That is an argument for targeting the underlying barrier and measuring something other than grade 4.`,
    );
  }
  lines.push(
    `Disadvantage costs ${o.marginal.disadvantageGapA8} Attainment 8 points at this starting point — and ${o.marginal.disadvantageGapPct} percentage points of grade-4 achievement.`,
  );
  return lines;
}

/* ─── The headline finding, stated once, in code ───────────────────────── */

export const THRESHOLD_LEVERAGE = {
  headline:
    "The disadvantage gap is roughly the same size at every starting point — but it only decides pass/fail in the middle.",
  detail:
    "Disadvantage costs between 5.4 and 8.5 Attainment 8 points at every KS2 starting point from 80 upward: essentially a constant. But its effect on achieving grade 4 in English and maths ranges from 2.0 percentage points at the top to 21.5 at KS2 102.5–104.5. The gap is not bigger in the middle; the grade-4 boundary simply runs through the middle, so the same gap flips outcomes there and is absorbed harmlessly everywhere else.",
  implication:
    "Pupil Premium spending aimed at grade outcomes should concentrate on disadvantaged pupils arriving at KS2 96–107. That is where a fixed amount of ground lost converts into the largest number of pupils crossing or missing the threshold. Above 110 the same support produces better grades but almost no change in pass rates; below 90 it does not reach the boundary at all.",
  caveat:
    "This is an argument about where a threshold measure is most sensitive, NOT about which children are most worth educating. A pupil at KS2 85 has the most ground to make up and the strongest moral claim on support; they simply will not show up in a grade-4 headline. Any school that reads this as 'work the borderline' has drawn the wrong conclusion, and it is the well-documented failure mode of every threshold accountability measure since C/D borderlining.",
};

/* ─── Subject-level transition matrices ────────────────────────────────── */
/* Same source, one level down: for pupils who started at a given KS2 point,
   what share reached grade 4 and grade 5 IN EACH SUBJECT — plus how many sat
   it at all, which is the column that stops you drawing the wrong conclusion.

   READ THE ENTRY COUNTS BEFORE THE PASS RATES. Biology looks like the easiest
   subject in the table at every starting point. It is not. At KS2 100–102 only
   6,000 pupils sat separate Biology against 52,000 sitting Combined Science —
   so the Biology cohort inside that band is a heavily selected group and its
   pass rate says more about who was entered than about the qualification.
   Maths and English Language are the only near-universal entries and are the
   only fair baseline. */

export interface SubjectBandRow {
  band: string;
  /** % of entries at this KS2 starting point achieving grade 9–4. */
  pct4: number;
  /** % achieving grade 9–5. */
  pct5: number;
  /** Number of entries — the selection check. */
  entries: number;
}

export interface SubjectTransition {
  key: string;
  name: string;
  rows: SubjectBandRow[];
}

export const SUBJECT_TRANSITION: SubjectTransition[] = [
  {
    key: "maths", name: "Mathematics",
    rows: [
    { band: "under 80", pct4: 12, pct5: 6, entries: 4715 },
    { band: "80–89.5", pct4: 7, pct5: 2, entries: 20127 },
    { band: "90–95.5", pct4: 20, pct5: 6, entries: 40649 },
    { band: "96–99.5", pct4: 42, pct5: 16, entries: 56826 },
    { band: "100–102", pct4: 60, pct5: 29, entries: 59157 },
    { band: "102.5–104.5", pct4: 73, pct5: 43, entries: 79481 },
    { band: "105–107", pct4: 84, pct5: 59, entries: 88411 },
    { band: "107.5–109.5", pct4: 92, pct5: 75, entries: 80825 },
    { band: "110–113", pct4: 96, pct5: 87, entries: 83812 },
    { band: "113.5–116.5", pct4: 99, pct5: 96, entries: 45058 },
    { band: "117–120", pct4: 100, pct5: 99, entries: 12741 },
    ],
  },
  {
    key: "english", name: "English Language",
    rows: [
    { band: "under 80", pct4: 12, pct5: 5, entries: 4683 },
    { band: "80–89.5", pct4: 10, pct5: 3, entries: 20081 },
    { band: "90–95.5", pct4: 27, pct5: 11, entries: 40562 },
    { band: "96–99.5", pct4: 46, pct5: 23, entries: 56793 },
    { band: "100–102", pct4: 60, pct5: 36, entries: 59141 },
    { band: "102.5–104.5", pct4: 71, pct5: 48, entries: 79455 },
    { band: "105–107", pct4: 80, pct5: 61, entries: 88400 },
    { band: "107.5–109.5", pct4: 88, pct5: 74, entries: 80800 },
    { band: "110–113", pct4: 94, pct5: 85, entries: 83802 },
    { band: "113.5–116.5", pct4: 98, pct5: 94, entries: 45049 },
    { band: "117–120", pct4: 99, pct5: 97, entries: 12744 },
    ],
  },
  {
    key: "combinedScience", name: "Combined Science",
    rows: [
    { band: "under 80", pct4: 10, pct5: 4, entries: 3986 },
    { band: "80–89.5", pct4: 5, pct5: 1, entries: 18025 },
    { band: "90–95.5", pct4: 14, pct5: 4, entries: 36966 },
    { band: "96–99.5", pct4: 29, pct5: 10, entries: 51286 },
    { band: "100–102", pct4: 45, pct5: 19, entries: 52132 },
    { band: "102.5–104.5", pct4: 58, pct5: 29, entries: 66937 },
    { band: "105–107", pct4: 71, pct5: 42, entries: 68225 },
    { band: "107.5–109.5", pct4: 82, pct5: 57, entries: 53934 },
    { band: "110–113", pct4: 89, pct5: 71, entries: 43266 },
    { band: "113.5–116.5", pct4: 95, pct5: 85, entries: 15866 },
    { band: "117–120", pct4: 98, pct5: 92, entries: 2798 },
    ],
  },
  {
    key: "history", name: "History",
    rows: [
    { band: "under 80", pct4: 16, pct5: 11, entries: 1190 },
    { band: "80–89.5", pct4: 8, pct5: 3, entries: 7121 },
    { band: "90–95.5", pct4: 17, pct5: 8, entries: 16965 },
    { band: "96–99.5", pct4: 29, pct5: 16, entries: 25633 },
    { band: "100–102", pct4: 42, pct5: 27, entries: 28364 },
    { band: "102.5–104.5", pct4: 54, pct5: 38, entries: 39467 },
    { band: "105–107", pct4: 67, pct5: 51, entries: 45355 },
    { band: "107.5–109.5", pct4: 78, pct5: 66, entries: 42543 },
    { band: "110–113", pct4: 88, pct5: 80, entries: 45476 },
    { band: "113.5–116.5", pct4: 95, pct5: 91, entries: 24887 },
    { band: "117–120", pct4: 98, pct5: 96, entries: 6945 },
    ],
  },
  {
    key: "geography", name: "Geography",
    rows: [
    { band: "under 80", pct4: 11, pct5: 6, entries: 1417 },
    { band: "80–89.5", pct4: 5, pct5: 2, entries: 7147 },
    { band: "90–95.5", pct4: 13, pct5: 5, entries: 16084 },
    { band: "96–99.5", pct4: 28, pct5: 14, entries: 24060 },
    { band: "100–102", pct4: 43, pct5: 24, entries: 25511 },
    { band: "102.5–104.5", pct4: 57, pct5: 37, entries: 34761 },
    { band: "105–107", pct4: 70, pct5: 52, entries: 39221 },
    { band: "107.5–109.5", pct4: 82, pct5: 68, entries: 36618 },
    { band: "110–113", pct4: 91, pct5: 83, entries: 38257 },
    { band: "113.5–116.5", pct4: 97, pct5: 93, entries: 20847 },
    { band: "117–120", pct4: 99, pct5: 97, entries: 6185 },
    ],
  },
  {
    key: "french", name: "French",
    rows: [
    { band: "under 80", pct4: 37, pct5: 29, entries: 218 },
    { band: "80–89.5", pct4: 18, pct5: 12, entries: 954 },
    { band: "90–95.5", pct4: 25, pct5: 14, entries: 3103 },
    { band: "96–99.5", pct4: 35, pct5: 20, entries: 6256 },
    { band: "100–102", pct4: 45, pct5: 27, entries: 8578 },
    { band: "102.5–104.5", pct4: 54, pct5: 36, entries: 14023 },
    { band: "105–107", pct4: 64, pct5: 46, entries: 18614 },
    { band: "107.5–109.5", pct4: 75, pct5: 58, entries: 19599 },
    { band: "110–113", pct4: 85, pct5: 72, entries: 23400 },
    { band: "113.5–116.5", pct4: 93, pct5: 86, entries: 14411 },
    { band: "117–120", pct4: 97, pct5: 93, entries: 4522 },
    ],
  },
  {
    key: "biology", name: "Biology",
    rows: [
    { band: "under 80", pct4: 19, pct5: 14, entries: 398 },
    { band: "80–89.5", pct4: 9, pct5: 4, entries: 1095 },
    { band: "90–95.5", pct4: 21, pct5: 11, entries: 2265 },
    { band: "96–99.5", pct4: 44, pct5: 24, entries: 4247 },
    { band: "100–102", pct4: 64, pct5: 40, entries: 6020 },
    { band: "102.5–104.5", pct4: 79, pct5: 56, entries: 11473 },
    { band: "105–107", pct4: 89, pct5: 71, entries: 19360 },
    { band: "107.5–109.5", pct4: 95, pct5: 83, entries: 26336 },
    { band: "110–113", pct4: 98, pct5: 92, entries: 40124 },
    { band: "113.5–116.5", pct4: 99, pct5: 97, entries: 29048 },
    { band: "117–120", pct4: 100, pct5: 99, entries: 9912 },
    ],
  },
];

/** The near-universal entries, used as the fair comparison baseline. */
export const BASELINE_SUBJECTS = ["maths", "english"];

export interface SubjectPenalty {
  key: string;
  name: string;
  /** Percentage points below the maths/English baseline at this band. */
  pct4Delta: number;
  pct5Delta: number;
  /** Entries as a share of the maths entry at the same band. Below ~0.5 means
   *  the subject is selectively entered and the delta is not comparable. */
  entryShare: number;
  /** True where entry is broad enough for the comparison to mean something. */
  comparable: boolean;
}

/** How a subject converts a given starting point into grades, relative to the
 *  universal core. This is the head-of-department number: "for pupils arriving
 *  at this KS2 point, my subject converts N points lower than maths and English
 *  nationally" — which separates a subject effect from a teaching effect. */
export function subjectPenalties(band: string): SubjectPenalty[] {
  const at = (k: string) => SUBJECT_TRANSITION.find((s) => s.key === k)?.rows.find((r) => r.band === band);
  const base = BASELINE_SUBJECTS.map(at).filter(Boolean) as SubjectBandRow[];
  if (!base.length) return [];
  const b4 = base.reduce((a, r) => a + r.pct4, 0) / base.length;
  const b5 = base.reduce((a, r) => a + r.pct5, 0) / base.length;
  const mathsEntries = at("maths")?.entries ?? 1;

  return SUBJECT_TRANSITION.map((s) => {
    const r = at(s.key);
    if (!r) return null;
    const entryShare = Math.round((r.entries / mathsEntries) * 100) / 100;
    return {
      key: s.key, name: s.name,
      pct4Delta: Math.round((r.pct4 - b4) * 10) / 10,
      pct5Delta: Math.round((r.pct5 - b5) * 10) / 10,
      entryShare,
      comparable: entryShare >= 0.5,
    };
  }).filter(Boolean) as SubjectPenalty[];
}

/** The two findings this table supports, stated once. */
export const SUBJECT_FINDINGS = {
  combinedScience: {
    headline: "Combined Science converts prior attainment into a grade 4 about 15 points worse than maths or English — and it is not a selection effect.",
    detail:
      "At KS2 100–102, 60% reach grade 4 in maths and 60% in English Language, but only 45% in Combined Science. Combined Science is entered by 52,000 of the 59,000 pupils in that band, so this is very nearly the same children. It is the modal science pathway and the harshest core conversion in the table.",
  },
  thresholdSwap: {
    headline: "Maths is the easier pass and the harder strong pass. English is the reverse.",
    detail:
      "At KS2 100–102 the grade-4 rate is identical — 60% in both. At grade 5 they separate sharply: 36% in English Language against 29% in maths. A department comparing itself on the wrong threshold will reach the opposite conclusion about where it stands.",
  },
};
