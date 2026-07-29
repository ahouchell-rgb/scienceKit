# Security & Data Residency Statement

**Houchell Education** · one page for DPOs and business managers · v1.0, 2026-07-08

## Where the data lives

All primary data — the database, authentication and file storage — is hosted on Supabase in
the **United Kingdom (AWS eu-west-2, London)**. *(Confirmed against the live infrastructure
on 2026-07-08; every Houchell Education project runs in this region.)*

Content sent for AI-assisted marking (the question and the pupil's typed answer) is
processed by Anthropic in the US **per request**, protected by the UK transfer addendum in
Anthropic's commercial terms, and **is not used to train AI models**. No pupil roster,
account or contact data is sent to the AI provider.

## Controller / processor split

For pupil and guardian data, **the school is the data controller** and Houchell Education is
the processor, acting only on the school's documented instructions (see the DPA in this
pack). Teachers' own account data is controlled by Houchell Education under its privacy
notice.

## What we collect — and don't

Collected: pupil name/class/year (via CSV or Wonde), answers to curriculum questions,
per-objective mastery results, teacher accounts, guardian email + consent record.

**Not collected:** special category data, biometrics, behaviour or safeguarding records,
open-ended AI chat. Pupils cannot converse with an AI; they answer set curriculum questions.

## Security measures (as built)

- TLS in transit; encryption at rest (AWS-managed).
- **Row-Level Security on every table** — each record is scoped to its owner; cross-class,
  cross-school and trust-level reads pass through single, role-gated functions, never
  widened table access.
- Server-side secrets only: no service keys, AI keys or integration tokens in the browser;
  signed webhooks.
- Audit logging of privileged actions (exports, role changes, MIS sync).
- Roles are assigned by the school, never self-assigned by the client.
- Independent security review: Supabase advisor triage completed 2026-07-04.

## AI marking — human in the loop

Marks the system is confident about are shown with the reasoning; anything below the
confidence threshold is routed to a **teacher review queue**. Teachers can override any
mark. No solely automated decision with significant effect on a pupil is made. This design
follows the DfE's principles for AI use in marking (teacher oversight and final judgement).

## Breach response

We notify affected schools without undue delay (target ≤48 h) with the detail needed to
support the school's own 72-hour ICO obligation.

## Certifications — the honest position

We are a UK sole-founder company. We do not yet hold ISO 27001 or Cyber Essentials; our
hosting sub-processors publish their own certifications (Supabase SOC 2 Type II, AWS
ISO 27001). Cyber Essentials is on the roadmap. We will never claim a certification we do
not hold.

## Rights and deletion

Signed-in users can export their own data (JSON) from the account page. A pupil leaving the
school triggers deletion of their personal data; on contract end all school data is
returned and/or deleted within 30 days, confirmed in writing.

**Contact:** privacy@houchelleducation.com · Trust Centre:
houchelleducation.com/trust-centre
