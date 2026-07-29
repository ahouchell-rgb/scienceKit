# Evidence Base and Methods for a School Analytics Platform

**Purpose:** establish what school data actually predicts, what interventions actually work, and where a naive analytics product would generate confident nonsense. Written to constrain product design, not to justify it.

**Date:** July 2026. **Status:** research note. All effect sizes are point estimates from cited sources; treat every one as having a wide, often unreported, uncertainty interval.

**Standing health warning.** Almost every relationship below is observational. Schools do not randomise pupils to attendance levels, teachers, sets, or reading ages. Nearly every "driver" in the list is correlated with every other one and with unmeasured family circumstances, illness, and prior attainment. The single most dangerous property of a school analytics product is that it makes correlational structure look like a causal mechanism, because the UI has an arrow in it.

---

## 1. Predictors of pupil outcomes

### 1.1 Prior attainment — the dominant signal, but not as dominant as schools think

Prior attainment is by a wide margin the strongest single predictor of later attainment, and it is the only variable in the list that is both strong and cheap.

- Ofqual/DfE analysis of KS2 data used in GCSE prediction found that **at best around 38% of the variation in GCSE grade can be predicted by KS2 category** ([DfE/Ofqual, *Analysis of use of key stage 2 data in GCSE predictions*](https://assets.publishing.service.gov.uk/media/5a82f24140f0b62305b952a8/2014-06-16-analysis-of-use-of-key-stage-2-data-in-gcse-predictions.pdf)). Cambridge Assessment's work on KS2-based GCSE prediction matrices reaches similar conclusions ([Cambridge Assessment](https://www.cambridgeassessment.org.uk/Images/181034-exploring-the-value-of-gcse-prediction-matrices-based-upon-attainment-at-key-stage-2.pdf)).
- The IoE/DfE *Influences on Students' GCSE Attainment and Progress at Age 16* (Effective Pre-school, Primary and Secondary Education / EPPSE) reports pseudo-R² coefficients rather than a single correlation, and explicitly warns there is no one figure to quote ([UCL IOE RB352](https://www.ucl.ac.uk/ioe/sites/ioe/files/RB352_-_Influences_on_Students_GCSE_Attainment_and_Progress_at_Age_16_Brief.pdf)).

**Product implication.** ~35–40% of variance explained means **60%+ of what happens to a pupil is not in your baseline**. A "predicted grade" derived from KS2 is a wide distribution, not a point. Any flight-path feature that renders it as a line is lying. This is the single most common false-insight generator in UK school MIS products.

Note also: KS2 baselines are themselves noisy, and measurement error in the baseline biases value-added and "compositional effect" estimates. FFT and Bristol have shown that apparent compositional effects in Progress 8 are **likely almost entirely attributable to measurement error in KS2** ([Prior, Leckie et al., *A review and evaluation of secondary school accountability in England*](https://arxiv.org/pdf/2104.06299)).

### 1.2 Attendance — strong association, contested causation

The headline DfE numbers, from *The link between attendance and attainment in an assessment year* (March 2025) ([DfE PDF](https://assets.publishing.service.gov.uk/media/67c96d7dd0fba2f1334cf2ed/The_link_between_attendance_and_attainment_in_an_assessment_year_-_March_2025.pdf); [Schools Week summary](https://schoolsweek.co.uk/95-attendance-almost-doubles-chances-of-gcse-pass/)):

- Year 11 pupils with **95%+ attendance had ~1.9× the odds** of achieving grade 5 in English and maths versus otherwise-similar pupils attending 90–95%.
- **Missing ~10 days of Year 11 roughly halved the odds** of a grade 5 in English and maths.
- At KS2, pupils with 95–100% attendance were **1.3× more likely** to hit the expected standard than those at 90–95%; ~10 days absence cut the odds by roughly 25%.
- DfE controlled for observable characteristics (FSM, SEND, etc.), which is exactly the point of vulnerability: the controls are the observables.

FFT Education Datalab is the essential sceptical counterweight and should be treated as the house view:

- *Exploring the relationship between Year 11 absence and GCSE results* (Dec 2025): Attainment 8 and CAT4-based Progress 8 both fall with Year 11 absence, but **the gradient flattens substantially once Year 10 absence is included**. They state plainly that they have "not shown that absence necessarily causes low attainment, as there are a wide range of factors which correlate both with high absence and low attainment" ([FFT](https://ffteducationdatalab.org.uk/2025/12/exploring-the-relationship-between-year-11-absence-and-gcse-results/)). Their operational recommendation: if identifying pupils at risk on the basis of attendance, **look beyond the current academic year**.
- *The impact of absence on Progress 8* (Jul 2023): although missing school may cause lower attainment to some extent, "it's more likely that there's some unobservable quantity that correlates with both" ([FFT](https://ffteducationdatalab.org.uk/2023/07/the-impact-of-absence-on-progress-8/)).
- *Key Stage 2 attainment, lifetime absence and context* (Jun 2026): both absence and attainment are partly driven by differences in prior attainment and pupil need; both are influenced by factors not in the data, notably **physical and mental illness** ([FFT](https://ffteducationdatalab.org.uk/2026/06/key-stage-2-attainment-lifetime-absence-and-context/)).

Also relevant: EPI's finding that the **post-2019 widening of the secondary disadvantage gap can be entirely explained by higher absence among disadvantaged pupils** ([EPI Annual Report 2025](https://epi.org.uk/annual-report-2025-disadvantage/)) — note this is a decomposition, not a causal claim, and cuts both ways.

**Product implication.** Attendance is the best *early* signal you will get, and simultaneously the one most likely to be a symptom. Present attendance as a **trigger for a conversation about why**, never as a cause with an implied fix. Never write "attendance is causing this pupil's decline."

On the intervention side, EEF's *Attendance interventions rapid evidence assessment* (March 2022, 72 studies) found only **"some evidence of promise" for parental communication/engagement and for responsive, individually-tailored interventions**; nothing in the field has strong evidence ([EEF REA PDF](https://d2tic4wvo1iusb.cloudfront.net/documents/pages/Attendance-REA-report.pdf); [EEF landing page](https://educationendowmentfoundation.org.uk/education-evidence/evidence-reviews/attendance-interventions-rapid-evidence-assessment)). So even where the flag is right, the product cannot honestly recommend a high-confidence action.

### 1.3 Reading age / literacy — the cross-curricular gate

- The reading age required to access GCSE papers is around **15 years 7 months to 15 years 8 months** (National Literacy Trust figure widely cited; see [Bedrock summary](https://bedrocklearning.org/literacy-blogs/why-literacy-is-fundamental-for-gcse-results-across-subjects/)).
- GL Assessment analysis of ~370,000 secondary pupils: **25% of 15-year-olds have a reading age of 12 or under; ~20% below 11; ~10% below 9** ([GL Assessment, *Why is reading key to GCSE success?*](https://www.gl-assessment.co.uk/reports/whyreading/why-is-reading-key-to-gcse-success/)).
- The counterintuitive and product-relevant finding: **reading level was a stronger predictor of maths GCSE performance than of history or English literature** ([Tes coverage](https://www.tes.com/magazine/archive/weak-readers-struggle-more-maths-english-lit)). Weak readers are penalised most where nobody is watching for literacy.

This is one of the few places where a cross-subject analytics platform has a genuine informational advantage: a reading-age field plus subject-level performance lets you test whether a pupil's underperformance is **concentrated in high-text-load assessments**. That is a defensible, testable hypothesis rather than a vibe.

EEF's *Improving Literacy in Secondary Schools* is the intervention side: seven recommendations centred on **disciplinary literacy**, targeted vocabulary instruction in every subject, reading complex academic texts, structured talk, and high-quality targeted intervention for struggling readers ([EEF](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/literacy-ks3-ks4)). Reading comprehension strategies sit at roughly **+6 months** in the Toolkit and are noted as more effective than phonics or oral-language approaches for upper-primary and secondary pupils ([EEF Toolkit](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/reading-comprehension-strategies)) — with the EEF's own caveat that **careful diagnosis of why an individual is struggling should drive the choice of strategy**.

### 1.4 Homework — much weaker than school policy assumes

EEF Toolkit, homework (secondary): **+5 months' progress on average, but the evidence strength is rated very low**, and the EEF explicitly flags wide variation beneath the average, meaning *how* homework is set dominates *whether* it is set ([EEF Homework](https://educationendowmentfoundation.org.uk/evidence-summaries/teaching-learning-toolkit/homework-secondary/); [technical appendix](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/homework/technical-appendix)).

**Product implication.** Homework *completion* data in a school MIS is mostly a measure of teacher recording behaviour and pupil compliance, not learning. It is a decent **engagement proxy** and a poor **attainment predictor**. Treat non-completion as a behavioural/engagement signal, not as an explanation of grades.

### 1.5 Disadvantage / Pupil Premium

- EPI's disadvantage gap index: **19.1 months by the end of secondary in 2024** (narrowed 0.2 months from 2023, still ~1 month wider than pre-pandemic) ([EPI 2025](https://epi.org.uk/annual-report-2025-disadvantage/)).
- Huge regional variation: **London 10.2 months** vs **South East 22.1 months**, East Midlands 21.7, West Midlands 19.2 ([EPI regional gaps](https://epi.org.uk/annual-report-2025-regional-gaps/)).

**Product implication.** The gap is a population-level descriptive statistic. Applying it to an individual pupil ("PP therefore at risk") is exactly the mechanism by which early-warning systems encode bias (§5). Use PP for *aggregate equity monitoring* and for checking whether your own model's errors are distributed unequally — not as a per-pupil risk feature surfaced to teachers.

### 1.6 EAL — the counterintuitive one

Headline EAL attainment figures are misleading because EAL is a heterogeneous category. What matters is **proficiency in English, not the EAL flag**.

- Strand & Hessel (Oxford / Bell Foundation): **proficiency in English is a far better predictor of achievement than the EAL label** ([Oxford project page](https://www.education.ox.ac.uk/project/english-as-an-additional-language-proficiency-in-english-and-pupils-educational-achievement/); [Lindorff, Strand & Au 2025](https://www.education.ox.ac.uk/wp-content/uploads/2025/02/Lindorff-Strand-Au_2025_EAL-Educational-Achievement.pdf)).
- DfE: **80% of pupils in an English school for 5+ years are assessed competent/fluent, vs ~40% for 1–4 years.**
- **EAL pupils who are fluent in English score ~10 Attainment 8 points above monolingual English speakers** — over a grade per subject ([Bell Foundation](https://www.bell-foundation.org.uk/news/aggregated-headline-gcse-results-mask-the-truth-about-eal-pupil-performance/)).

**Product implication.** If you carry the EAL binary as a risk feature, your model will be wrong in both directions: it will flag fluent, high-achieving EAL pupils and miss the actual issue (recent arrival, low proficiency). Capture **proficiency in English (the DfE A–E scale) and time in English education**, or don't use EAL at all.

### 1.7 SEND

EPI 2025: attainment gap for **SEN support pupils = 16.8 months (primary) / 21.8 months (secondary)**; **EHCP gap = 27.2 months (primary) / 39.6 months (secondary)** ([EPI SEND](https://epi.org.uk/annual-report-2025-send/)). KS2 2025: **29% of SEN support pupils** met the expected standard in RWM combined vs **9% of EHCP pupils** ([DfE Explore Education Statistics](https://explore-education-statistics.service.gov.uk/find-statistics/key-stage-2-attainment/2024-25-revised)). Prevalence: EHCP 5.3%, SEN support 14.2% and rising ([DfE SEN statistics](https://explore-education-statistics.service.gov.uk/find-statistics/special-educational-needs-in-england/2024-25)).

**Product implication.** SEND identification is itself a school-level decision with enormous inter-school variation. Treating "SEN support" as a stable measured attribute of a pupil, comparable across schools, is unsound. Within a single school over time it is usable; across schools it is not.

### 1.8 Term of birth

Crawford, Dearden & Meghir (IFS): the August-vs-September gap is **~0.5 SD at age 7, ~0.35 SD at age 11 (KS2), ~0.15 SD at age 16 (KS4)**, still detectable at A level and HE entry ([IFS R80](https://ifs.org.uk/sites/default/files/output_url_files/r80.pdf); [Nuffield/IFS report](https://www.nuffieldfoundation.org/wp-content/uploads/2011/11/IFS-birth-month-report_November-2011.pdf)). Mechanism is **absolute age at test**, not school starting age.

**Product implication.** This is one of the few genuinely clean, quasi-experimental effects available. At KS3 a ~0.2–0.3 SD birth-month adjustment is defensible and cheap; failing to make it means summer-born pupils are systematically over-flagged. It also gives you a free **calibration test**: if your risk model flags August-born pupils at a much higher rate than the true outcome rate justifies, your model is miscalibrated.

### 1.9 Mobility

Jørgensen et al. and earlier work: mobility is strongly associated with low attainment, but **the association halves when pupil background is controlled and is eliminated entirely once prior attainment is included**; secondary-phase moves (not primary) are significantly associated with lower progress; underlying move rate ~1.5–2% per term ([BERJ](https://bera-journals.onlinelibrary.wiley.com/doi/10.1002/berj.3718); [Machin/Telhaj, *Estimating pupil mobility with PLASC data*](https://cep.lse.ac.uk/pubs/download/CEE/ceedp67.pdf)).

**Product implication.** A textbook example of a variable that looks predictive raw and vanishes on adjustment. Mobility belongs in the *context panel* ("this pupil joined in Y9, there is a curriculum-continuity question") and not in a risk score.

### 1.10 Behaviour, suspensions, exclusions

- 'Persistent disruptive behaviour' accounted for **51% of suspensions and 38% of permanent exclusions** in autumn 2023/24.
- EPI/Impetus: pupils **suspended at 15/16 are markedly more likely to be NEET at 19** ([EPI/Impetus, *Early adult outcomes for suspended pupils*](https://epi.org.uk/wp-content/uploads/2024/08/Early-adult-outcomes-for-suspended-pupils-FINAL.pdf)).
- Madia et al. find exclusion increases risk of NEET at 19/20 and economic inactivity, unemployment and lower wages at 25/26, using two counterfactual approaches ([BJEP](https://bpspsychub.onlinelibrary.wiley.com/doi/full/10.1111/bjep.12487)).
- Campbell systematic review of school-based interventions to reduce exclusion: modest, heterogeneous effects ([Valdebenito et al. 2025](https://onlinelibrary.wiley.com/doi/10.1002/cl2.70063)).

Behaviour data is the **most school-specific and least comparable** field you will ingest. Behaviour point systems measure staff logging behaviour at least as much as pupil behaviour. Within-school, within-year comparisons only.

### 1.11 Persistent and severe absence

Standard DfE definitions: **persistent absence = missing 10%+ of sessions; severe absence = missing 50%+**. Post-pandemic rates remain far above 2019 levels; the House of Commons Library briefing tracks the series ([CBP-9710](https://commonslibrary.parliament.uk/research-briefings/cbp-9710/)). FFT's *Exploring persistent absence* shows PA is far from a homogeneous group ([FFT](https://ffteducationdatalab.org.uk/2021/12/exploring-persistent-absence/)).

The 90%/95% thresholds are **administrative conventions, not discovered breakpoints**. There is no evidence of a genuine discontinuity at 90%; the underlying relationship is roughly monotonic. Building a product around threshold-crossing alerts imports an artefact of DfE reporting into your causal story.

---

## 2. Differential diagnosis: what to do when a trajectory drops

The honest framing is **differential diagnosis, not root cause**. The product should generate a ranked, falsifiable hypothesis list with the discriminating evidence for each, and should be explicit that the final determination requires human knowledge the data does not contain.

| Hypothesis | Discriminating data signal | Ruling it *out* | Evidence-backed response |
|---|---|---|---|
| **Measurement artefact / regression to the mean** | Single assessment point; prior score was extreme; other pupils in same assessment also moved; assessment changed | Drop persists across ≥2 independent assessments | Do nothing yet. This should be checked **first, always** (§7). |
| **Cohort/assessment change** | Whole class or whole cohort shifted; distribution moved, ranks stable | Pupil's *rank within class* also dropped | Re-baseline, don't intervene on pupils. |
| **Literacy / reading age** | Decline concentrated in high-text-load subjects and extended-writing questions; reading age well below 15y7m; maths worded problems weak but numeracy fine | Strong performance on text-heavy tasks elsewhere | EEF *Improving Literacy in Secondary Schools*; disciplinary literacy + targeted intervention for struggling readers. Reading comprehension strategies ≈ +6 months. |
| **Curriculum gap / missing prerequisite** | Decline dated to a specific topic sequence; errors cluster on questions depending on one prerequisite; correlates with absence dates or a taught-unit boundary | Errors are diffuse across topics | Diagnostic assessment on the prerequisite; targeted re-teach. This is the hypothesis your platform is *best* placed to test if you have item- or topic-level data. |
| **Attendance** | Absence precedes the decline in time; absence dates map to missed content; multi-year absence pattern (FFT: check prior year too) | Decline started while attendance was fine | EEF attendance REA: parental engagement/communication + responsive tailored support. Low-confidence evidence — say so. |
| **Effort / engagement** | Homework completion drops, classwork volume falls, performance falls more in coursework/prep-dependent tasks than under exam conditions | Effort metrics unchanged | Weak evidence base; treat as a conversation prompt. |
| **Behaviour** | Behaviour logs rise *before* the attainment drop; concentrated in particular periods/rooms/teachers | Logs flat, or rise *after* the drop (likely consequence, not cause) | EEF *Improving Behaviour in Schools*. Note directionality is genuinely ambiguous. |
| **Wellbeing / mental health** | Cross-subject decline, attendance decline, and behaviour change appear near-simultaneously; often no single subject signature | Decline is subject-specific | Out of scope for data. Route to pastoral. Do not let the platform speculate. |
| **Home circumstances** | Not in your data at all. Sometimes visible as abrupt simultaneous change across every metric | — | Route to pastoral. |
| **Teacher / class / set change** | Decline dated to timetable change; **other pupils in the same new class also declined**; pupil fine in other subjects | Only this pupil declined in that class | Class-level formative signal (§3), never a teacher judgement. |
| **Subject-specific vs general** | Compare within-pupil residuals across subjects (the pupil is their own control) | — | Determines whether the question is a subject/curriculum one or a pupil-level one. |

The **within-pupil, across-subject residual** is the most under-used and most defensible analytic in the whole space: it holds the pupil's home circumstances, general ability, reading age, and motivation approximately constant, so a subject-specific residual is much more informative than an absolute score. This is what SISRA-style residuals do — the difference between a pupil's standardised score in a subject and their mean across subjects ([Juniper/SISRA docs](https://help.junipereducation.org/hc/en-gb/articles/30115708087325-Sisra-Analytics-What-are-residuals)).

**Temporal ordering is the only causal leverage you have.** Signal A preceding signal B is weak evidence; signal B preceding A refutes "A caused B". Build the timeline; let the user see the sequence; do not compute a causal score.

---

## 3. Teacher effects: real, large, and nearly impossible to measure per-teacher

### The effect is real and substantial

- Rivkin, Hanushek & Kain (Econometrica 2005): a teacher **0.5 SD above average in effectiveness produces ~0.1 SD/year** additional achievement; the **25th vs 75th percentile teacher differ by ~0.2 SD in a single year** — enough to move a median pupil to the 59th percentile ([Rivkin, Hanushek & Kain](https://hanushek.stanford.edu/sites/default/files/publications/Rivkin+Hanushek+Kain%202005%20Ecta%2073(2).pdf)).
- Little of that variation is explained by observable teacher characteristics (qualifications, experience beyond the first few years).

### Measuring it for an individual teacher is where it collapses

- **MET project (Gates Foundation):** the highest correlations were on state maths tests — **between-section correlation 0.38, between-year correlation 0.40**. For ELA, roughly **0.20**. That is, a teacher's value-added in one class correlates ~0.4 with the same teacher's value-added in another class ([MET, *Have We Identified Effective Teachers?*](https://files.eric.ed.gov/fulltext/ED540959.pdf); [MET, *Ensuring Fair and Reliable Measures*](https://files.eric.ed.gov/fulltext/ED540958.pdf)).
- **Schochet & Chiang:** misclassification of teachers on value-added estimates runs at **~35% with one year of data and ~25% with three years** ([summary](https://www.researchgate.net/publication/258150364_What_Are_Error_Rates_for_Classifying_Teacher_and_School_Performance_Using_Value-Added_Models)).
- Teachers rated "effective" one year have been estimated at a **25–59% chance of being rated "ineffective" the next** ([EPI, *Problems with the use of student test scores to evaluate teachers*](https://www.epi.org/publication/bp278/)).
- **American Statistical Association (2014):** most VAM studies find **teachers account for about 1%–14% of the variability in test scores**; the majority of improvement opportunity lies in system-level conditions ([ASA statement](https://www.amstat.org/asa/files/pdfs/POL-ASAVAM-Statement.pdf); [journal version](https://www.tandfonline.com/doi/full/10.1080/2330443X.2014.956906)).
- Multilevel decompositions put **~5–20% of unexplained variance in progress at school level, 80–95% at pupil level**; VPC for a simple school random-intercept model is around **11%** ([Prior/Leckie](https://arxiv.org/pdf/2104.06299); Goldstein multilevel literature).

### Why class-level data can't be cleanly attributed to a teacher

Selection into classes (setting/streaming is not random and is often correlated with behaviour, attendance and SEND), small n (a UK secondary teacher may have 25–30 pupils per class per year — MET-scale reliability is unattainable), differing prior attainment distributions, differential measurement error in baselines, peer effects, timetable position, room, and co-teaching/shared classes. The stability numbers above come from US datasets **much larger** than anything a single English school possesses. A single school's per-teacher VA is, statistically, noise with a name attached.

### What you *can* responsibly say about a teacher from data

Only formative, class-need statements:

- "This class has 9 pupils with reading ages below 12; here is what that implies for your text selection."
- "Pupils in this class are underperforming their own cross-subject average specifically on extended-response questions."
- "Attendance in period 5 Friday is 6pp below this class's average."
- "Topic 4 assessment scores are low across all four classes in this subject — likely a curriculum/sequencing issue, not a teaching one."

And explicitly **not**: a teacher effectiveness score, a ranking, a RAG rating, a VA figure with the teacher's name on it, or anything that would survive into a performance-management meeting. The *Making Data Work* report (Teacher Workload Advisory Group, 2018) is the UK policy backstop here: it found data is used **too much for monitoring and compliance rather than to support pupil learning**, that this drives anxiety and burnout, and it recommended **no more than two or three attainment data collection points a year**. DfE accepted all recommendations in full ([report PDF](https://assets.publishing.service.gov.uk/media/5be1ccca40f0b667c116be10/Workload_Advisory_Group-report.pdf); [DERA record](https://dera.ioe.ac.uk//32443/)).

For the positive framing of what to work on, use **Coe's Great Teaching Toolkit: Evidence Review (2020)** — 17 elements in 4 dimensions (understanding the content; creating a supportive environment; maximising opportunity to learn; activating hard thinking), distilled from 100+ frameworks and reviewed by 74 collaborators ([EBE](https://evidencebased.education/the-great-teaching-toolkit-evidence-review/); [PDF](https://www.cambridgeinternational.org/Images/584543-great-teaching-toolkit-evidence-review.pdf)). Crucially GTT is framed as a **model for teacher-owned professional learning**, not a measurement instrument — the right posture for a product.

---

## 4. Department / subject-level analysis

Department level is where analytics is most defensible, because n is larger and the unit of action (curriculum, sequencing, assessment design) is genuinely within the department's control.

**Sound methods**

- **Residual analysis vs prior attainment**, ideally within-pupil across subjects (the pupil as own control) — removes pupil-level confounding that no covariate set can.
- **Multi-year aggregation.** FFT and Bristol both recommend reporting multi-year averages alongside single-year Progress 8 precisely because of volatility ([FFT, *Changes in schools' Progress 8 scores over time*](https://ffteducationdatalab.org.uk/2024/04/changes-in-schools-progress-8-scores-over-time/); [Prior et al., *Review of Education*](https://bera-journals.onlinelibrary.wiley.com/doi/full/10.1002/rev3.3299)).
- **Item/topic-level analysis within a common assessment** — the highest-value department analytic, and the one MIS products almost never do.

**Pitfalls to design against**

- **Small-cohort noise.** FFT: "Progress 8 scores for most schools aren't that different" — differences between the vast majority of schools are tiny relative to between-pupil variation ([FFT](https://ffteducationdatalab.org.uk/2019/02/progress-8-scores-for-most-schools-arent-that-different/)). At department level with n=60–120 the noise dominates almost every year-on-year "change". Ofsted's own IDSR guidance restricts some statements to cohorts above 10 ([IDSR guide](https://www.gov.uk/guidance/school-inspection-data-summary-report-idsr-guide)).
- **Comparing subjects with different cohorts and entry policies.** Optional subjects are self-selected; triple science, separate languages, and vocational routes have systematically different intakes. A "history is underperforming maths" comparison is usually a statement about who chose history.
- **Progress 8 bucket structure.** EBacc and open buckets have different qualification mixes and different grade distributions; the measure is sensitive to entry policy and to grammar/selective effects ([Schools Week on grammar schools and P8](https://schoolsweek.co.uk/how-progress-8-disguises-grammar-school-pupils-true-attainment/)). Don't forecast P8 — FFT literally wrote *Don't try to forecast Progress 8!* ([FFT](https://ffteducationdatalab.org.uk/2016/02/dont-try-to-forecast-progress-8/)).
- **KS2 measurement error** propagating into apparent compositional and departmental effects (§1.1).

**What good HoDs actually want to know**, which the above supports: which topics did pupils across all classes fail (curriculum/sequencing), which question types are systematically weak (assessment/teaching focus), which pupils are underperforming *their own* cross-subject average in this subject (targeted intervention list), whether the assessment itself behaved sensibly (item discrimination, ceiling/floor effects), and whether a change made last year is showing up two cohorts later.

---

## 5. Early warning systems: the state of the art, and its failures

**The strongest positive evidence** is the US "ABC" tradition — Attendance, Behaviour, Course performance.

- Balfanz (Johns Hopkins): a single flag as early as grade 6 (attendance <90%, ≥2 behaviour citations, or failing maths/English) is associated with a **~75% probability of not graduating on time** ([Everyone Graduates Center](https://new.every1graduates.org/just-the-right-mix/); [ERIC review](https://files.eric.ed.gov/fulltext/ED607284.pdf)).
- UChicago Consortium **Freshman On-Track**: ≥5 full-year credits and ≤1 semester F in a core course. **On-track students are ~3.5× more likely to graduate in four years**, and FOT predicts graduation **better than prior test scores or background characteristics** ([Consortium](https://consortium.uchicago.edu/publications/track-indicator-predictor-high-school-graduation); [What Matters for Staying On-Track](https://consortium.uchicago.edu/sites/default/files/2018-10/07%20What%20Matters%20Final.pdf)).

Note what these have in common: **simple, transparent, count-based rules on actionable behaviours**, not opaque ML risk scores. That is not an accident — it is why they were adoptable and why teachers could act on them.

**The failures are severe and directly on point.**

- **Wisconsin DEWS.** The Markup's 2023 investigation found the model is **wrong nearly three-quarters of the time when it predicts a student will not graduate**, and raises false alarms about **Black and Hispanic students at a significantly higher rate than White students**. A UC Berkeley study found DEWS had **no effect on graduation rates for students it labelled high risk**. Educators reported receiving little or no explanation of how the label was computed or what to do with it ([The Markup, *False Alarm*](https://themarkup.org/machine-learning/2023/04/27/false-alarm-how-wisconsin-uses-race-and-income-to-label-students-high-risk); [takeaways](https://themarkup.org/the-breakdown/2023/04/27/takeaways-from-our-investigation-into-wisconsins-racially-inequitable-dropout-algorithm); [student perspectives](https://themarkup.org/machine-learning/2023/12/21/were-not-living-a-predicted-life-student-perspectives-on-wisconsins-dropout-algorithm)). A [critique by Harlan Harris](https://www.harlan.harris.name/2023/05/a-critique-of-the-markup-s-investigation-into-predictive-models-of-student-success/) argues some of the statistical framing was unfair — worth reading, but it does not rescue the "no effect on outcomes" finding, which is the one that matters commercially.
- **What Works for Children's Social Care, *Machine learning in children's services: does it work?* (2020).** Models built and trialled across four local authorities **failed to identify, on average, four out of every five children at risk**, and in every instance **failed to reach a pre-specified success threshold of 65% precision** — a threshold the report itself described as a low benchmark, below what it would recommend for production use. Conclusion: no evidence that ML prediction of outcomes for families in children's social care is effective ([Community Care coverage](https://www.communitycare.co.uk/2020/09/10/evidence-machine-learning-works-well-childrens-social-care-study-finds/); [CYP Now](https://www.cypnow.co.uk/content/research/machine-learning-in-children-s-services-does-it-work/)). The accompanying [Rees Centre ethics review](https://www.education.ox.ac.uk/rees-centre/project/ethics-review-of-machine-learning-in-childrens-social-care/) is the ethical companion piece.
- Recent scoping reviews reach the same place: most predictive models in children's social care **lack transparency, report little on error rates, and rarely examine algorithmic bias or the harms of false positives** ([Critical and Radical Social Work](https://bristoluniversitypressdigital.com/view/journals/crsw/aop/article-10.1332-20498608Y2026D000000128/article-10.1332-20498608Y2026D000000128.xml)).

**Base-rate arithmetic makes this unavoidable.** If 8% of a cohort will experience the outcome you're predicting and your classifier achieves an implausibly good 80% sensitivity at 80% specificity, precision is still only ~26% — three in four flags are wrong. Educational outcomes have low base rates and enormous irreducible noise. **No amount of modelling fixes this.**

**Design consequences for a risk flag**

1. Prefer **transparent, additive, count-based indicators** over ML scores. If a teacher can't restate the rule in one sentence, don't ship it.
2. **Never output a single risk score or a colour-coded label attached to a child's name.** DEWS shows exactly what that produces: unexplained labels, differential false alarms, no outcome improvement, and — per the student interviews — pupils who know they've been labelled.
3. **Show the constituent evidence, not the conclusion.** "Attendance 87% and falling; 2 subject residuals below −1; homework completion 40%" is honest. "High risk" is not.
4. **Report precision at the operating threshold in the product**, in plain English: "of pupils we flag this way, historically about X in 10 went on to Y." If you can't compute that on the school's own data, you should not be flagging.
5. **Audit false-positive rates by PP, SEND, EAL, ethnicity, sex and term of birth**, and publish the audit to the school. This is the specific failure that destroyed DEWS's credibility.
6. **Frame flags as "worth a look this fortnight", capped in volume** to what the pastoral team can actually action. An unactionable list is worse than no list.
7. Prefer **change-detection over level-detection**: a pupil moving from 96% to 88% attendance is a better signal than a pupil steadily at 90%, and is less confounded with stable disadvantage.

---

## 6. Presenting insight so it leads to action

- **Making Data Work (2018)** remains the definitive UK statement: data is used too much for monitoring and compliance rather than pupil learning; the workload cost is real and drives anxiety and burnout; **two or three attainment collection points a year is the recommended ceiling**; all recommendations accepted by DfE ([report](https://assets.publishing.service.gov.uk/media/5be1ccca40f0b667c116be10/Workload_Advisory_Group-report.pdf); [DfE response table](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/753496/Workload_Advisory_Group_response_table_final.pdf)). **A product that increases data collection frequency to feed its own models is working against the national policy position and against its users.** Ingest what the school already collects.
- **The "data-rich, insight-poor" problem** is well documented and consistent: no clear purpose for the data, so volume overwhelms; business dashboards rebranded for schools that never convert numbers into actionable measures; dashboards that reach the district/trust office and never the classroom teacher; insufficient data literacy support; and — most importantly — investment in data *systems* without equal investment in data *culture* and the human work of interpretation ([OISE](https://cpl.oise.utoronto.ca/data-rich-insight-poor-this-era-of-education-must-focus-on-improvement/); [Teaching Times](https://www.teachingtimes.com/data-rich-but-insights-poor-a-crisis-in-our-schools/); [Schoolytics](https://www.schoolytics.com/blog/data-rich-information-poor-in-k12-schools)).
- **EEF, *Putting Evidence to Work: A School's Guide to Implementation*** — the five-step cycle (decide what you want to achieve; identify solutions; give the idea the best chance of success; did it work?; secure and spread change) plus six recommendations on the behaviours and contextual factors that drive implementation ([EEF](https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/implementation); [2019 PDF](https://d2tic4wvo1iusb.cloudfront.net/eef-guidance-reports/implementation/EEF_Implementation_Guidance_Report_2019.pdf)). The product-relevant lesson: **implementation quality dominates intervention choice.** An insight that names an intervention but not an implementation plan, an owner, and a review date will not change anything.

**What this implies for the UI.** One insight per user per week, not a wall. Every insight carries: the evidence, the competing explanations, the confidence, a named owner, a specific next action, and a date to check. Insights should expire. Insights the user marks "not useful" or "already knew" should suppress that class of insight — the fastest route to being ignored is repeating what a teacher already knows about a child they teach five times a week.

---

## 7. Statistical methods that are actually appropriate

**Multilevel / hierarchical models.** Pupils nested in classes nested in subjects nested in year groups. Standard errors from single-level regression on clustered school data are wrong, usually too small, which manufactures significance. VPC ~11% at school level in simple models; 5–20% of unexplained progress variance at school level ([Goldstein multilevel literature](https://www.semanticscholar.org/paper/Multilevel-modelling-of-educational-data-Goldstein/7e908f144df3766f77b5df797126f9f4d9be0d1c); [Prior/Leckie](https://arxiv.org/pdf/2104.06299)).

**Value-added / residual gain.** Fine as a descriptive device for departments and cohorts. Not fine as a per-teacher judgement (§3). Note the live debate on adjusting for pupil background in VA models — [Leckie & Goldstein](https://arxiv.org/pdf/1811.09240) — where the honest answer is that adjusting and not adjusting answer different questions and neither is "the" school effect.

**Regression to the mean.** This is the single most important item in this section for a product that surfaces "dips". Any pupil selected *because* their score was extreme will move toward the mean on the next assessment with no intervention at all. The classic worked example: 30 lowest-scoring pupils tutored, group rises 8 marks; an untutored control half of the same group rises 5 marks; true effect ≈ 3 marks — **the school would have overstated the benefit by more than double** ([illustrative treatment](https://blog.engora.com/2025/10/regression-to-mean.html); [Didau on mocks and RTM](https://daviddidau.substack.com/p/mock-exams-regression-to-the-mean); [Educational Assessment on RTM in average test scores](https://www.tandfonline.com/doi/abs/10.1207/s15326977ea1004_4)). The Massachusetts 1999 case is the canonical policy-level failure.

*Mandatory product rule:* every "dip" and every "intervention worked" claim must be RTM-adjusted or explicitly caveated. The cheap correct implementation: predict the next score from the *prior distribution*, not the last observation, and flag only deviations from that prediction. Where possible, compare against a matched non-flagged comparison group within the same school.

**Bayesian shrinkage / partial pooling.** Essential for anything with small n — a class, a small subject, a SEND subgroup. Empirical Bayes shrinks each estimate toward the population mean in proportion to its imprecision, so a class of 12 doesn't top the league table on noise ([Mathematica/ERIC evaluation of EB estimation of value-added](https://files.eric.ed.gov/fulltext/ED558123.pdf); [shrinkage and hard-to-predict students](https://www.tandfonline.com/doi/full/10.1080/2330443X.2016.1182878)). **Caveat:** shrinkage has differential consequences for small groups (they are systematically pulled to average, so genuinely exceptional small classes are hidden), and correlating EB predictions across cohorts produces biased stability estimates — a known trap in the VA literature ([Avoiding bias when estimating consistency and stability of VA school effects](https://www.researchgate.net/publication/323082449_Avoiding_Bias_When_Estimating_the_Consistency_and_Stability_of_Value-Added_School_Effects)).

**Uncertainty display.** Confidence/credible intervals on every school-, department- and class-level figure. Most differences a school cares about are not distinguishable from zero. If the interval crosses zero, the product should say so in words, not just draw an error bar people will ignore.

**Sequential / trajectory analysis.** Change-point detection on within-pupil series is more defensible than threshold-crossing, and directly supports §2's temporal-ordering logic. Require ≥2–3 consistent observations before declaring a trajectory change.

**Calibration, not just discrimination.** Report Brier score and a calibration plot, and check calibration *within* PP/SEND/EAL/sex/term-of-birth subgroups. AUC alone hides exactly the failure mode that sank DEWS.

**Causal inference caveats.** Honest options in a school setting are limited: difference-in-differences where an intervention rolled out to some classes and not others; within-pupil fixed effects across subjects; regression discontinuity where a genuine threshold rule allocates support; and interrupted time series. All are fragile. Everything else is adjustment for observables, which cannot fix confounding by the unobserved (illness, home circumstances, motivation) — the exact variables FFT names as driving both absence and attainment. **"Root cause" is not derivable from routine school data.** The product can rank hypotheses and provide discriminating evidence; the causal claim belongs to the human who knows the child.

---

## 8. Summary rules for the build

1. Prior attainment explains ~35–40% of GCSE variance. Never draw a flight path as a line.
2. Attendance is the best early signal and probably mostly a symptom. Use it to prompt questions, never as an asserted cause. Include prior-year absence (FFT).
3. Reading age is the most under-used, most cross-cutting, most actionable variable you can hold. Prioritise ingesting it.
4. Use English proficiency and time-in-English-education, not the EAL flag.
5. Adjust for term of birth at KS3; use it as a calibration test.
6. Drop mobility and PP from per-pupil risk scoring; keep them for context and for bias auditing.
7. No per-teacher value-added, ever. MET between-year r ≈ 0.40 at best; 25–35% misclassification; ASA: teachers = 1–14% of test-score variance.
8. Department analytics: within-pupil cross-subject residuals, multi-year aggregation, item-level analysis, explicit intervals.
9. Early warning: transparent ABC-style rules, evidence shown not conclusion, precision reported, bias audited, volume capped.
10. RTM check before any "dip" or "it worked" claim.
11. Never increase the school's data collection burden to feed the model.
