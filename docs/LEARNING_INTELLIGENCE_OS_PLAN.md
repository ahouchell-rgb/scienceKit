# Learning Intelligence OS — execution plan (mapped to what's already built)

> Source: `learning_intelligence_os_full_detail_chat_export.pdf` (10-year LIOS pipeline).
> This plan reconciles that vision with the **actual current codebase** (houchell +
> retrieval + interactive + springboard, one unified Supabase anchor) as of 2026-06-30.

## TL;DR — the reframe

The LIOS document plans a 10-year build **from zero**. You are not at zero. The
ecosystem already implements most of the document's **Year 1–3 product**: the student
retrieval app, layered AI marking with a confidence/review queue, the teacher
completion + topic-accuracy + misconception views, HoD/SLT/MAT dashboards, the
intervention surface, parent reports, MIS sync, a multi-subject marking layer, **and**
the per-pupil × per-objective mastery graph the document calls "the moat."

**So the binding constraint has shifted from BUILD to PROOF.** The document's own gating
items — marking-accuracy evidence, content volume, pilot case studies, a data-protection
pack, pricing — are mostly *not code*, and are where the real gaps are. Plus 3–4
genuinely-missing, high-commercial-value product pieces.

Do **not** re-run the doc's "build the MVP" timeline. Run the plan below instead.

## The core loop (unchanged — this is the north star)

`Pupil answers → system diagnoses → teacher acts → pupil improves → leader sees impact.`

Every feature is a view or an action on that loop. You already own the loop end-to-end;
the work now is making each hop **trustworthy, measured, and sellable**.

---

## Gap map: LIOS module → current state → action

| LIOS module | Current state | Gap / action |
|---|---|---|
| Student retrieval app | **Built** (retrieval-app: sessions, MCQ + short answer, streaks/XP, weak-area practice) | Polish; keep |
| Layered AI marking (exact → key-point → judgement → confidence) | **Built** — server-authoritative pipeline + low-confidence → `MarkReview` queue; per-subject marking overlays (`_shared/marking/overlays/*`) | **Missing the eval harness** (see Phase 0.1) |
| Teacher dashboard (completion, accuracy by topic/pupil, most-missed) | **Built** (`Teacher.js`, `ClassWeakTopics`, `UnitGaps`) | Keep |
| Misconception view | **Built** (`Misconceptions.js`) but it's a *view*, not the productised **Engine v1** | **Partial** → Phase 1.1 |
| Intervention | **Built** surface (`school/intervention`) | Not yet the auto **Generator** (groups → tasks) → Phase 1.2 |
| Teacher paper builder / feedforward | **Built** (`FeedforwardFromPaper`, deck/paper tools, half-term feedforward cron) | Keep |
| Revision links / interactive revision | **Built** (44 interactive booklets + springboard) | Keep; wire to retrieval gaps |
| HoD / SLT / MAT dashboards | **Built** (`HodPanel`, `school/overview`, trust dashboard, phase-5 roles) | Keep; add benchmarking later |
| Multi-tenant trust→school→dept→class→student + roles | **Built** | Keep |
| MIS sync (Wonde/Arbor/SIMS) | **Built** (`wonde.ts`, mis-sync crons) | Keep |
| Parent reports / parent app | **Built** (parent portal, weekly report cron) + new D2C premium surface (stub) | Decide pricing |
| Mastery graph (curriculum→Q→answer→misconception→intervention) | **Built** (`objectives`, mastery views) — *the doc's moat* | Now also fed by springboard self-study |
| Multi-subject | **Started** (`subject.ts`, maths marking overlay) | Maths is the next subject → Phase 2 |
| Duolingo-style Learn app | **Built** (springboard) — doc says *don't lead with it*; correct, it's a support module now | Keep as personalised follow-up |
| **Marking-accuracy eval / golden set** | **MISSING** | **Phase 0.1 — highest priority** |
| **GCSE Answer Builder** (4/6-marker reasoning chains) | **MISSING** (doc's #3 commercial bet) | Phase 1.3 |
| **Misconception Engine v1** (% affected + hinge + suggested reteach) | **Partial** (tags/view exist; productised engine doesn't) | Phase 1.1 |
| **Intervention Generator** (auto groups → auto tasks per group) | **Partial** | Phase 1.2 |
| **Practical Simulator** (pupil-facing) | **Missing** (authoring `practical-assistant` exists; no pupil sim) | Phase 2+ (premium) |
| Hinge-question generation | **Missing** | Part of Phase 1.1 |
| Data-protection / DPA / safeguarding pack | **Partial** (Trust Centre page, RLS, audit log) | Phase 0.4 |

---

## Phase 0 — Proof & trust (next 90 days). *This gates everything.*

The product is ahead of the company. Close that.

**0.1 Marking-accuracy eval harness — the single most important item.**
The doc calls this "essential"; it doesn't exist. Build a private golden set: for ~200
high-frequency GCSE short-answer questions, collect sample pupil answers with
teacher-approved marks + feedback + known misconceptions. Every marking-prompt/rubric
change runs against it and reports accuracy. *Target the doc's bar: ≥90% on
high-confidence marks.* Without this you cannot defensibly say "trust our AI" to a HoD.
→ new table `marking_gold`, a runner edge function, a tiny ops dashboard.

**0.2 Content volume to a sellable bank.** The doc's MVP bar is 1,500–3,000 short-answer
+ 500–1,000 MCQ for **AQA GCSE Combined Science**, every short-answer with a rubric +
misconception tags. Audit current bank size against this; fill the gap. Use the
`science-lesson-builder` skill + `generate-questions` to draft, then human-tag (the
tagging is the moat, not the question).

**0.3 Pilot + case studies.** 3–5 pilot classes. Track the doc's metrics: ≥70% weekly
completion, ≥90% high-confidence marking accuracy, ≥60% teacher weekly active, 30–60
min/week saved. Convert to 2–3 written case studies. Milestone = *a Head of Science says
"I want this for my department next term."*

**0.4 Data-protection pack.** DPA template, privacy policy, school data-deletion flow,
role-based access review, AI-safety/banned-content note. The doc is right that this can't
be bolted on later; you have the primitives (RLS, audit log, Trust Centre) — package them
into a buyer-facing pack.

## Phase 1 — Productise the engine (the genuinely-missing high-value pieces)

**1.1 Misconception Engine v1.** Turn the misconception *view* into a teacher *action*:
per class × topic, show % affected + example answers + a suggested reteach explanation +
an auto-generated **hinge question** + a follow-up retrieval set. This is the doc's
strongest differentiator and you already have the misconception tags feeding it.

**1.2 Intervention Generator.** After homework/assessment, auto-group pupils (secure /
almost there / misconception / missing-core / non-completers) and generate a 10-min task,
teacher explanation, worksheet, and recheck quiz per group. Build on `school/intervention`
+ the existing feedforward generators.

**1.3 GCSE Answer Builder.** Doc's #3 commercial bet; not built. Scaffolds 4/6-marker
reasoning chains (describe/explain/compare/evaluate + required-practical answers). Sellable
to both schools and parents (D2C). Reuse the marking-overlay + objectives infrastructure.

## Phase 2 — Subject expansion (maths first)

Maths is the doc's #1 expansion (easy to assess, huge demand, clear misconceptions). You
already have a `maths` marking overlay and subject-aware authoring. Build the maths
retrieval bank + misconception set on the *same* mastery-graph spine — don't fork the
data model. English Answer Builder + humanities retrieval follow.

## Phase 3 — Leader & platform layer (mostly already scaffolded)

MAT benchmarking (school-vs-trust, before/after intervention — careful, no crude league
tables), API/licensing of the marking + misconception + curriculum-graph engines,
international (British-international/iGCSE first, *not* US), and the parent B2C app (once
schools are the trust base). Most dashboards exist; the new work is benchmarking + the
API surface.

---

## Pricing ladder (from the doc, mapped to your existing paywall)

| Tier | Price | Status in code |
|---|---|---|
| Teacher Pro (individual) | £8–15/mo | paywall + lead capture exist; wire Stripe |
| Department / HoD | £1.5k–5k/yr | dashboards built; package + sell |
| MAT / Trust | £20k–100k/yr | trust dashboard built; add benchmarking |
| Parent/Pupil (D2C) | £6–12/mo | premium surface stubbed (PR #52); needs price |
| CPD / training | £1–3k/session | credibility play; not code |

Realistic aim from the doc: **£3–5m ARR, then keep profitable or sell.** The route, not
the ceiling, is what matters.

## The non-negotiables (the doc is emphatic; honour them)

1. **Don't dilute the wedge.** Resist building everything at once — the doc's warning is
   the same one in your own `SECONDARY_ED_STRATEGY.md`. Marking eval + misconception
   engine + intervention is the money zone.
2. **Tagging discipline is the moat.** Every question → subject/board/topic/subtopic/
   concept/skill/command-word/misconception/difficulty/prerequisite. You have the schema;
   enforce it on new content.
3. **Marking trust is the linchpin.** Phase 0.1 before any subject expansion.

## Concrete next 2 weeks

1. Stand up the **marking-gold table + eval runner** (0.1) and seed 50 questions × ~10
   answers from real pilot data; report baseline accuracy.
2. **Audit the AQA Combined bank** against the doc's MVP volume/tagging bar; produce the
   fill-list.
3. Draft the **DPA/privacy pack** from the existing Trust Centre + RLS + audit primitives.
