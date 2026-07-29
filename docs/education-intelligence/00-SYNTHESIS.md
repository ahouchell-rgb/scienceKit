# Palantir-for-Education — research synthesis and verdict

> Written 2026-07-27, synthesising five parallel research streams:
> [01 Palantir teardown](research/01-palantir-teardown.md) ·
> [02 UK data landscape](research/02-uk-data-landscape.md) ·
> [03 GDPR & child data](research/03-gdpr-and-child-data.md) ·
> [04 Evidence & methods](research/04-evidence-and-methods.md) ·
> [05 Existing assets audit](research/05-existing-assets-audit.md)

---

## 1. The verdict in one paragraph

The **underlying insight is correct and the white space is genuinely unoccupied**: no UK
product joins reading age to subject-level trajectory to attendance to effort at pupil
grain, and the Palantir ontology pattern is the right architecture for doing it. But
**three of the five things you described are not buildable as stated** — teacher-quality
inference (statistically unsound and politically fatal), automated pupil risk scoring
(legally constrained and empirically poor), and "root cause" determination (not
identifiable from observational school data). The versions that survive are *better
products* than the originals. The real constraint is not technical, legal or competitive —
it is that you are a full-time teacher entering an ECT2 + TLR3 year with a January 2027
go/no-go already on the calendar, and this is a five-year platform.

**Recommendation: build the ontology + action layer as the spine of what you already have,
and ship exactly one cross-domain insight — the literacy-attainment join — as the wedge.
Do not build a platform.**

---

## 2. What the evidence killed, and what replaced it

| You described | Why it fails | What survives |
|---|---|---|
| "Work out if a teacher needs support with behaviour or teaching" | MET: teacher VA year-to-year r = **0.40 maths / 0.20 English**. Schochet & Chiang: **35% misclassification** on 1 year. ASA: teachers = **1–14%** of score variance. Policy: Ofsted dropped internal data 2019; *Making Data Work* (DfE-accepted) bars metrics from pay; STPCD 2024 removed PRP; NEU + NASUWT advise refusal. | **System diagnosis, not people.** Point at timetable slot, room, curriculum sequencing, cohort composition, set boundaries. Individual teacher views visible *only to that teacher*. Contractual guarantee it cannot feed pay or capability. |
| "Students at risk / dropping" | Wisconsin DEWS: wrong ~**75%** of non-graduation predictions, racially skewed false alarms, **no effect** on graduation (Berkeley eval). WWCSC ML: missed **4 in 5** at-risk children, never hit 65% precision. Low base rates make this arithmetic, not implementation failure. ICO: *"you should avoid [profiling children] wherever possible"*; access to education named as a similarly-significant effect. | **Change detection, not risk prediction.** "These 14 pupils' trajectories changed this week, here is the evidence" — descriptive, current, checkable. No score, no ranking, no league table of children. |
| "Work out the root cause" | Observational school data cannot identify causes. Regression to the mean manufactures most apparent dips and recoveries. | **Differential diagnosis.** ~11 ranked candidate explanations, each with its discriminating signal and what would rule it out. RTM checked first, always. Timeline as the only causal leverage (B before A refutes "A caused B"). Determination belongs to the human who knows the child, and the screen says so. |
| "Assemble as much data as possible" | Art 5(1)(c) data minimisation; ICO edtech audit found ~70% had unjustified retention; maximal collection is the exact posture under scrutiny. | **Purpose-scoped collection.** Every field justified against a named question. Safeguarding content is a hard boundary — consume at most a flag, never text. |
| "Most advanced way possible" | DUAA 2025 Art 22B keeps the restrictive ADM regime for Art 9 data — and SEND/EHCP/health are in your dataset. | Advanced *joining and presentation*, conservative *automation*. The system informs; humans decide and act. |

### The two findings that converged independently

Both the evidence agent and the market agent, working separately, landed on the same gap:

- **Evidence:** GCSE papers need reading age ~15y7m; 25% of 15-year-olds read at ≤12 (GL,
  370k pupils); reading level predicts **maths** GCSE better than history or English lit —
  weak readers are penalised hardest where nobody is watching.
- **Market:** FFT/SISRA see attainment, ClassCharts sees behaviour, GL sees reading age,
  Sparx sees homework. **Nobody joins them.** The "Y9 drop → reading age" case is shipped by
  no incumbent.

That convergence is the strongest signal in the whole batch. It is also *testable in your
own department this term* with data you can obtain.

### The other strong analytic

**Within-pupil, cross-subject residuals.** The pupil is their own control — holds home
circumstances, general ability and motivation roughly constant in a way no covariate set
achieves. "Why is this child fine in five subjects and falling in one?" is more answerable
*and* more useful than any risk score. It is also politically safe: it is about the child's
experience, not a judgement of anyone.

---

## 3. The ontology (the transferable Palantir idea)

Palantir's ontology has three layers. The middle one is the whitespace — dbt/Cube/DataHub
do semantics; nobody open-source does kinetics.

- **Semantic** — object types, properties, link types. (dataset→object type, row→object,
  column→property, join→link type. No magic.)
- **Kinetic** — **actions** and functions: the only sanctioned way anything changes.
- **Dynamic** — security, versioning, governance woven through both.

### Proposed education ontology

**Objects:** `Pupil` · `Staff` · `Class` · `Subject` · `Department` · `Objective` ·
`Question` · `Attempt` · `MasteryState` · `AttendanceSession` · `BehaviourEvent` ·
`HomeworkTask` · `LiteracyScreen` · `Assessment` · `Intervention` · `TimetableSlot`

**Links that make it more than a gradebook:**
- `Objective --prerequisite_of--> Objective` (the curriculum DAG — you don't have this yet)
- `Pupil --taught_by--> Staff --in--> TimetableSlot` (lets you diagnose *slots*, not people)
- `Attempt --evidences--> MasteryState --against--> Objective`
- `LiteracyScreen --gates--> Assessment` (via text load — the literacy join)
- `Intervention --targets--> MasteryState --outcome--> Attempt` (closes the efficacy loop)

**Three things to steal, all cheap:**

1. **Ontology as one versioned artefact** — a single schema module generating DB views,
   API, typed client *and* LLM tool definitions. Days of work; highest leverage available.
2. **Actions as the only write path** — no app code and no LLM writes rows directly. Every
   mutation is a named action with typed params, permission predicate, validation, side
   effects, and an immutable edit-history row. Yields audit, undo, agent safety and
   changelog for free. **Given an LLM will be near children's data, this is the single most
   important architectural decision.**
3. **Purpose-based access control + marking propagation** — access requested against a
   named *Purpose*, not a dataset; sensitivity markings inherit downstream through lineage.
   Small to implement; a genuine weapon in a DPIA conversation.

**Ignore:** Foundry-style pipeline stack, no-code app builders, cell-level policy engines,
offline peering, runtime-extensible schema (education's ontology is stable — hard-code it),
and the forward-deployed-engineer model, which would destroy margin at this size.

**Naming correction:** "Nexus Peabody" isn't a Palantir term. The real Gotham backend names
are RevDB, Horizon, Phoenix, and Nexus Peering.

### The NHS lesson

Trusts rejected the Federated Data Platform mostly on **capability, not privacy** — Leeds
said they'd "lose functionality rather than gain it"; the NHS Chief Data & Analytical
Officer Network concluded existing tools already beat it. NHS England then paid KPMG £8.5m
to promote adoption.

**Nobody buys an ontology.** They buy "here are the three things to reteach 9B on Monday,
and here's the evidence." Build the ontology because it makes that answer cheap and
trustworthy — then never mention it in a sales meeting.

---

## 4. Architecture forced by law

From the GDPR research, tagged by force:

**LEGALLY REQUIRED**
- **Stay a processor.** Art 28(10): determine purposes and means and you *are* a controller
  regardless of contract. Model training, cross-school benchmarking, product analytics, or
  unilateral retention decisions each flip you — dragging in your own lawful basis, Art 9
  condition, ROPA, DPIA, child-facing privacy notices and the full Children's Code.
- **No solely-automated significant decisions.** DUAA 2025 s.80 (in force 5 Feb 2026)
  replaced Art 22 with 22A–22D and liberalised ADM generally — but **Art 22B preserves the
  restrictive regime for Art 9 data**, and SEND/EHCP/health are in your dataset.
- **DPIA, several times over** — large-scale profiling *and* data matching are each
  automatic triggers, before adding children, vulnerability, special category data and
  innovative tech.
- **Rights machinery** — a pupil's score is their personal data; exportable with its logic.
- **Sch 1 para 8(3)**: ethnicity may be used for equality monitoring but *explicitly not*
  for "measures or decisions with respect to a particular data subject". **Fairness
  evaluation and inference must be physically separate pipelines.**

**BUYER-EXPECTED**
- UK data residency; Cyber Essentials Plus; sub-processor transparency; 72h breach process;
  school-configurable retention; DfE GenAI product-safety alignment; WCAG 2.2 (a
  public-sector procurement gate you currently fail).

**BEST PRACTICE / DESIGN**
- In-tenant analytics; only k-anonymised aggregates ever leave a school.
- Structural pseudonymisation with a separated identity store; per-tenant keys.
- RLS at DB *and* app layer, with **CI leak tests** (you currently have zero tests on the
  security surface).
- Purpose limitation enforced in code, not policy.
- Synthetic data for all non-production work.
- Everything off by default; profiling off by default (AADC standards 7 and 12).
- **No special category or safeguarding text to any third-party LLM.** Zero-retention terms
  plus tokenised inputs for anything else.
- Human-in-the-loop must be **structural, not decorative**.

### The single biggest legal risk

It is not a breach. It is that the core value proposition — *"this pupil is at risk, and
here's why"* — is precisely what the ICO says to avoid: *"It is possible for you to profile
or make automated decisions about children. However, you should avoid doing so wherever
possible."* Its guidance names access to education as a similarly-significant effect;
setting, tiering, intervention allocation and SEND referral all sit on that line.

Compounding it: **attendance and behaviour data encode who gets sanctioned, not who
misbehaves.** A naive model will disproportionately flag PP/SEND/minority-ethnic pupils —
breaching Art 5(1)(a) fairness, the Equality Act and the school's PSED simultaneously.
Mitigation is product framing plus published disaggregated accuracy, not clever lawyering.

### The rubric you should design against

The ICO's **"Edtech examined"** (24 June 2026) audited 28 providers and issued 596
recommendations. Failure rates: ~70% were controllers without realising it; ~70% had
inadequate Art 28 contracts; ~90% had incomplete ROPAs; ~70% unjustified retention; ~80%
couldn't demonstrate DPbD; 40%+ had done no DPIA. One had sold "anonymised pupil profiles"
to researchers; another's "anonymised" data was pseudonymised with a retained key.
Government will require the ICO to write **a statutory code on children's data in
educational settings**, plus one on ADM/AI.

**This is a published grading rubric for exactly this product.** Design to it. Doing the
DPIA, sub-processor and retention discipline properly *before* the first pilot is a real
competitive advantage in a market where ~80% of incumbents cannot.

---

## 5. Data availability — the good news

The access objection died in September 2024. Daily attendance sharing with the DfE became
**mandatory**, collected automatically from registers by Wonde. Every English school
therefore already has a live Wonde connection and an internal precedent for automated daily
extraction.

| Source | Coverage | Access |
|---|---|---|
| Arbor | ~44% | Developer portal, application process |
| ESS SIMS | ~32% | Holdout; via Wonde/Xporter (CMA drawn in, 2024) |
| Bromcom | ~16% | Free open APIs |
| Wonde | near-universal | ~£360–600/school/yr school-side |

**Obtainable:** session-level attendance with the full 2024 code set; behaviour/rewards
tagged to teacher × subject × period; assessment marksheets; timetable/sets; suspensions;
census demographics (FSM6, EAL, SEN K/E, LAC, service child); **KS2 scaled scores via CTF**
— your best predictive covariate, already in the MIS.

**Outside the MIS:** reading age (NGRT/STAR) and CAT4 live in GL/Renaissance, usually flat
files. Homework/effort (Sparx, Satchel, Educake, Seneca) is rich and completely siloed.

**Hard boundaries:** National Pupil Database (ONS Secure Research Service only) and
safeguarding content (CPOMS/MyConcern) — consume at most a flag.

**Bonus:** Ofsted's November 2025 framework makes **Inclusion** its own graded evaluation
area. Disadvantaged/SEND/EAL gap analysis is now inspection-relevant, and SENDCos have
essentially no analytics built for them.

---

## 6. Where you actually stand

From the assets audit:

**Real and reusable:** the trust→school→class tenancy and RLS spine (every base table
owner-scoped, every cross-org read one role-gated `SECURITY DEFINER` RPC) — a year of
unglamorous work, and exactly the layer this needs first. `pupil_objective_mastery` is a
genuine per-pupil learning-state model. The buyer pack is unusually strong for pre-revenue.

**Missing entirely:** attendance, behaviour, homework, whole-school timetable, reading age,
SEND register, PP/FSM/EAL flags — grep returns **zero hits** across ~100 migrations. No
staff records. No `departments` table.

**Fragmented identity:** five incompatible representations of a child, including
`assessment_marks.student_ref`, a **name string with no FK** — so common-assessment data
cannot join the mastery graph at pupil grain. **Entity resolution is the foundational
unbuilt piece.** (Splink — UK MoJ, Fellegi–Sunter, 1M records/min on a laptop via DuckDB —
is purpose-built for this.)

**Urgent, unrelated to this project:** `x-sciencekit-key` still gates `school/overview`,
`school/intervention` and `trust/overview`. Anyone with that key reads any class's
analytics and **named pupils**, with no JWT. Phase 5 is half-landed, the subtractive
migration unapplied, the key unrotated, and all profiles are still `'member'` so the
replacement gate grants nobody anything. **Fix before building anything new.**

**No schema source of truth.** `packages/db/migrations/` has a 110-row ledger and zero SQL.
CI contract job cannot run.

---

## 7. The scope problem — stated plainly

Your own **Bet-or-Pivot review (8 Jul 2026)** sets:
- go/no-go **January 2027**
- kill criterion firing **30 Sep 2026** if no pilot runs in your department
- the marking eval golden set as *the* gate
- an explicit non-negotiable: **don't dilute the wedge**

Your **perfect-school ACTION_PLAN (17 Jul 2026)** adds a standing override: *if ECT2
assessment is at risk, all discretionary venture work pauses immediately.* You are entering
an ECT2 + TLR3 year.

And the commit log shows the freeze declared on 8 July was preceded by 117 diagrams
committed on 7 July, with nothing committed since. The pattern that produced the freeze is
the pattern this idea would repeat at ten times the scale.

**A Palantir-for-education platform is a 3–5 year, multi-person build.** Assembling
attendance + behaviour + homework + literacy + SEND across a MAT, with entity resolution,
an ontology layer, in-tenant analytics, bias evaluation and a statutory-code-grade
compliance posture, is not a term project. Taken on whole, it violates every constraint you
set yourself three weeks ago.

**But it does not have to be taken on whole.**

---

## 8. Recommendation

### Do this

**Ship one insight, on the right architecture.**

The literacy × subject-trajectory join is: (a) the unoccupied white space both market and
evidence research independently identified; (b) testable in your own department this term;
(c) politically safe — about pupils, not teachers; (d) legally tractable — descriptive, not
predictive, no Art 9 automation; and (e) directly relevant to Ofsted's new Inclusion area.

Concretely, in order:

1. **Finish Phase 5 and rotate the key.** Security debt, blocking, ~a day.
2. **Reconstitute the schema** into `packages/db` from the live anchor. Nothing is
   trustworthy until CI can run.
3. **Build the canonical `Pupil` entity** with resolution to all five existing identifiers.
   This is the ontology's first object and the foundational unbuilt piece.
4. **Add the action layer** — every mutation a named, typed, permission-checked,
   audit-logged action. Do it now, while the surface is small.
5. **Ingest two new domains only:** attendance (via the Wonde connection the school already
   has) and a literacy screen (flat file). Not behaviour, not homework, not SEND — yet.
6. **Ship the one view:** for each pupil, subject-level residuals against their own
   cross-subject mean, with text-load and reading age alongside. Differential diagnosis, RTM
   checked first, evidence shown, no score.

This is roughly one term of evenings, not five years. It produces something no incumbent
ships. It runs inside your own department — satisfying the 30 Sep criterion rather than
violating it. And every piece of it is load-bearing for the larger platform if it works.

### Don't do this

Do not build the ontology as a product, the Gotham-style investigative UI, teacher
analytics in any evaluative form, risk scores, or multi-domain ingest, until the one
insight has demonstrably changed a decision in a real department.

### The honest framing

This is not a separate venture from the marking wedge — it is the **same data spine, one
layer up**. Your existing strategy doc already says "own the data spine, sell views of it."
The Palantir research says the same thing in different words: build the ontology so the
answers are cheap, then sell the answers.

The genuine risk is not that this idea is wrong. It is that it is *exciting*, and the last
exciting thing produced 117 diagrams and a freeze.
