# Data Processing Agreement (Template)

**Between:** [SCHOOL / TRUST FULL LEGAL NAME] of [ADDRESS] (the "**Controller**" / the "School")
**And:** Adam Houchell trading as **Houchell Education** of [BUSINESS ADDRESS] (the "**Processor**" / "Houchell Education")

**Effective date:** [DATE] · **Version:** 1.0 (2026-07-08)

> **Founder note (delete before sending):** this is a working template aligned to UK GDPR
> Article 28. Have it looked over by a solicitor or an edtech-experienced DPO before first
> signature, then reuse. Fields in [BRACKETS] must be completed per school. It is drafted to
> match what is actually true of the platform as of July 2026 — if the architecture changes
> (new sub-processor, new region), update Annexes B/C first.

## 1. Background and scope

1.1 The School uses the Houchell Education platform (the "Service"): curriculum-aligned
retrieval practice, AI-assisted marking with teacher review, mastery/gap dashboards and
parent reporting for science at KS3/GCSE.

1.2 This Agreement governs the Processor's processing of personal data on behalf of the
School and forms part of [the Order Form / the pilot agreement dated [DATE]].

1.3 For pupil and guardian personal data, the **School is the Controller** and Houchell
Education is the **Processor**. For teachers' and guardians' own account credentials and
Houchell Education's business records, Houchell Education acts as an independent Controller
(covered by its privacy notice, not this Agreement).

## 2. Definitions

"**UK GDPR**", "**personal data**", "**processing**", "**data subject**", "**personal data
breach**" and related terms have the meanings in the Data Protection Act 2018 and the UK
GDPR. "**Sub-processor**" means any third party engaged by the Processor to process School
personal data.

## 3. Subject matter, duration, nature and purpose

| | |
|---|---|
| **Subject matter** | Provision of the Service to the School |
| **Duration** | The term of the Service agreement, plus the deletion period in clause 10 |
| **Nature of processing** | Hosting, storage, retrieval, display, AI-assisted analysis of pupil answers, aggregation, reporting, email delivery |
| **Purpose** | Setting and marking retrieval practice; diagnosing gaps/misconceptions; reporting progress to teachers, leaders and parents |
| **Categories of data subjects** | Pupils; teachers and school staff; parents/guardians |
| **Categories of personal data** | See Annex B |
| **Special category data** | **None required or intentionally collected.** Free-text fields are not for sensitive content; see clause 5.6 |

## 4. Controller instructions

4.1 The Processor shall process School personal data **only on the School's documented
instructions** (including this Agreement and in-app configuration made by authorised School
staff), unless required otherwise by UK law — in which case the Processor will inform the
School before processing, unless the law prohibits it.

4.2 The Processor shall immediately inform the School if, in its opinion, an instruction
infringes UK GDPR.

## 5. Processor obligations

5.1 **Confidentiality.** Persons authorised to process the data (currently the founder and
no other staff) are committed to confidentiality.

5.2 **Security.** The Processor implements the technical and organisational measures in
**Annex A** and shall not degrade them during the term.

5.3 **Data subject rights.** Taking into account the nature of processing, the Processor
shall assist the School with requests under Chapter III UK GDPR (access, rectification,
erasure, portability). Signed-in users can self-serve export from the account page; other
requests are actioned via privacy@houchelleducation.com within [5] working days.

5.4 **Assistance.** The Processor shall assist the School with its obligations under
Articles 32–36 (security, breach notification, DPIA, prior consultation), including
providing the pre-filled DPIA in this buyer pack.

5.5 **AI processing commitments.**
(a) Pupil answers submitted for AI-assisted marking are processed per request via the
Processor's AI sub-processor (Anthropic) and are **not used to train AI models** (per
Anthropic's commercial terms).
(b) AI marking is **teacher-supervised by design**: marks the system is not confident in
are routed to a teacher review queue; the School's teachers retain final judgement.
(c) No solely automated decision producing legal or similarly significant effects on a
pupil is made by the Service.

5.6 **Data minimisation.** The Service is designed so pupils are not asked to enter
sensitive personal data. If the School becomes aware of sensitive data entered into
free-text answers, the Processor will delete it on request.

## 6. Sub-processors

6.1 The School gives **general authorisation** to the sub-processors listed in **Annex C**
(also published at houchelleducation.com/trust-centre).

6.2 The Processor shall give at least **30 days' notice** of any intended change (email to
the School's named contact), during which the School may object on reasonable
data-protection grounds; if the objection cannot be resolved, the School may terminate the
affected Service without penalty.

6.3 The Processor imposes data-protection obligations on each sub-processor equivalent to
this Agreement and remains liable for their performance.

## 7. International transfers

7.1 Primary data (database, authentication, file storage) is hosted in the **UK (AWS
eu-west-2, London)**.

7.2 Limited transfers occur only as set out in Annex C (e.g. per-request AI processing by
Anthropic in the US; email/payment providers in the EU/US). Each transfer is protected by
the UK Addendum to the EU SCCs / IDTA or an adequacy regulation, as identified in the
sub-processor's linked DPA.

## 8. Personal data breach

8.1 The Processor shall notify the School **without undue delay, and in any event within 48
hours**, of becoming aware of a personal data breach affecting School personal data, with
sufficient information to support the School's ICO notification within its own 72-hour
window, and shall cooperate on remediation and communications.

## 9. Audit

9.1 The Processor shall make available information reasonably necessary to demonstrate
compliance with Article 28 (this pack, the Trust Centre, sub-processor DPAs) and, no more
than once per year on 14 days' notice, allow a remote audit/review meeting. On-site audits
of hosting infrastructure are satisfied by the sub-processors' published certifications
(e.g. Supabase SOC 2).

## 10. Return and deletion

10.1 On termination or expiry, the Processor shall, at the School's choice, return (JSON
export) and/or delete all School personal data within **30 days**, and confirm deletion in
writing, save for minimal records required by law.

10.2 A pupil leaving the School (or removal from the roster/MIS sync) triggers deletion of
that pupil's personal data in line with the retention schedule in Annex B.

## 11. Liability and general

11.1 Each party's liability arising under this Agreement is subject to the limitations in
the main Service agreement, [save that nothing limits liability for a party's breach of
data-protection law to the extent it cannot lawfully be limited].

11.2 This Agreement is governed by the law of England and Wales.

**Signed for the School:** ________________ Name/role: ________________ Date: ______

**Signed for Houchell Education:** ________________ Adam Houchell, Founder Date: ______

---

## Annex A — Technical and organisational security measures

- **Encryption:** TLS in transit; encryption at rest (Supabase/AWS-managed).
- **Access control:** Row-Level Security on every table; least-privilege, role-gated
  access; cross-teacher/school/trust reads only via single role-checked functions; roles
  are never client-self-assignable.
- **Secrets:** service-role keys, AI keys and integration tokens are server-side only;
  webhooks are signature-verified.
- **Audit:** privileged actions (data exports, role changes, MIS sync) are audit-logged.
- **Personnel:** single-operator company; access limited to the founder; MFA on all
  administrative accounts. [CONFIRM: enable MFA everywhere before signature.]
- **Backups & availability:** managed daily backups (Supabase); restore procedure tested.
  [CONFIRM: date of last restore test.]
- **Development practice:** staging/production separation; migrations reviewed before
  apply; security advisors triaged (last full triage 2026-07-04).

## Annex B — Data categories and retention

| Data subject | Data | Purpose | Retention |
|---|---|---|---|
| Pupil | Name, class, year group, school identifier (via CSV/Wonde) | Rostering | Contract term; deleted ≤30 days after pupil leaves or contract ends |
| Pupil | Answers to retrieval/exam questions; per-objective mastery results | Marking, gap diagnosis, dashboards | As above; aggregates may be retained anonymised |
| Teacher | Name, school email, role | Accounts, dashboards | Contract term + 30 days |
| Guardian | Name, email, consent record | Parent reports (only with recorded consent; unsubscribe on every email) | Contract term + 30 days, or on unsubscribe/withdrawal |
| — | **Not collected:** special category data, biometrics, behaviour/safeguarding records, free-text chat with AI | — | — |

## Annex C — Approved sub-processors (as at 2026-07-08)

| Provider | Purpose | Data | Region | Terms |
|---|---|---|---|---|
| Supabase | Database, auth, storage | Pupil/teacher/parent records | **UK (AWS eu-west-2, London)** | supabase.com/security |
| Anthropic | AI marking/generation (per request; no model training on inputs) | Question + pupil answer text sent for marking | US | anthropic.com/legal/commercial-terms |
| Vercel | App hosting/CDN | Request metadata (no primary data store) | Global edge | vercel.com/legal/dpa |
| Resend *(optional)* | Parent-report email | Guardian emails + report content | EU/US | resend.com/legal/dpa |
| Wonde *(optional, per school)* | MIS roster sync | Roster + contact data | UK | wonde.com/security |
| Stripe *(optional, paid plans)* | Payments | Billing details (no card data on our servers) | EU/US | stripe.com/gb/privacy |
| Google / Microsoft *(optional, per-teacher OAuth)* | File import teacher explicitly picks | Picked files only | Global | vendor DPAs |
