# Mapping to the DfE Generative AI: Product Safety Standards

**Houchell Education** · v1.0, 2026-07-08
Mapped against the DfE's *Generative AI: product safety standards* as **updated 19 January
2026** ([GOV.UK](https://www.gov.uk/government/publications/generative-ai-product-safety-standards/generative-ai-product-safety-standards)),
which supersedes the 2025 *product safety expectations*.

## The one-paragraph version for a busy DPO

Houchell Education is **not an open-ended chatbot**. Pupils answer set, curriculum-aligned
science questions; they cannot converse with an AI, and no AI-generated content is shown to
a pupil without a teacher-controlled pathway. Generative AI is used **server-side** for two
things: marking typed answers against real mark schemes (with low-confidence marks routed
to a teacher review queue) and generating teacher-facing material. This architecture means
most learner-facing standards (filtering, emotional development, mental health,
manipulation) are met **structurally** — the interaction pattern that creates those risks
does not exist in the product — rather than by classifier bolt-ons.

## Standard-by-standard

| # | DfE standard | How Houchell Education meets it | Status |
|---|---|---|---|
| 1 | **Stated purpose** | Purpose is narrow and stated: KS3/GCSE science retrieval practice, AI-assisted marking with teacher review, and gap/misconception dashboards. Impact claims are limited to measured pilot numbers (marking-minutes saved, mastery movement) — no unevidenced attainment claims. | ✅ Met |
| 2 | **Educational use cases** | Declared use cases: *assessment and analytics* (AI marking, mastery graph) and *personalised learning* (spaced review, weak-topic practice). Not a digital assistant, research aid, or engagement companion. | ✅ Met |
| 3 | **Filtering** (learner-facing) | Pupils never receive free-form AI output. All pupil-facing content (questions, facts, diagrams, model answers) is fixed, teacher-reviewable curriculum content. There is no AI conversation to filter. | ✅ Met structurally |
| 4 | **Monitoring and reporting** (learner-facing) | No AI chat exists to monitor. Pupils do type free-text answers to science questions; these are visible to their teachers. **Honest gap:** automated safeguarding-disclosure detection on typed answers is not yet implemented — it is on the roadmap; today, teacher visibility of all answers is the control. | ⚠️ Partial (by design + roadmap) |
| 5 | **Security** | Row-Level Security on every table; role-gated cross-school access; server-side-only secrets; signed webhooks; authentication via Supabase with school-assigned roles (never client-self-assigned); prompt-injection surface minimised because pupils cannot address the model directly; regular dependency updates. Aligned with the DfE Cyber Security Standards. | ✅ Met |
| 6 | **Privacy and data protection** | School is controller; we are processor under a signed DPA (pack doc 01). Pre-filled DPIA supplied (pack doc 02). UK-hosted data (AWS eu-west-2, London). Privacy notice + Trust Centre published. No personal data used for any commercial purpose beyond providing the service. | ✅ Met |
| 7 | **Intellectual property** | Pupil answers and teacher content are **not used to train or fine-tune models** — by us (contractual commitment in the DPA) or by our AI sub-processor (Anthropic commercial terms). Inputs are processed per request only. | ✅ Met |
| 8 | **Design and testing** | Marking pipeline is version-controlled with a golden-set evaluation harness: every marking-prompt/rubric change runs against ~200 teacher-marked real answers and reports agreement before release. *(Being built summer 2026 — the pilot's headline evidence artefact.)* Built and piloted by a serving science teacher in real classrooms. | ✅ Met / in progress |
| 9 | **Governance** | Product risk assessment maintained (DPIA §5); complaints/safety contact published on the Trust Centre; this pack + Trust Centre constitute the published safety policies. Single-founder company: one accountable owner. | ✅ Met |
| 10 | **Cognitive development** (learner-facing) | The pedagogy is the opposite of cognitive offloading: pupils must retrieve and construct answers before any model answer is shown (retrieval practice, self-marking against a scheme, spaced review). There is no "solve it for me" button and no answer generation for pupils. | ✅ Met structurally |
| 11 | **Emotional and social development** (learner-facing) | No persona, avatar, name, or "I" voice anywhere in the pupil experience; no conversational relationship is possible. Session design (hearts/short sessions) bounds usage rather than extending it. Teacher dashboards show usage. | ✅ Met structurally |
| 12 | **Mental health** (learner-facing) | No conversational surface where distress disclosure or dependency can form. See standard 4 for the free-text-answer roadmap item; teacher visibility is the current control. | ✅ Met structurally (see #4) |
| 13 | **Manipulation** | Gamification is limited to transparent, low-stakes, educationally-justified incentives (XP, streaks tied to spaced-review schedules — the DfE's explicit carve-out). No dark patterns, no engagement-maximising design, no ads, no in-product steering to paid tiers for pupils. | ✅ Met |

## Related DfE guidance

- *Generative AI in education* (DfE policy paper, updated June 2025, with the Chiltern
  Learning Trust / Chartered College support materials): AI may support marking and
  feedback **with human oversight**, teachers remain responsible for outputs, use in
  low-stakes assessment first. Our confidence-gated teacher review queue is this principle
  implemented as architecture.
  [GOV.UK](https://www.gov.uk/government/publications/generative-artificial-intelligence-in-education/generative-artificial-intelligence-ai-in-education)

*Questions: privacy@houchelleducation.com · Live sub-processor list:
houchelleducation.com/trust-centre*
