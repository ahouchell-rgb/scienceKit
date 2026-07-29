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
