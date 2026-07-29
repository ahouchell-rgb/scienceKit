# How it all interlinks — the evidence model

> Written 2026-07-29. Companion to [00-SYNTHESIS](00-SYNTHESIS.md).
> Every number here is in code at `apps/houchell/src/lib/intel/evidence.ts`, tagged
> `published` / `derived` / `assumed`, and the synthetic cohort is calibrated to it.

---

## 1. The one-paragraph answer

Prior attainment at KS2 explains about **46%** of GCSE variance and nothing else comes
close. Reading ability is the strongest *modifiable* factor and the only one nobody
instruments. Attendance looks enormous in raw statistics and **roughly halves** the moment
you control for prior attainment. Suspension is real but travels the *same pathway* as
absence, so counting both double-counts. And the whole apparatus cannot reliably predict
which individual child will fail — the best-resourced attempt at this in UK public services
missed four in five and false-alarmed six times in ten.

**So the product is not prediction. It is attribution: for this child, which of the
modifiable factors is currently binding?**

---

## 2. The numbers, with sources

### Prior attainment — the dominant term

| Finding | Value | Note |
|---|---|---|
| KS2 mean scaled score ↔ Attainment 8 | **r = 0.68** | CAT4 correlates at about the same level |
| GCSE variance explained by KS2 alone | **r² ≈ 0.46** | derived |
| GCSE variance *not* explained | **54%** | the headroom a school works in |

Two consequences. First, buying a cognitive-ability test adds little over the KS2 data
already sitting in your MIS via the CTF. Second, 54% unexplained is simultaneously the
justification for schooling and the reason individual prediction is a bad product.

### Reading — the under-instrumented one

Correlation between NGRT reading ability and GCSE grade (GL Assessment, 370,000 pupils):

| Subject | r |
|---|---|
| English Language | 0.65 |
| Geography | 0.65 |
| **Mathematics** | **0.63** |
| History | 0.61 |
| Science (Combined) | 0.61 |
| English Literature | 0.60 |

Reading predicts **maths** GCSE better than it predicts history or English literature.
Distribution: **25%** of 15-year-olds read at 12 or below; 20% at 11 or below; 10% at 9 or
below. Only about **20%** of 11-year-olds read at 15+, the level GCSE material assumes.

### Absence — where the confounding lives

Raw, from DfE (2018/19):

| Group | Achieving grade 4+ in English & maths |
|---|---|
| No sessions missed | 83.7% |
| Persistently absent (10%+) | 35.6% |
| Severely absent (50%+) | 11.3% |

FFT Datalab: Attainment 8 runs from **56.7** (under 2% absence) to **14.7** (50%+).

**The number that matters most in this whole document:** FFT found a raw gap of **6.42**
points between the <2.5% and 10–20% absence bands, which falls to **3.24** once prior
attainment and pupil characteristics are controlled. *About half the apparent absence
effect is prior disadvantage showing up a second time.* Any attendance business case built
on the raw figure overstates the return by roughly 100%.

Absence also **compounds**: among pupils with identical Year 11 absence, Attainment 8 ran
from 54.3 (Year 10 absence 0–2%) to 42.3 (Year 10 absence 10–20%) — over a grade per
subject. A good Year 11 does not undo a bad Year 10.

### Behaviour — real, but it is the same pathway

- Pupils suspended in primary sat **8 scaled-score points** lower at KS2 (~10 months).
  Effect survives controls, but shrinks.
- **77%** of suspended pupils, and over **90%** of primary-excluded pupils, do not achieve
  grade 4+ in English and maths.
- **64%** of primary-excluded pupils were persistently absent by Year 10.

That last figure is the important one. Exclusion and absence are one diverging trajectory
observed at two points, not two independent risk factors.

There is also a hard caveat the sector routinely ignores: **behaviour data records who gets
sanctioned, not who misbehaves.** Any model fed behaviour points will disproportionately
flag PP, SEND and minority-ethnic pupils, breaching Art 5(1)(a) fairness, the Equality Act
and the school's PSED at once. This is why the console ingests attendance and reading, and
deliberately does not ingest behaviour.

### Disadvantage — the backdrop

**19.0 months** behind by the end of secondary (2025) — joint-widest since the series began
in 2013 and a month wider than pre-pandemic. A school showing a 19-month gap is *average*,
not failing. Any within-school gap should be read against this.

### What interventions actually return (EEF)

| Intervention | Impact |
|---|---|
| Reading comprehension strategies | **+7 months** |
| Peer tutoring | +6 months |

Reading comprehension is low cost, moderate evidence security, and attaches *directly* to
the reading finding. That pairing — a cheap diagnosis with a well-evidenced cheap response —
is why literacy is the wedge rather than one insight among several.

### The limits of prediction

What Works for Children's Social Care built ML models and trialled them for 18 months
across four local authorities:

- missed **4 in 5** at-risk children
- when they did flag a child, **wrong 6 times out of 10**
- never reached the pre-specified 65% precision threshold
- adding social-work case text did not help

Low base rates make this arithmetic, not an implementation failure. The same arithmetic
applies to predicting which pupil will fail GCSEs.

---

## 2b. KS2 → GCSE progression — the real transition matrix

Pulled directly from the DfE statistics API (Key stage 4 performance, 2023/24, England,
state-funded, **586,507 pupils**). This is national published aggregate — no pupil is
identifiable. It is in code at `apps/houchell/src/lib/intel/progression.ts`.

Prior attainment = the average of a pupil's KS2 reading and maths scaled scores.
Bands: **Low** <100, **Mid** 100–110, **High** 110+.

| KS2 avg scaled score | Band | Pupils | Mean A8 | % grade 4+ E&M | % grade 5+ E&M | Mean P8 |
|---|---|---|---|---|---|---|
| under 80 | Low | 13,238 | 6.7 | 3.0 | 1.2 | −0.93 |
| 80–89.5 | Low | 21,916 | 17.3 | 4.0 | 0.9 | −0.13 |
| 90–95.5 | Low | 41,832 | 25.4 | 14.5 | 3.6 | −0.04 |
| 96–99.5 | Low | 57,687 | 32.2 | 33.5 | 10.9 | −0.03 |
| 100–102 | Mid | 59,753 | 37.6 | 51.5 | 21.6 | −0.01 |
| 102.5–104.5 | Mid | 80,056 | 42.5 | 65.6 | 34.5 | −0.02 |
| 105–107 | Mid | 88,907 | 47.9 | 77.8 | 50.4 | 0.01 |
| 107.5–109.5 | Mid | 81,127 | 54.4 | 87.5 | 67.5 | −0.01 |
| 110–113 | High | 84,076 | 61.8 | 93.9 | 82.5 | 0.02 |
| 113.5–116.5 | High | 45,147 | 70.6 | 97.8 | 93.3 | 0.01 |
| 117–120 | High | 12,768 | 78.1 | 99.1 | 97.7 | 0.04 |

Note that **Progress 8 is ≈0 in every row by construction** — it is centred within
prior-attainment group, so it is structurally incapable of telling you that starting points
differ. That is exactly why this table belongs next to it.

### Read it as a distribution, never as a target grade

Of 100 pupils starting at KS2 100–102, **48 do not get a grade 4**. Of 100 starting below
89.5, **4 do**. Every commercial product in this space converts a KS2 score into a target
grade and hands it to a child; this table is the reason that is indefensible.

### Same starting point, split by disadvantage

| KS2 band | % 4+ disadvantaged | % 4+ other | Grade-4 gap | A8 gap |
|---|---|---|---|---|
| under 80 | 2.4 | 3.7 | 1.3 pp | 2.3 |
| 80–89.5 | 2.9 | 5.2 | 2.3 pp | 5.4 |
| 90–95.5 | 9.6 | 18.0 | 8.4 pp | 6.3 |
| 96–99.5 | 22.4 | 39.4 | **17.0 pp** | 7.3 |
| 100–102 | 36.9 | 58.0 | **21.1 pp** | 7.6 |
| 102.5–104.5 | 50.1 | 71.6 | **21.5 pp** | 7.9 |
| 105–107 | 62.9 | 82.5 | **19.6 pp** | 8.4 |
| 107.5–109.5 | 75.5 | 90.6 | 15.1 pp | 8.3 |
| 110–113 | 85.0 | 95.7 | 10.7 pp | 8.5 |
| 113.5–116.5 | 92.9 | 98.4 | 5.5 pp | 8.5 |
| 117–120 | 97.3 | 99.3 | 2.0 pp | 7.1 |

### The threshold-leverage finding

**The disadvantage gap is roughly a constant ~8 Attainment 8 points at every starting point
from 80 upwards. Its effect on whether a pupil *passes* swings from 2.0 to 21.5 percentage
points.**

Nothing about disadvantage changes across the ability range. Only the position of the
grade-4 boundary does. The same eight points are decisive in the middle and absorbed
harmlessly at both ends.

The derived marginal-return curve (percentage points of grade 4 gained per Attainment 8
point, computed from adjacent rows) makes the same point:

| KS2 band | pp of grade-4 per A8 point |
|---|---|
| 90–95.5 | 1.98 |
| **96–99.5** | **3.03** |
| **100–102** | **3.12** |
| **102.5–104.5** | **2.55** |
| 105–107 | 1.84 |
| 110–113 | 0.64 |
| 117–120 | 0.17 |

**Implication:** Pupil Premium spending aimed at *grade outcomes* converts most efficiently
for disadvantaged pupils arriving at KS2 96–107.

**The caveat, which matters more than the finding:** this is a statement about where a
threshold measure is most sensitive, **not** about which children are most worth educating.
A pupil at KS2 85 has the most ground to make up and the strongest moral claim on support;
they simply will not appear in a grade-4 headline. A school reading this as "work the
borderline" has drawn the wrong conclusion — and that is the documented failure mode of
every threshold accountability measure since C/D borderlining. The console states this
caveat on the same screen as the finding, in red, deliberately.

---

## 3. How it interlinks

```
                    ┌─────────────────────┐
   Disadvantage ───►│  KS2 prior          │
   (FSM6/SEND/EAL)  │  attainment  r=0.68 │──────────────┐
        │           └─────────────────────┘              │
        │                     │                          ▼
        │                     │                  ┌───────────────┐
        │                     ▼                  │     GCSE      │
        │           ┌─────────────────────┐      │  attainment   │
        ├──────────►│    Reading age      │─────►│               │
        │           └─────────────────────┘      └───────────────┘
        │              │  CONSTRUCT: legitimate      ▲       ▲
        │              │  ACCESS:    removable ──────┘       │
        │                                                    │
        │           ┌─────────────────────┐                  │
        └──────────►│     Attendance      │──────────────────┘
                    └─────────────────────┘   HALF of this arrow
                              ▲                is the KS2 arrow
                              │                in disguise
                    ┌─────────────────────┐
                    │  Suspension  ───────┘  (same pathway,
                    └─────────────────────┘   not independent)
```

Three structural facts fall out of that diagram:

**1. Almost everything is confounded through prior attainment and disadvantage.** This is
why within-pupil, cross-subject residuals are the right primary analytic: the pupil is
their own control, holding home circumstances, general ability and motivation constant in a
way no covariate set achieves.

**2. Reading splits into two parts that look identical in the data and are completely
different in what you should do.**

- **Construct** — in English, reading ability *is* the thing being assessed. A weak reader
  scoring lower is the assessment working. Removing it would mean not assessing the subject.
- **Access** — in maths, reading is a toll booth on the way to the thing being assessed.
  Removing it changes nothing about what maths is.

English has the *higher* raw reading correlation (0.65 vs 0.63) and yet is the wrong place
to intervene; maths has the lower correlation and is the right one. **A naive
"reading correlates with grades" analysis points you at exactly the wrong department.**

Our model reproduces this. Calibrated against the published correlations, the within-pupil
residual gap for weak readers comes out at **−5.3 points in maths and +0.4 in English**.

**3. Absence and suspension are one signal, not two.** Adding both to a model inflates
apparent explanatory power while adding no information.

---

## 4. What can honestly be predicted

| Claim | Verdict |
|---|---|
| "This cohort will land around here" | **Yes.** Cohort-level projection from KS2 is sound and already what FFT sells. |
| "This subject/class/slot is underperforming relative to the same pupils elsewhere" | **Yes.** Within-pupil residuals, descriptive, checkable. |
| "This child's trajectory changed this window" | **Yes**, as description — with regression to the mean checked first, because RTM manufactures most apparent dips and recoveries. |
| "This child is at risk of failing" | **No.** Base rates too low, accuracy too poor, and the ICO names access to education as a similarly-significant effect. |
| "This is the root cause" | **No.** Observational school data cannot identify causes. Ranked differential diagnosis instead. |
| "This teacher needs support" | **No.** Teacher value-added is r ≈ 0.40 maths / 0.20 English year-to-year, ~35% misclassified on one year. Diagnose the *slot*. |

---

## 5. Where interventions attach

The value is in naming **which modifiable factor is binding for this child**, because each
one has a different response:

| Binding constraint | Signal that identifies it | Response | Evidence |
|---|---|---|---|
| Reading access | Residual gap concentrated in low-construct-overlap subjects | Readability pass on assessment stems; reading comprehension strategies | **+7 months** (EEF) |
| Opportunity to learn | Attendance drop coincident with the change | Attendance work — but expect **half** the raw headline | 3.24 pts controlled (FFT) |
| Curriculum sequencing | Objective taught before its prerequisite | Reorder scheme of work | Structural; no cost |
| Timetable slot | Same slot below par across ≥2 teachers | Timetable constraint next build | Structural; no cost |
| Prior gap | Prerequisite never mastered | Targeted reteach + recheck | Peer tutoring +6 months (EEF) |
| Nothing in the data | All of the above ruled out | The human who knows the child | — |

That last row is not a cop-out. It is roughly the 54% of variance KS2 does not explain, and
the system should say so rather than manufacture a fifth-best hypothesis.

---

## 6. Honest limitations of our current model

- **`scaffold` and `perceivedDemandAge` are assumptions, not evidence.** They are our
  explanation for why a high-reading-correlation subject can show no within-pupil gap. This
  is the first thing a real pilot must test — read a maths paper aloud to a matched group
  and see whether the gap collapses.
- **Year 7 reading calibration misses.** We reproduce the Year 11 figure (25% at ≤12y) but
  get ~7% of Year 7s at 15+ against a published 20%. The two published figures are hard to
  reconcile with a single distribution per year group; we calibrated to the one that drives
  the product and are recording the miss rather than hiding it.
- **Absolute absence magnitudes run ~1.4× FFT's**, because our comparison bands and control
  set are cruder. The *ratio* — 52% attenuation against FFT's ~50% — is what is calibrated
  and what the console's argument depends on.
- **Everything is still synthetic.** No real pupil has touched this. The live anchor has
  zero rows of attendance, reading age, timetable or SEND.

---

## 7. Sources

- [DfE — The link between absence and attainment at KS2 and KS4 (2018/19)](https://explore-education-statistics.service.gov.uk/find-statistics/the-link-between-absence-and-attainment-at-ks2-and-ks4/2018-19)
- [FFT Education Datalab — Year 11 absence and GCSE results](https://ffteducationdatalab.org.uk/2025/12/exploring-the-relationship-between-year-11-absence-and-gcse-results/)
- [FFT Education Datalab — KS4 progress using CAT4 in place of KS2](https://ffteducationdatalab.org.uk/2025/08/calculating-a-key-stage-4-progress-measure-using-cat4-in-place-of-key-stage-2/)
- [GL Assessment — Why is reading key to GCSE success?](https://www.gl-assessment.co.uk/reports/whyreading/why-is-reading-key-to-gcse-success/)
- [EPI — Outcomes for pupils suspended in primary school](https://epi.org.uk/publications-and-research/outcomes-for-pupils-suspended-in-primary-school/)
- [EPI — Annual Report: Disadvantage](https://epi.org.uk/annual-report-2025-disadvantage/)
- [EEF — Teaching and Learning Toolkit: reading comprehension strategies](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/reading-comprehension-strategies)
- [Community Care — no evidence machine learning works well in children's social care](https://www.communitycare.co.uk/content/news/no-evidence-machine-learning-works-well-in-childrens-social-care-study-finds)
