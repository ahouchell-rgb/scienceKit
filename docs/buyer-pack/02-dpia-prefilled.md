# Data Protection Impact Assessment (pre-filled)

**Product:** Houchell Education — science retrieval practice, AI-assisted marking and
mastery dashboards (KS3/GCSE)
**Prepared by the supplier:** Adam Houchell, Houchell Education · v1.0, 2026-07-08
**For:** [SCHOOL NAME] — to be reviewed, amended and adopted by the school's DPO

> **How to use this document.** UK GDPR makes the DPIA the *school's* (controller's)
> responsibility, and processing children's data with AI at scale is a trigger for one. To
> save your DPO starting from a blank page, we have pre-filled every section from the
> supplier side following the ICO's DPIA structure
> ([ICO guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/)).
> Sections marked **[SCHOOL]** need the school's own input. The school signs off, not us.

## Step 1 — Identify the need for a DPIA

Triggers present: processing of **children's personal data**; use of **AI/innovative
technology** (LLM-assisted marking); **systematic monitoring** of learning progress.
A DPIA is required. This document fulfils it.

## Step 2 — Describe the processing

**Nature.** The school rosters pupils (CSV upload or Wonde MIS sync). Teachers set
curriculum-aligned retrieval practice. Pupils answer set questions (MCQ, numeric, ordering,
short/extended text). Typed answers are marked server-side: exact/key-point matching first,
then an LLM (Anthropic Claude, per-request API call) marks against the question's mark
scheme and returns a mark, feedback and a confidence score. **Marks below the confidence
threshold are routed to a teacher review queue; teachers can override any mark.** Results
update a per-pupil, per-objective mastery graph shown on teacher/leader dashboards. With
recorded guardian consent, weekly parent reports are emailed.

**Scope.** Data categories and retention: see DPA Annex B (pack doc 01). Volume: [SCHOOL:
number of pupils, e.g. one science cohort]. **No special category data is sought or
required.** Frequency: weekly homework cycles during term.

**Context.** Data subjects are children (11–16). The school is controller; Houchell
Education is processor. Pupils interact only with set curriculum content — there is no
open AI chat. Relationship and expectations: pupils/parents already expect homework
platforms (school currently uses [SCHOOL: e.g. existing platforms]).

**Purposes.** Reduce teacher marking workload; diagnose gaps and misconceptions; target
intervention; report progress to parents and leaders.

**Data flows.**
1. School MIS/CSV → Supabase (UK, AWS eu-west-2 London) — roster.
2. Pupil browser → Supabase — answers, results (TLS).
3. Question + mark scheme + pupil answer text (no name attached) → Anthropic API (US,
   per-request, not retained for training) → mark + feedback → Supabase.
4. Report content → Resend (email) → consenting guardians. *(Optional feature.)*

## Step 3 — Consultation

Supplier-side: product designed and piloted by a serving science teacher; security posture
independently reviewed (Supabase advisor triage, 2026-07-04). **[SCHOOL]:** record DPO
review; consider informing parents via the school's usual privacy-notice channels; pupil
voice via the pilot classes.

## Step 4 — Necessity and proportionality

**Lawful basis (school as controller):** public task (Art. 6(1)(e)) for state schools'
education function [SCHOOL: or legitimate interests for independent schools; consent is
used only for parent report emails].
**Necessity:** marking workload and gap-diagnosis cannot be achieved at this granularity
manually within teacher time; the DfE's 2025 guidance endorses AI-assisted marking and
feedback under human oversight.
**Proportionality / minimisation:** only roster + answers + results are processed; answer
text sent to the AI carries no pupil name; no profiling beyond educational mastery; no
solely automated significant decisions (Art. 22 not engaged — teacher retains final
judgement); UK data residency; defined retention with deletion on pupil exit.
**Data subject rights:** in-app export (JSON); rectification/erasure via school or
privacy@houchelleducation.com; transparent privacy notice + Trust Centre.

## Step 5 — Identify and assess risks

| # | Risk | Likelihood | Severity | Overall |
|---|---|---|---|---|
| R1 | Unauthorised access to pupil records (breach of platform) | Low | Serious | **Medium** |
| R2 | AI mis-marks an answer → pupil gets wrong feedback / demotivation | Possible | Minor (low-stakes homework) | **Medium-low** |
| R3 | Pupil types personal/sensitive content into a free-text science answer | Possible | Serious if missed | **Medium** |
| R4 | US transfer of answer text (AI processing) challenged | Low | Minor (no identifiers attached) | **Low** |
| R5 | Parent report sent without valid consent / to wrong guardian | Low | Serious | **Medium** |
| R6 | Data retained beyond need (pupil leaves, contract ends) | Low | Minor | **Low** |
| R7 | Supplier is a single-person company (continuity/key-person risk) | Possible | Minor (data exportable) | **Medium-low** |

## Step 6 — Measures to reduce risk

| Risk | Measures | Residual risk |
|---|---|---|
| R1 | RLS on every table; role-gated cross-school functions; server-side secrets; audit logging; TLS + at-rest encryption; MFA on admin accounts; breach notification ≤48 h (DPA §8) | Low |
| R2 | Confidence-gated **teacher review queue**; teacher override on any mark; golden-set evaluation harness reporting agreement with teacher marking before each release; use restricted to low-stakes formative practice per DfE guidance | Low |
| R3 | Answers visible to the class teacher (normal marking visibility); free-text boxes prompt for science content only; supplier deletes flagged content on request; automated disclosure-flagging on the roadmap (see DfE-standards mapping doc, #4) — **[SCHOOL]: brief pupils that answer boxes are seen by teachers, as with any homework** | Low-medium |
| R4 | No direct identifiers in AI-bound text; Anthropic commercial terms (no training on inputs) + UK addendum/IDTA; per-request processing, no retention | Low |
| R5 | Reports sent only where consent is recorded; unsubscribe on every email; per-child stop control in parent portal; guardian contacts come from the school's own MIS/CSV | Low |
| R6 | Retention schedule in DPA Annex B; deletion on pupil exit; return-and-delete within 30 days of contract end, confirmed in writing | Low |
| R7 | Full JSON export available to the school at any time; open documented schema; source-controlled infrastructure; [escrow/continuity arrangement available on request] | Low |

## Step 7 — Sign-off and outcomes

| | Name / role | Date | Notes |
|---|---|---|---|
| Measures approved by | **[SCHOOL DPO]** | | Integrate actions into project plan |
| Residual risks approved by | **[SCHOOL SIRO/Head]** | | If any risk remains high, consult ICO before processing |
| DPO advice | **[SCHOOL DPO]** | | |
| Review date | | | Review annually or on significant product change; supplier gives 30 days' notice of sub-processor changes |

*Supplier contact for DPIA questions: privacy@houchelleducation.com*
