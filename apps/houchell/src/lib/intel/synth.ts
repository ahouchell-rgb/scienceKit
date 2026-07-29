/* ─────────────────────────────────────────────────────────────────────────
   THE SYNTHETIC WORLD.

   A deterministic four-school multi-academy trust: pupils, literacy screens,
   attendance, timetable slots, assessments and attempts. Everything is
   generated from one seed, so the console is identical on every load and in
   every screenshot.

   WHY SYNTHETIC: the live anchor has zero rows of attendance, behaviour,
   reading age, timetable or SEND (see 00-SYNTHESIS §6). Until entity
   resolution and the Wonde/literacy ingest land, this module *is* the data
   layer — and per the compliance research, all non-production work should be
   on synthetic data anyway. `world()` is the single seam: swap its internals
   for real queries and nothing downstream changes.

   These are not random numbers dressed up as data. Six ground truths are
   deliberately planted (see PLANTED below) so that the analytics engine has
   something real to find — including two decoys that it is supposed to
   *refuse* to call findings.
   ───────────────────────────────────────────────────────────────────────── */

import { ASSUMED_SCAFFOLDING, READING_CORRELATION } from "./evidence";

/* ─── Seeded randomness ────────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller, mean 0 sd 1. */
function gauss(rnd: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const pick = <T,>(rnd: () => number, xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

/* ─── Static reference data ────────────────────────────────────────────── */

export const WINDOWS = [
  { window: 1, name: "Autumn 1", month: "Oct" },
  { window: 2, name: "Autumn 2", month: "Dec" },
  { window: 3, name: "Spring 1", month: "Feb" },
  { window: 4, name: "Spring 2", month: "Apr" },
] as const;

export interface SubjectDef {
  key: string; name: string; short: string;
  /** Published correlation between NGRT reading ability and this subject's
   *  GCSE grade (GL Assessment, 370k pupils). See evidence.ts. */
  readingR: number;
  /** Reading age (years) the written assessment actually demands. */
  textDemandAge: number;
  /** How much of the subject genuinely IS reading. English literature tests
   *  comprehension directly, so its high reading correlation is CONSTRUCT, not
   *  a barrier — removing it would mean not assessing the subject. Maths has
   *  almost no construct overlap, so nearly all of its reading correlation is
   *  ACCESS, and access barriers can be removed without changing what is
   *  assessed. Separating these two is the difference between a useful finding
   *  and telling an English department to stop testing reading. */
  constructOverlap: number;
  /** What departments *believe* the demand is. The gap is the wedge. */
  perceivedDemandAge: number;
  /** How much of the reading barrier the department already removes —
   *  glossaries, reading aloud, sentence stems, vocabulary teaching. 0 = none.
   *  This, not raw text load, is what decides where weak readers actually get
   *  hurt: English departments scaffold heavily because reading is visibly
   *  their business, and maths departments scaffold not at all. */
  scaffold: number;
  colour: string;
}

// textDemandAge is derived from the evidence research: GCSE papers demand
// ~15y7m reading age. Maths is the interesting case — word-problem framing
// makes its true demand far higher than any maths department believes, which
// is exactly why weak readers are penalised hardest where nobody is watching.
// `readingR` and the reading-age distribution below are published figures.
// `scaffold` and `perceivedDemandAge` are OUR ASSUMPTIONS — they are the
// model's explanation for why a subject with a high reading correlation can
// still show no within-pupil gap, and they are the first thing a real pilot
// would have to test. The console labels them as assumptions on screen.
export const SUBJECTS: SubjectDef[] = [
  { key: "maths",     name: "Mathematics", short: "Ma", readingR: READING_CORRELATION.maths,     constructOverlap: 0.05, textDemandAge: 14.4, perceivedDemandAge: 11.0, scaffold: ASSUMED_SCAFFOLDING.maths,     colour: "#7aa7ff" },
  { key: "english",   name: "English",     short: "En", readingR: READING_CORRELATION.english,   constructOverlap: 0.85, textDemandAge: 15.2, perceivedDemandAge: 15.0, scaffold: ASSUMED_SCAFFOLDING.english,   colour: "#ff9166" },
  { key: "science",   name: "Science",     short: "Sc", readingR: READING_CORRELATION.science,   constructOverlap: 0.20, textDemandAge: 14.9, perceivedDemandAge: 13.0, scaffold: ASSUMED_SCAFFOLDING.science,   colour: "#54d6a8" },
  { key: "history",   name: "History",     short: "Hi", readingR: READING_CORRELATION.history,   constructOverlap: 0.45, textDemandAge: 15.4, perceivedDemandAge: 15.2, scaffold: ASSUMED_SCAFFOLDING.history,   colour: "#c08cff" },
  { key: "geography", name: "Geography",   short: "Gg", readingR: READING_CORRELATION.geography, constructOverlap: 0.35, textDemandAge: 14.6, perceivedDemandAge: 14.0, scaffold: ASSUMED_SCAFFOLDING.geography, colour: "#ffd166" },
  { key: "french",    name: "French",      short: "Fr", readingR: READING_CORRELATION.french,    constructOverlap: 0.30, textDemandAge: 12.8, perceivedDemandAge: 13.0, scaffold: ASSUMED_SCAFFOLDING.french,    colour: "#ff6b8a" },
];

/* ─── Calibration constants, all traceable to evidence.ts ──────────────── */

export const CALIBRATION = {
  /** Standardised-score points lost per percentage point of absence. Derived
   *  from FFT's CONTROLLED estimate (3.24 points across the ~13.75pp gap
   *  between the <2.5% and 10–20% bands), NOT the raw 6.42. Using the raw
   *  figure would overstate the attendance effect by about 100%. */
  absencePerPoint: 3.24 / 13.75,
  /** KS2 scaled-score points associated with having been suspended, after
   *  our own halving of EPI's raw 8-point gap on the same attenuation pattern
   *  FFT observed for absence. The direction is published; the magnitude here
   *  is DERIVED and should be treated as indicative. */
  suspensionEffect: 4.0,
  /** Reading age distribution: centre and spread by year group, calibrated so
   *  that ~25% of Year 11 read at 12y or below (GL Assessment, 370k pupils). */
  readingAgeBase: (year: number) => year + 3.6,
  readingAgeSd: 3.3,
  /** Scales the published per-subject reading correlation into the model's
   *  points-per-year-of-shortfall. Tuned so a 3y shortfall in the least
   *  scaffolded subject costs roughly half a grade. */
  readingPenaltyScale: 9.0,
  /** How much of a pupil's outcome comes from things NOT captured by prior
   *  attainment — teaching, motivation, home, health, luck. Set so that KS2
   *  correlates with outcomes at the published r = 0.68 rather than the
   *  near-deterministic relationship a naive model produces. This constant is
   *  the 54% of GCSE variance that Year 6 does not decide. */
  idiosyncraticWeight: 0.75,
  /** Reading ability contributes to a subject's score directly, in proportion
   *  to how much that subject genuinely IS reading. Separate from the access
   *  barrier below. */
  constructWeight: 5.0,
  /** How strongly attendance is tied to underlying ability and disadvantage.
   *  Tuned so that the RATIO between the raw and the prior-attainment-adjusted
   *  absence gap reproduces FFT's observed attenuation of roughly 50%
   *  (6.42 raw → 3.24 controlled). Our absolute magnitudes run about 1.4× FFT's
   *  because our comparison bands and control set are cruder than theirs; the
   *  structural claim — that half the apparent absence effect is confounding —
   *  is what the console depends on, and that is what is calibrated. */
  attendanceAbilityLoading: 0.12,
  /** Standardised points EAL pupils gain relative to the same KS2 starting
   *  point, reflecting the published within-band advantage. Roughly offsets
   *  the reading-age deduction they carry, which is the point: the screen
   *  measures their language, not their prospects. */
  ealCatchUp: 3.4,
} as const;

/** The share of the reading barrier a pupil actually pays in a subject. */
export const unscaffolded = (s: SubjectDef) => 1 - s.scaffold;

/** What a paper actually demands of THIS year group. `textDemandAge` is the
 *  Year 11 / GCSE figure (the evidence base puts GCSE papers at ~15y7m); lower
 *  year groups sit on a gentler ramp. Comparing a Year 7 against a GCSE
 *  reading demand would flag most of the school and mean nothing. */
export const demandAge = (s: SubjectDef, year: number) =>
  Math.round((s.textDemandAge - (11 - year) * 0.7) * 10) / 10;

export const SUBJECT_BY_KEY: Record<string, SubjectDef> =
  Object.fromEntries(SUBJECTS.map((s) => [s.key, s]));

const SCHOOL_DEFS = [
  { id: "sch-marsh",  name: "Marshfield Academy",   fsm6Pct: 41, formEntry: 5 },
  { id: "sch-river",  name: "Riverbank High",       fsm6Pct: 22, formEntry: 5 },
  { id: "sch-kesten", name: "Kesteven Park School", fsm6Pct: 34, formEntry: 4 },
  { id: "sch-aldate", name: "St Aldate's College",  fsm6Pct: 16, formEntry: 4 },
] as const;

const FORENAMES = [
  "Amara", "Ben", "Chidi", "Daisy", "Eli", "Farah", "Gio", "Hana", "Idris", "Jodie",
  "Kai", "Lena", "Musa", "Nia", "Oscar", "Priya", "Quinn", "Rosa", "Sami", "Tomas",
  "Uma", "Vik", "Wren", "Xena", "Yusuf", "Zara", "Arlo", "Bea", "Cody", "Dara",
  "Esme", "Finn", "Greta", "Hugo", "Ines", "Jonah", "Kira", "Liam", "Mabel", "Noor",
];
const SURNAMES = [
  "Achebe", "Barnes", "Carver", "Dunn", "Ellery", "Fitch", "Gale", "Hollis", "Iqbal",
  "Jarvis", "Keane", "Lowry", "Mensah", "Nowak", "Oduya", "Pryce", "Quill", "Rhodes",
  "Salter", "Thorne", "Umek", "Vance", "Whitlock", "Xu", "Yates", "Zamora",
];
const STAFF_NAMES = [
  "R. Okafor", "M. Bell", "T. Haddad", "J. Verity", "S. Lang", "P. Nkemelu",
  "A. Wren", "D. Castellan", "K. Osei", "H. Mistry", "N. Fairweather", "C. Dowd",
];
const ROOMS = ["A12", "A14", "B3", "B7", "C1", "C9", "D4", "D8", "Sci 2", "Sci 5", "Hu 3", "Ma 6"];

/* ─── Object shapes ────────────────────────────────────────────────────── */

export interface Trust { id: string; name: string; schoolCount: number; }
export interface School { id: string; trustId: string; name: string; phase: "secondary"; pupilCount: number; fsm6Pct: number; }
export interface Department { id: string; schoolId: string; name: string; subjectKey: string; headStaffId: string; staffCount: number; }
export interface Staff { id: string; schoolId: string; departmentId: string; name: string; role: "teacher" | "hod" | "head"; }
export interface TimetableSlot { id: string; label: string; day: number; period: number; room: string; }
export interface Klass {
  id: string; schoolId: string; departmentId: string; subjectKey: string;
  name: string; year: number; setNumber: number; size: number;
  staffId: string; slotId: string;
}
export interface Pupil {
  id: string; schoolId: string; name: string; year: number; form: string;
  ks2: number; readingAge: number; readingScreenOn: string; attendancePct: number;
  fsm6: boolean; sen: "none" | "K" | "E"; eal: boolean;
  /** Number of suspensions this year. Suspension is recorded because it is a
   *  strong published marker — but note it largely travels the SAME pathway as
   *  absence (64% of primary-excluded pupils are persistently absent by Y10),
   *  so the two must never be treated as independent predictors. */
  suspensions: number;
  classIds: string[];
  /** Latent general ability. Never exposed in the UI — it is the thing we are
   *  trying to *estimate*, and showing it would be cheating. Kept for tests. */
  _z: number;
}
export interface Attempt {
  id: string; pupilId: string; subjectKey: string; window: number;
  score: number; classId: string;
}
export interface Objective {
  id: string; subjectKey: string; year: number; name: string;
  taughtWeek: number; prerequisiteIds: string[];
}

export interface World {
  trust: Trust;
  schools: School[];
  departments: Department[];
  staff: Staff[];
  slots: TimetableSlot[];
  classes: Klass[];
  pupils: Pupil[];
  attempts: Attempt[];
  objectives: Objective[];
  /** Indexes — built once, used everywhere. */
  pupilById: Map<string, Pupil>;
  classById: Map<string, Klass>;
  schoolById: Map<string, School>;
  slotById: Map<string, TimetableSlot>;
  staffById: Map<string, Staff>;
  departmentById: Map<string, Department>;
  attemptsByPupil: Map<string, Attempt[]>;
  pupilsBySchool: Map<string, Pupil[]>;
  classesBySchool: Map<string, Klass[]>;
}

/* ─── The planted ground truths ────────────────────────────────────────── */
/* Each of these is a real effect written into the generator. The analytics
   engine is not told about them; it has to rediscover them. Two are decoys it
   must refuse to report. */

export const PLANTED = {
  literacyGate: {
    id: "planted-literacy",
    summary: "Maths assessments demand a 14.4y reading age, the department assumes 11.0y, and it scaffolds none of the gap. English demands MORE reading and shows no effect, because English scaffolds 78% of it. Weak readers therefore fall behind their own cross-subject mean in maths and nowhere else.",
    findableAt: ["trust", "head", "hod", "teacher"],
  },
  slotEffect: {
    id: "planted-slot",
    summary: "Marshfield's Friday period 5 runs ~5 standardised points below par across every subject and teacher timetabled into it — so it is the slot, not the staff. A mild end-of-week gradient exists everywhere but is deliberately kept below the reporting threshold.",
    findableAt: ["head", "hod"],
  },
  sequencing: {
    id: "planted-sequence",
    summary: "Riverbank Y8 History taught 'Causation' in week 4, before its prerequisite 'Chronological frameworks' in week 9. Window-2 dip, window-3 recovery.",
    findableAt: ["hod", "teacher"],
  },
  trajectoryChanges: {
    id: "planted-change",
    summary: "A small number of pupils have a genuine single-subject step change at window 3. Some have a coincident attendance collapse (explained); some do not (needs a human).",
    findableAt: ["teacher", "hod"],
  },
  rtmDecoy: {
    id: "planted-rtm",
    summary: "DECOY. Some pupils post an extreme window-2 low from noise alone and 'recover' at window 3. Any engine that calls this an improvement is broken.",
    findableAt: [],
  },
  ppGapDecoy: {
    id: "planted-pp-gap",
    summary: "Kesteven Park's English PP gap is real but its group sizes fall under the k-anonymity floor in three year groups. The console must suppress, not estimate.",
    findableAt: ["head"],
  },
} as const;

/* ─── Generation ───────────────────────────────────────────────────────── */

const YEARS = [7, 8, 9, 10, 11];

function buildWorld(seed = 20260728): World {
  const rnd = mulberry32(seed);
  const g = () => gauss(rnd);

  const trust: Trust = { id: "trust-northreach", name: "Northreach Learning Trust", schoolCount: SCHOOL_DEFS.length };
  const schools: School[] = [];
  const departments: Department[] = [];
  const staff: Staff[] = [];
  const classes: Klass[] = [];
  const pupils: Pupil[] = [];
  const attempts: Attempt[] = [];
  // Built as we go so the inner attempt loop never does a linear scan.
  const classIndex = new Map<string, Klass>();
  const slotIndex = new Map<string, TimetableSlot>();

  // Timetable slots: 5 days × 5 periods, one room each. Shared across schools —
  // a slot is a *shape of the week*, and that is the point of diagnosing it.
  const slots: TimetableSlot[] = [];
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  for (let d = 1; d <= 5; d++) {
    for (let p = 1; p <= 5; p++) {
      slots.push({
        id: `slot-${d}-${p}`, label: `${DAY_NAMES[d - 1]} P${p}`,
        day: d, period: p, room: ROOMS[(d * 5 + p) % ROOMS.length],
      });
    }
  }
  for (const s of slots) slotIndex.set(s.id, s);

  // A slot's own drag on learning. Two components:
  //   · a mild, universal end-of-day / end-of-week gradient, deliberately kept
  //     below the reporting threshold — it is real but not actionable, and a
  //     console that shouted about it would be crying wolf; and
  //   · one genuine school-specific pathology at Marshfield's Friday period 5,
  //     which is the finding a head is supposed to discover.
  // This is a fixable, blame-free finding — the whole reason the
  // Class→TimetableSlot link exists.
  const slotDrag = (s: TimetableSlot, schoolId: string) => {
    const gradient = -(s.period >= 5 ? 1.5 : s.period === 4 ? 0.6 : 0) - (s.day === 5 ? 0.9 : 0);
    const pathology = schoolId === "sch-marsh" && s.day === 5 && s.period === 5 ? -5.4 : 0;
    return gradient + pathology;
  };

  let staffN = 0, classN = 0, pupilN = 0, attemptN = 0;

  for (const sd of SCHOOL_DEFS) {
    const perYear = sd.formEntry * 26;
    const school: School = {
      id: sd.id, trustId: trust.id, name: sd.name, phase: "secondary",
      pupilCount: perYear * YEARS.length, fsm6Pct: sd.fsm6Pct,
    };
    schools.push(school);

    // A head, then a department + HoD + teachers per subject.
    staff.push({ id: `staff-${staffN++}`, schoolId: sd.id, departmentId: "", name: pick(rnd, STAFF_NAMES), role: "head" });

    for (const subj of SUBJECTS) {
      const deptId = `dept-${sd.id}-${subj.key}`;
      const hodId = `staff-${staffN++}`;
      staff.push({ id: hodId, schoolId: sd.id, departmentId: deptId, name: pick(rnd, STAFF_NAMES), role: "hod" });
      const teacherIds: string[] = [hodId];
      for (let t = 0; t < 4; t++) {
        const id = `staff-${staffN++}`;
        staff.push({ id, schoolId: sd.id, departmentId: deptId, name: pick(rnd, STAFF_NAMES), role: "teacher" });
        teacherIds.push(id);
      }
      departments.push({
        id: deptId, schoolId: sd.id, name: subj.name, subjectKey: subj.key,
        headStaffId: hodId, staffCount: teacherIds.length,
      });

      // Sets 1..formEntry per year group, each in one slot with one teacher.
      for (const year of YEARS) {
        for (let set = 1; set <= sd.formEntry; set++) {
          // PLANTED: Marshfield Y9 Science all lands in Friday P5.
          const planted =
            sd.id === "sch-marsh" && subj.key === "science" && year === 9 && set <= 3;
          const slot = planted
            ? slots.find((s) => s.day === 5 && s.period === 5)!
            : slots[Math.floor(rnd() * slots.length)];
          const k: Klass = {
            id: `cls-${classN++}`, schoolId: sd.id, departmentId: deptId, subjectKey: subj.key,
            name: `${year}${subj.short}${set}`, year, setNumber: set, size: 26,
            staffId: teacherIds[(set - 1) % teacherIds.length], slotId: slot.id,
          };
          classes.push(k);
          classIndex.set(k.id, k);
        }
      }
    }

    // ── Pupils ──
    for (const year of YEARS) {
      const yearClasses = classes.filter((c) => c.schoolId === sd.id && c.year === year);
      for (let i = 0; i < perYear; i++) {
        const z = g();
        // Prior attainment: strong but imperfect signal of latent ability.
        const ks2 = Math.round(clamp(100 + 8.5 * z + 2.2 * g(), 78, 122));

        const fsm6 = rnd() < sd.fsm6Pct / 100;
        const eal = rnd() < 0.14;
        const senRoll = rnd();
        const sen: Pupil["sen"] = senRoll < 0.02 ? "E" : senRoll < 0.14 ? "K" : "none";

        // Reading age correlates with ability but far from perfectly — that
        // imperfection is precisely what makes the literacy join informative.
        // Calibrated against the national picture: ~25% of 15-year-olds read
        // at 12y or below (GL, 370k pupils). At Year 11 the centre sits at
        // 15.1y with sd 2.8, which puts ~14% below 12 before the EAL/FSM/SEN
        // shifts, and lands in the low twenties once they are applied.
        const litZ = 0.58 * z + 0.82 * g();
        const readingAge = round1(clamp(
          CALIBRATION.readingAgeBase(year) + CALIBRATION.readingAgeSd * litZ
            - (eal ? 0.8 : 0) - (fsm6 ? 0.45 : 0) - (sen !== "none" ? 0.9 : 0),
          7.0, 18,
        ));

        // Attendance is generated CORRELATED WITH ABILITY AND DISADVANTAGE,
        // because that is the actual structure of the problem: pupils who
        // attend less were, on average, already behind. This confounding is
        // not a flaw in the simulation — it is the thing the console exists to
        // untangle, and the reason the raw absence–attainment gap is roughly
        // double the controlled one.
        const attLatent = CALIBRATION.attendanceAbilityLoading * z + 0.98 * g();
        const attendancePct = round1(clamp(
          96.8 + 1.5 * attLatent - (fsm6 ? 1.4 : 0)
            // Squared left tail: severe absence is rare but extreme.
            - Math.max(0, -attLatent) ** 2 * 1.7,
          55, 100,
        ));

        // Suspension is generated FROM low attendance and disadvantage rather
        // than independently, because that is what the evidence describes: the
        // two are the same diverging trajectory observed at different points.
        // Generating them independently would let the analytics "discover" a
        // relationship the real world does not have.
        const suspensionRisk =
          (attendancePct < 85 ? 0.22 : 0.03) + (fsm6 ? 0.05 : 0) + (sen !== "none" ? 0.04 : 0);
        const suspensions = rnd() < suspensionRisk ? 1 + Math.floor(rnd() * 2) : 0;

        // Set allocation broadly by prior attainment, with real slippage.
        const setRank = clamp(Math.round(3 - z * 1.15 + g() * 0.5), 1, sd.formEntry);
        const classIds = SUBJECTS.map((subj) => {
          const opts = yearClasses.filter((c) => c.subjectKey === subj.key);
          return (opts.find((c) => c.setNumber === setRank) || opts[0]).id;
        });

        const pupil: Pupil = {
          id: `pup-${pupilN++}`, schoolId: sd.id,
          name: `${pick(rnd, FORENAMES)} ${pick(rnd, SURNAMES)}`,
          year, form: `${year}${String.fromCharCode(65 + (i % sd.formEntry))}`,
          ks2, readingAge, readingScreenOn: "2026-09-24", attendancePct,
          fsm6, sen, eal, suspensions, classIds, _z: z,
        };
        pupils.push(pupil);

        // Per-subject affinity: the reason a child is fine in five subjects and
        // falling in one. Without this the residual analytic has no signal.
        const affinity: Record<string, number> = {};
        for (const subj of SUBJECTS) affinity[subj.key] = g() * 0.55;

        // Everything about this child that prior attainment does not capture.
        // Persistent across their subjects and windows, independent of KS2.
        const idiosyncratic = g();

        // Reading ability as a latent, for the construct-overlap term.
        const readingZ = (readingAge - CALIBRATION.readingAgeBase(year)) / CALIBRATION.readingAgeSd;

        // PLANTED: a genuine single-subject step change at window 3, for ~1.5%.
        const hasStepChange = rnd() < 0.015;
        const stepSubject = hasStepChange ? pick(rnd, SUBJECTS).key : null;
        const stepExplained = hasStepChange && rnd() < 0.45;
        if (stepExplained) pupil.attendancePct = round1(clamp(pupil.attendancePct - 16, 45, 100));

        // PLANTED DECOY: an extreme window-2 low from noise alone, which then
        // "recovers". Regression to the mean, not improvement.
        const rtmDecoy = rnd() < 0.02;

        for (let si = 0; si < SUBJECTS.length; si++) {
          const subj = SUBJECTS[si];
          const klass = classIndex.get(classIds[si])!;
          const slot = slotIndex.get(klass.slotId)!;

          for (const w of WINDOWS) {
            let score = 100 + 15 * (
              0.78 * z
              + CALIBRATION.idiosyncraticWeight * idiosyncratic
              + affinity[subj.key]
            );

            // ── Reading as CONSTRUCT ──
            // In English, reading ability legitimately raises the score
            // because reading is what is being assessed. This is not a barrier
            // to remove; it is why English's raw reading correlation is the
            // highest of any subject and yet shows no within-pupil gap.
            score += readingZ * subj.constructOverlap * CALIBRATION.constructWeight;

            // ── The literacy gate ──
            // A pupil pays for the shortfall against what the paper actually
            // demands — but only the part the department has not scaffolded
            // away. This is why the damage concentrates in maths: the demand
            // there is not the highest, but it is the least mitigated, because
            // nobody in a maths department thinks of themselves as teaching
            // reading. Within-pupil residuals see the *difference* between
            // subjects, so an unscaffolded subject is exactly what shows up.
            // The per-subject weight comes from the PUBLISHED reading×GCSE
            // correlation, so maths carries more weight than history or
            // English literature exactly as GL Assessment found.
            const shortfall = Math.max(0, demandAge(subj, year) - pupil.readingAge);
            score -= shortfall * subj.readingR * CALIBRATION.readingPenaltyScale * unscaffolded(subj);

            // Opportunity to learn — at the CONTROLLED effect size, not the raw
            // one. Half of the headline absence–attainment gap is prior
            // attainment and disadvantage showing up a second time.
            score += (pupil.attendancePct - 95) * CALIBRATION.absencePerPoint;

            // Suspension. Deliberately small on top of absence, because the
            // two overlap; most of a suspended pupil's shortfall is already
            // counted in their attendance and their prior attainment.
            score -= pupil.suspensions * CALIBRATION.suspensionEffect * 0.5;

            // ── EAL catch-up ──
            // EAL pupils carry a reading-age deduction above (language
            // acquisition is real and the screen measures it) but nationally
            // they OUTPERFORM their English-first-language peers at every KS2
            // starting point — 28.4% vs 11.5% at KS2 90–95.5. Their prior
            // attainment understates them. Without this term the synthetic
            // world would encode the exact bias the console is supposed to
            // catch, and the literacy finding would quietly become a machine
            // for flagging bilingual children.
            if (pupil.eal) score += CALIBRATION.ealCatchUp;

            // The slot's own drag.
            score += slotDrag(slot, sd.id);

            // PLANTED: Riverbank Y8 history taught out of sequence — dip in
            // window 2, recovery once the prerequisite is finally taught.
            if (sd.id === "sch-river" && subj.key === "history" && year === 8) {
              if (w.window === 2) score -= 7.5;
              if (w.window === 3) score -= 1.5;
            }

            // PLANTED: Kesteven English widens its disadvantage gap over time.
            if (sd.id === "sch-kesten" && subj.key === "english" && fsm6) {
              score -= 1.6 * w.window;
            }

            if (stepSubject === subj.key && w.window >= 3) score -= 13.5;
            if (rtmDecoy && w.window === 2) score -= 17;

            score += g() * 4.1;

            attempts.push({
              id: `att-${attemptN++}`, pupilId: pupil.id, subjectKey: subj.key,
              window: w.window, score: Math.round(clamp(score, 55, 145)),
              classId: klass.id,
            });
          }
        }
      }
    }
  }

  // ── Objectives: a small curriculum DAG per subject × year ──
  const objectives: Objective[] = [];
  const OBJ_NAMES: Record<string, string[]> = {
    maths: ["Place value", "Fractions as division", "Ratio reasoning", "Linear equations", "Proportional graphs", "Area and perimeter"],
    english: ["Inference from text", "Writer's method", "Structuring an argument", "Sentence variety", "Analytical vocabulary", "Comparing texts"],
    science: ["Particle model", "Energy stores", "Cell structure", "Chemical change", "Forces and motion", "Photosynthesis"],
    history: ["Chronological frameworks", "Causation", "Source utility", "Change and continuity", "Significance", "Interpretations"],
    geography: ["Map skills", "Weather systems", "Urbanisation", "River processes", "Development gaps", "Fieldwork enquiry"],
    french: ["Present tense", "Adjective agreement", "Perfect tense", "Opinions and reasons", "Question forms", "Extended writing"],
  };
  for (const subj of SUBJECTS) {
    for (const year of YEARS) {
      const names = OBJ_NAMES[subj.key];
      names.forEach((name, i) => {
        // Default sequence: taught in order, four weeks apart.
        let taughtWeek = 2 + i * 4;
        // PLANTED: history teaches Causation (i=1) before Chronology (i=0).
        if (subj.key === "history" && year === 8) {
          if (i === 0) taughtWeek = 9;
          if (i === 1) taughtWeek = 4;
        }
        objectives.push({
          id: `obj-${subj.key}-${year}-${i}`,
          subjectKey: subj.key, year, name, taughtWeek,
          prerequisiteIds: i === 0 ? [] : [`obj-${subj.key}-${year}-${i - 1}`],
        });
      });
    }
  }

  // ── Indexes ──
  const attemptsByPupil = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const arr = attemptsByPupil.get(a.pupilId);
    if (arr) arr.push(a); else attemptsByPupil.set(a.pupilId, [a]);
  }
  const pupilsBySchool = new Map<string, Pupil[]>();
  for (const p of pupils) {
    const arr = pupilsBySchool.get(p.schoolId);
    if (arr) arr.push(p); else pupilsBySchool.set(p.schoolId, [p]);
  }
  const classesBySchool = new Map<string, Klass[]>();
  for (const c of classes) {
    const arr = classesBySchool.get(c.schoolId);
    if (arr) arr.push(c); else classesBySchool.set(c.schoolId, [c]);
  }

  return {
    trust, schools, departments, staff, slots, classes, pupils, attempts, objectives,
    pupilById: new Map(pupils.map((p) => [p.id, p])),
    classById: new Map(classes.map((c) => [c.id, c])),
    schoolById: new Map(schools.map((s) => [s.id, s])),
    slotById: new Map(slots.map((s) => [s.id, s])),
    staffById: new Map(staff.map((s) => [s.id, s])),
    departmentById: new Map(departments.map((d) => [d.id, d])),
    attemptsByPupil, pupilsBySchool, classesBySchool,
  };
}

let _world: World | null = null;
/** The world. Built once per process/tab; deterministic across both. */
export function world(): World {
  if (!_world) _world = buildWorld();
  return _world;
}

/** Test seam — rebuild with a different seed. */
export const buildWorldWithSeed = buildWorld;
