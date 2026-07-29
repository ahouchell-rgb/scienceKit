/* ─────────────────────────────────────────────────────────────────────────
   THE EVIDENCE BASE.

   Every coefficient the console relies on, with the study it came from and an
   honest label saying whether it is a published figure, something derived from
   one, or an assumption we made up.

   The reason this file exists as CODE rather than a document: the synthetic
   cohort, the analytics thresholds and the on-screen explanations all read
   from here, so the model cannot drift away from its own evidence base. If a
   number changes, it changes everywhere, and the citation travels with it.

   ── THE ONE THING TO INTERNALISE ──────────────────────────────────────────
   Most published education statistics are RAW ASSOCIATIONS. Absence, exclusion
   and disadvantage are all heavily confounded with prior attainment and with
   each other. Where a controlled estimate exists, it is roughly HALF the raw
   one. Quoting the raw figure as if it were an effect is the most common
   analytical error in this sector, and it is how schools end up spending a
   year chasing attendance for a return that was never there.
   ───────────────────────────────────────────────────────────────────────── */

export type Provenance =
  /** A number stated in a named, checkable publication. */
  | "published"
  /** Arithmetic on published numbers (e.g. r² from r). Traceable. */
  | "derived"
  /** Our own modelling choice. Not evidence. Must be labelled as such on screen. */
  | "assumed";

export interface Citation {
  source: string;
  year: number;
  url: string;
  /** Sample size, where the study reports one. */
  n?: string;
}

export interface Coefficient {
  key: string;
  label: string;
  /** The headline figure, in whatever unit `unit` says. */
  value: number;
  unit: string;
  provenance: Provenance;
  citation?: Citation;
  /** Where a controlled estimate exists alongside the raw one, both are kept. */
  controlled?: number;
  /** What the number means and how it should and should not be used. */
  note: string;
}

/* ─── Sources ──────────────────────────────────────────────────────────── */

export const SOURCES = {
  dfeAbsence: {
    source: "DfE, The link between absence and attainment at KS2 and KS4",
    year: 2019, n: "national cohort",
    url: "https://explore-education-statistics.service.gov.uk/find-statistics/the-link-between-absence-and-attainment-at-ks2-and-ks4/2018-19",
  },
  fftAbsence: {
    source: "FFT Education Datalab, Exploring the relationship between Year 11 absence and GCSE results",
    year: 2025, n: "~250,000 pupils, 1,500 schools",
    url: "https://ffteducationdatalab.org.uk/2025/12/exploring-the-relationship-between-year-11-absence-and-gcse-results/",
  },
  glReading: {
    source: "GL Assessment, Why is reading key to GCSE success?",
    year: 2019, n: "370,000 pupils",
    url: "https://www.gl-assessment.co.uk/reports/whyreading/why-is-reading-key-to-gcse-success/",
  },
  epiSuspension: {
    source: "Education Policy Institute, Outcomes for pupils suspended in primary school",
    year: 2024,
    url: "https://epi.org.uk/publications-and-research/outcomes-for-pupils-suspended-in-primary-school/",
  },
  epiGap: {
    source: "Education Policy Institute, Annual Report — Disadvantage",
    year: 2025,
    url: "https://epi.org.uk/annual-report-2025-disadvantage/",
  },
  eefToolkit: {
    source: "EEF, Teaching and Learning Toolkit",
    year: 2025,
    url: "https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/reading-comprehension-strategies",
  },
  wwcsc: {
    source: "What Works for Children's Social Care, machine-learning trial (reported in Community Care)",
    year: 2020, n: "4 local authorities, 18 months",
    url: "https://www.communitycare.co.uk/content/news/no-evidence-machine-learning-works-well-in-childrens-social-care-study-finds",
  },
  p8: {
    source: "FFT Education Datalab, Calculating a KS4 progress measure using CAT4 in place of KS2",
    year: 2025,
    url: "https://ffteducationdatalab.org.uk/2025/08/calculating-a-key-stage-4-progress-measure-using-cat4-in-place-of-key-stage-2/",
  },
} as const satisfies Record<string, Citation>;

/* ─── 1. Prior attainment — the strongest single predictor ─────────────── */

export const PRIOR_ATTAINMENT: Coefficient[] = [
  {
    key: "ks2_a8_r", label: "KS2 mean scaled score ↔ Attainment 8", value: 0.68, unit: "r",
    provenance: "published", citation: SOURCES.p8,
    note: "The strongest single predictor available, and it is already in every school's MIS via the CTF. CAT4 correlates at roughly the same level — so buying a cognitive-ability test adds little over the KS2 data you already hold.",
  },
  {
    key: "ks2_a8_r2", label: "GCSE variance explained by KS2 alone", value: 0.46, unit: "r²",
    provenance: "derived", citation: SOURCES.p8,
    note: "r² from r = 0.68. This is the honest ceiling on prediction from prior attainment: over half of what a child does at GCSE is NOT determined by where they started. That headroom is the entire justification for a school existing — and the reason individual prediction is a poor product.",
  },
];

/* ─── 2. Reading — the under-instrumented one ──────────────────────────── */

/** Correlation between NGRT reading ability and GCSE grade, by subject.
 *  These are the published figures, not our estimates. The ordering is the
 *  interesting part: maths (0.63) is MORE reading-dependent than history
 *  (0.61) or English literature (0.60), which is the opposite of what every
 *  maths department assumes. */
export const READING_CORRELATION: Record<string, number> = {
  english: 0.65,     // English Language
  geography: 0.65,
  maths: 0.63,
  history: 0.61,
  science: 0.61,
  englishLit: 0.60,
  drama: 0.57,
  citizenship: 0.56,
  french: 0.55,      // German in the source; used as the MFL proxy
};

/** How much of the reading barrier each department already removes. THIS IS AN
 *  ASSUMPTION, not a finding — it is our explanation for why a subject with a
 *  high reading correlation can still show no within-pupil gap. It is the part
 *  of the model a pilot would have to test first. */
export const ASSUMED_SCAFFOLDING: Record<string, number> = {
  english: 0.78, history: 0.62, french: 0.52, geography: 0.48, science: 0.34, maths: 0.00,
};

export const READING: Coefficient[] = [
  {
    key: "reading_maths_r", label: "Reading ability ↔ maths GCSE", value: 0.63, unit: "r",
    provenance: "published", citation: SOURCES.glReading,
    note: "Higher than history (0.61) and English literature (0.60). Word problems require a pupil to read a passage, extract the question, and only then do the maths. Nobody in a maths department thinks of themselves as teaching reading, so nothing mitigates it.",
  },
  {
    key: "read_below_12", label: "15-year-olds reading at 12y or below", value: 25, unit: "%",
    provenance: "published", citation: SOURCES.glReading,
    note: "20% read at 11 or below; 10% at 9 or below. A quarter of any Year 11 cohort is sitting papers written well above their reading age.",
  },
  {
    key: "y7_ready", label: "11-year-olds with a reading age of 15+", value: 20, unit: "%",
    provenance: "published", citation: SOURCES.glReading,
    note: "Four in five Year 7s cannot readily read the GCSE curriculum they are being started on. This is the number that reframes KS3 as a literacy problem.",
  },
];

/* ─── 3. Absence — where the confounding lives ─────────────────────────── */

export const ABSENCE: Coefficient[] = [
  {
    key: "pa_grade4", label: "Persistently absent pupils achieving grade 4+ in English & maths",
    value: 35.6, unit: "%", provenance: "published", citation: SOURCES.dfeAbsence,
    note: "Against 83.7% among pupils with no missed sessions. A dramatic raw gap — and almost never quoted with the caveat below.",
  },
  {
    key: "severe_grade4", label: "Severely absent (50%+) achieving grade 4+",
    value: 11.3, unit: "%", provenance: "published", citation: SOURCES.dfeAbsence,
    note: "The tail is genuinely catastrophic. Nothing in the confounding argument softens this end of the distribution.",
  },
  {
    key: "a8_absence_spread", label: "Attainment 8: lowest vs highest absence band",
    value: 42.0, unit: "A8 points", provenance: "derived", citation: SOURCES.fftAbsence,
    note: "56.7 for pupils missing under 2% of sessions, down to 14.7 for those missing 50%+. Raw, uncontrolled.",
  },
  {
    key: "absence_attenuation", label: "Absence gap, raw vs controlled",
    value: 6.42, unit: "points", controlled: 3.24,
    provenance: "published", citation: SOURCES.fftAbsence,
    note: "THE MOST IMPORTANT NUMBER IN THIS FILE. The raw gap between the <2.5% and 10–20% absence bands is 6.42 points; controlling for prior attainment and pupil characteristics halves it to 3.24. About half of what looks like an absence effect is the same underlying disadvantage showing up twice. Any attendance business case built on the raw figure is overstated by roughly 100%.",
  },
  {
    key: "prior_year_absence", label: "Year 10 absence still visible in Year 11 outcomes",
    value: 12.0, unit: "A8 points", provenance: "published", citation: SOURCES.fftAbsence,
    note: "Among pupils with identical Year 11 absence (5–10%), Attainment 8 ran from 54.3 for those who had missed 0–2% in Year 10 to 42.3 for those who had missed 10–20% — over a grade per subject. Absence compounds; a good Year 11 does not undo a bad Year 10.",
  },
];

/* ─── 4. Behaviour — real, but the data is about sanctioning ───────────── */

export const BEHAVIOUR: Coefficient[] = [
  {
    key: "suspension_ks2", label: "KS2 score gap for pupils suspended in primary",
    value: 8, unit: "scaled score points", provenance: "published", citation: SOURCES.epiSuspension,
    note: "Roughly 10 months behind. Against a non-suspended average of 104, this pushes the suspended group below the expected standard. The effect survives controlling for demographics, disadvantage, prior attainment and school characteristics — but is reduced.",
  },
  {
    key: "suspended_no_grade4", label: "Suspended pupils not achieving grade 4+ in English & maths",
    value: 77, unit: "%", provenance: "published", citation: SOURCES.epiSuspension,
    note: "Over 90% for those permanently excluded at primary. Raw association; suspension is a marker of a trajectory that was already diverging, not solely a cause of it.",
  },
  {
    key: "exclusion_to_absence", label: "Primary-excluded pupils persistently absent by Year 10",
    value: 64, unit: "%", provenance: "published", citation: SOURCES.epiSuspension,
    note: "The mechanism that matters: exclusion and absence are the same pathway observed at two points, which is why treating them as independent predictors double-counts.",
  },
];

/* ─── 5. Disadvantage ──────────────────────────────────────────────────── */

export const DISADVANTAGE: Coefficient[] = [
  {
    key: "gap_months", label: "Disadvantage gap at the end of secondary",
    value: 19.0, unit: "months", provenance: "published", citation: SOURCES.epiGap,
    note: "Joint-widest since the series began in 2013, and a full month wider than pre-pandemic. This is the backdrop against which every within-school gap should be read — a school showing 19 months is average, not failing.",
  },
];

/* ─── 6. What interventions actually return ────────────────────────────── */

export const INTERVENTIONS: Coefficient[] = [
  {
    key: "reading_comprehension", label: "Reading comprehension strategies",
    value: 7, unit: "months progress", provenance: "published", citation: SOURCES.eefToolkit,
    note: "Recently revised upward from +6. Moderate evidence security. Low cost. This is the intervention that attaches directly to the reading finding — which is why the literacy join is the wedge: it is the one diagnosis with a well-evidenced, cheap response.",
  },
  {
    key: "peer_tutoring", label: "Peer tutoring",
    value: 6, unit: "months progress", provenance: "published", citation: SOURCES.eefToolkit,
    note: "Structured, with assigned roles and clear tasks. Benefits both pupils in the pair.",
  },
];

/* ─── 7. The limits of prediction — read this before building a model ──── */

export const PREDICTION_LIMITS: Coefficient[] = [
  {
    key: "wwcsc_recall", label: "At-risk children MISSED by a trained ML model",
    value: 80, unit: "%", provenance: "published", citation: SOURCES.wwcsc,
    note: "Four in five. Models built by What Works for Children's Social Care and trialled for 18 months across four local authorities.",
  },
  {
    key: "wwcsc_precision", label: "False-alarm rate when the same models flagged a child",
    value: 60, unit: "%", provenance: "published", citation: SOURCES.wwcsc,
    note: "Wrong six times out of ten. The models never reached their pre-specified 65% precision threshold, and adding social-work case text did not help. Low base rates make this arithmetic, not an implementation failure — the same arithmetic applies to predicting which pupil will fail GCSEs.",
  },
  {
    key: "ks2_ceiling", label: "GCSE variance NOT explained by prior attainment",
    value: 54, unit: "%", provenance: "derived", citation: SOURCES.p8,
    note: "The complement of r² = 0.46. Any product promising to tell you which individual child will fail is promising to predict something that is mostly not yet determined.",
  },
];

/* ─── 7b. Progression — the one place we use real pupil-outcome data ───── */

export const PROGRESSION: Coefficient[] = [
  {
    key: "band_100_102_fail", label: "Pupils starting at KS2 100–102 who do NOT get grade 4",
    value: 48.5, unit: "%", provenance: "published",
    citation: {
      source: "DfE, Key stage 4 performance (statistics API)", year: 2024,
      n: "586,507 pupils, England, state-funded, 2023/24",
      url: "https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2023-24",
    },
    note: "And 4% of pupils starting below KS2 89.5 DO get one. A starting point is a distribution, not a destiny. This single figure is why the console shows 100 dots rather than a predicted grade — every competitor converts KS2 into a target grade and hands it to a child, which asserts a precision this data cannot support.",
  },
  {
    key: "threshold_leverage", label: "Disadvantage gap in grade-4 terms: top vs middle of the range",
    value: 2.0, unit: "% at KS2 117-120", controlled: 21.5,
    provenance: "published",
    citation: {
      source: "DfE, Key stage 4 performance (statistics API)", year: 2024,
      n: "586,507 pupils, England, state-funded, 2023/24",
      url: "https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2023-24",
    },
    note: "THE THRESHOLD-LEVERAGE FINDING. In Attainment 8 terms the disadvantage gap is nearly constant across the whole ability range — 5.4 to 8.5 points. In grade-4 terms it swings from 2.0 to 21.5 percentage points. Nothing about disadvantage changes; only the position of the boundary does. Read the second figure as the middle of the range, not as a controlled estimate.",
  },
  {
    key: "p8_by_construction", label: "Mean Progress 8 in every prior-attainment band",
    value: 0, unit: "P8", provenance: "derived",
    citation: {
      source: "DfE, Key stage 4 performance (statistics API)", year: 2024,
      url: "https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-4-performance/2023-24",
    },
    note: "P8 is centred within prior-attainment group, so it is ≈0 in every band by construction and is structurally incapable of telling you that starting points differ. Any conversation that uses P8 alone to discuss which pupils need support is missing the variable it has already divided out.",
  },
];

/* ─── 8. Our own assumptions, listed as prominently as the evidence ────── */
/* These are not findings. They are the modelling choices that fill the gaps
   between published figures — and each one is a place the model could be
   wrong. Keeping them in a separate, clearly-labelled group beside the
   evidence is the only way to stop them quietly becoming beliefs. */

export const MODEL_ASSUMPTIONS: Coefficient[] = [
  {
    key: "scaffolding_maths", label: "Reading barrier removed by maths departments",
    value: 0, unit: "% of barrier", provenance: "assumed",
    note: "THE LOAD-BEARING ASSUMPTION. Our explanation for why maths shows a within-pupil gap and English does not, despite English having the higher published reading correlation (0.65 vs 0.63). It is unverified. Test it first: read a maths paper aloud to a matched group and see whether the gap collapses. If it does not, this model's central claim is wrong.",
  },
  {
    key: "scaffolding_english", label: "Reading barrier removed by English departments",
    value: 78, unit: "% of barrier", provenance: "assumed",
    note: "English departments scaffold heavily because reading is visibly their business. Also unverified, and the comparison that makes the maths finding meaningful.",
  },
  {
    key: "construct_overlap", label: "Share of a subject that genuinely IS reading",
    value: 0.85, unit: "English; 0.05 maths", provenance: "assumed",
    note: "Separates a legitimate gap from a removable one. In English, a weak reader scoring lower is the assessment working as intended — reading is the construct. In maths, reading is a toll booth on the way to what is being assessed. A naive 'reading correlates with grades' analysis cannot tell these apart, and points you at the wrong department.",
  },
  {
    key: "suspension_halving", label: "Suspension effect after our own attenuation",
    value: 4.0, unit: "scaled score points", provenance: "assumed",
    note: "EPI publish a raw 8-point gap and state the effect survives controls but shrinks, without giving the controlled figure. We halved it on the same pattern FFT observed for absence. The direction is published; this magnitude is a guess.",
  },
  {
    key: "perceived_demand", label: "Reading age departments believe their papers demand",
    value: 11.0, unit: "yrs (maths)", provenance: "assumed",
    note: "Against a modelled true demand of 14.4y at GCSE. The size of this perception gap is invented; that some such gap exists in maths is supported by the published correlation being higher than any maths department would predict.",
  },
];

/* ─── The whole set, for the console's evidence view ───────────────────── */

export interface EvidenceGroup {
  key: string;
  title: string;
  /** The question this group of evidence answers. */
  question: string;
  coefficients: Coefficient[];
}

export const EVIDENCE_BASE: EvidenceGroup[] = [
  { key: "prior", title: "Prior attainment", question: "How much of GCSE is already set at the end of Year 6?", coefficients: PRIOR_ATTAINMENT },
  { key: "reading", title: "Reading", question: "Where does reading ability actually bite, and who is watching?", coefficients: READING },
  { key: "absence", title: "Absence", question: "How much of the absence–attainment link is real?", coefficients: ABSENCE },
  { key: "behaviour", title: "Behaviour and suspension", question: "What does a suspension tell us that attendance does not?", coefficients: BEHAVIOUR },
  { key: "disadvantage", title: "Disadvantage", question: "What is the national backdrop for any gap we find?", coefficients: DISADVANTAGE },
  { key: "interventions", title: "What interventions return", question: "If we act, what is the realistic return?", coefficients: INTERVENTIONS },
  { key: "progression", title: "KS2 to GCSE progression", question: "Where do pupils who start here actually end up?", coefficients: PROGRESSION },
  { key: "limits", title: "The limits of prediction", question: "What can this system honestly claim to know?", coefficients: PREDICTION_LIMITS },
  { key: "assumptions", title: "Our assumptions — not evidence", question: "Where could this model be wrong?", coefficients: MODEL_ASSUMPTIONS },
];

/** Every distinct source, for a references list. */
export const ALL_SOURCES = Object.values(SOURCES);

export const provenanceCount = () => {
  const counts: Record<Provenance, number> = { published: 0, derived: 0, assumed: 0 };
  for (const g of EVIDENCE_BASE) for (const c of g.coefficients) counts[c.provenance]++;
  return counts;
};
