# Buyer Pack — Houchell Education

Procurement-ready data-protection documents for selling to UK schools. Built 2026-07-08 as
step 5 of the 90-day proof plan (see `docs/BET_OR_PIVOT_REVIEW_2026-07-08.md`).

**Purpose:** when a Head of Science says yes, the DPO conversation is usually the slow
part. This pack front-loads it — send the whole folder (or export each file to PDF) with
the pilot offer.

## Contents

| File | What it is | Status |
|---|---|---|
| `01-data-processing-agreement.md` | UK GDPR Art. 28 processor agreement, pre-filled to match the real architecture | Template — needs one legal read-through before first signature |
| `02-dpia-prefilled.md` | DPIA pre-filled from the supplier side (ICO structure) for the school's DPO to adopt | Ready to send |
| `03-dfe-genai-safety-mapping.md` | Mapping to the DfE's generative-AI product safety expectations | Ready to send |
| `04-security-and-data-residency-statement.md` | One-page security/residency summary for business managers | Ready to send |

Live counterpart: [houchelleducation.com/trust-centre](https://houchelleducation.com/trust-centre)
(sub-processor list, principles, rights). Keep Annex C of the DPA and the Trust Centre in
sync when sub-processors change.

## Remaining founder TODOs before first send

- [ ] Set up a monitored `security@` / `privacy@houchelleducation.com` inbox (forwarding to
      Gmail is fine) — referenced throughout the pack and the Trust Centre.
- [ ] One legal/DPO read-through of the DPA template (ask a DPO contact or a
      solicitor-reviewed template comparison; ~1 hr).
- [ ] Confirm MFA is on for Supabase, Vercel, GitHub, and the domain registrar (claimed in
      DPA Annex A).
- [ ] Fill the [BRACKETED] per-school fields when sending to a specific school.

## Facts verified at build time (2026-07-08)

- Supabase hosting region: **AWS eu-west-2 (London)** — checked against all live projects.
- Anthropic commercial API: inputs not used for model training (commercial terms).
- Low-confidence AI marks route to a teacher `MarkReview` queue (server-authoritative
  pipeline) — the human-in-the-loop claim is real, keep it that way.
