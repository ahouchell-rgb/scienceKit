# UK Data Protection Law and Practice for a School Data-Intelligence Platform

**Research note 03 — GDPR and child data**
Date of research: 27 July 2026. Primary sources: ico.org.uk, legislation.gov.uk, gov.uk/DfE.

**Scope.** A B2B SaaS platform sold to schools and MATs which ingests, per pupil: attendance, behaviour incidents, grades/assessment, homework completion, reading age, SEND/EHCP status, EAL, Pupil Premium/FSM, possibly safeguarding flags; plus teacher-level and class-level aggregates. It runs analytics and AI to produce insights and predictions ("this pupil is at risk", "root cause appears to be reading age").

**Key throughout:**
- 🔴 **LEGALLY REQUIRED** — statute, regulation, or ICO position where non-compliance is a breach.
- 🟠 **BUYER-EXPECTED** — a MAT DPO / DfE standard / procurement gate will demand it even though it is not itself law.
- 🟢 **BEST PRACTICE** — reduces risk, differentiates, not currently demanded.

---

## 0. The single most important source published this year

On **24 June 2026** the ICO published **"Edtech examined: key findings from our audits"** — consensual audits of **28 edtech providers** covering MIS, safeguarding systems, behaviour management platforms, LMS, classroom apps and data integration services, run through 2024–2025.

- Report page: https://ico.org.uk/action-weve-taken/audits-and-overview-reports/2026/06/edtech/
- PDF: https://ico.org.uk/media2/13yfm55z/edtech-examined-key-findings-from-our-audits.pdf

This is effectively the ICO's published grading rubric for exactly the product being contemplated. Headline numbers:

| Finding | Rate |
|---|---|
| Providers who were **controllers** for some processing but hadn't recognised it | **~70%** |
| Providers who couldn't show the school/child had authorised secondary use | **~70%** |
| Contracts lacking sufficient Art 28 detail / clear instructions | **~70%** |
| Incomplete ROPA or data-flow maps | **almost 90%** |
| Retention periods unspecified or excessive | **~70%** |
| Couldn't demonstrate data protection by design in product development | **~80%** |
| No functionality for schools to fully action individual rights requests | **~30%** |
| Recommendations issued / accepted | **596 / 98%** |

The Foreword also flags that government **will require the ICO to produce a new statutory code on the use of children's personal information in digital systems in educational settings** (secondary legislation under the DUAA; consultation expected later in 2026). Government has also committed to a second new code on **solely automated decision-making and AI**. Both land directly on this product. Design now to the direction of travel, not to today's minimum.

Specific ICO findings to internalise:

- *"One provider had previously used children's information to create anonymised pupil profiles to sell to third parties conducting education research."* — flagged as a failure.
- One provider's "anonymised" data was in fact **pseudonymised** (two DBs decoupled but a reference key retained), kept indefinitely, with no lawful basis. The ICO required urgent remediation.
- A model-good provider designed the product to **work with no pupil personal data at all** (generic school account or pseudonymous per-pupil codes), made demographic fields optional, and used **synthetic data** for development, test and debugging.

---

## 1. The legal basis stack

### 1.1 The instruments in force

| Instrument | Status |
|---|---|
| **UK GDPR** (retained Reg (EU) 2016/679) | In force, as amended by DUAA 2025 |
| **Data Protection Act 2018** | In force. Sch 1 supplies the Art 9(2)(g) / Art 10 conditions |
| **Data (Use and Access) Act 2025 (c.18)** | Royal Assent **19 June 2025**. Data protection provisions commenced in tranches; the **new ADM articles (22A–22D) came into force 5 February 2026** |
| **Keeping Children Safe in Education** | Statutory safeguarding guidance for schools |
| **Equality Act 2010 + Public Sector Equality Duty s.149** | Applies to the school; bites on your model outputs via them |
| **Online Safety Act 2023** | Only if you add user-to-user or search features; largely not this product |

DUAA text: https://www.legislation.gov.uk/ukpga/2025/18 · s.80 (ADM): https://www.legislation.gov.uk/ukpga/2025/18/section/80/enacted

### 1.2 What DUAA 2025 actually changed (the bits that matter here)

Per the ICO's own summary (https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/):

1. **Automated decision-making liberalised** — old Art 22 (prohibition-with-exceptions) replaced by **Arts 22A–22D** (permission-with-safeguards). *Except for special category data, where the old restrictive regime effectively survives.* See §3.
2. **New lawful basis Art 6(1)(ea) "recognised legitimate interests"** with the list at new **Annex 1** (safeguarding vulnerable individuals, emergencies, crime detection, national security, democratic engagement, public-task disclosures to public bodies). No balancing test required. **But note Art 22B(4): a significant decision may NOT be taken solely automatically if the processing is carried out in reliance on Art 6(1)(ea).** So you cannot use the shiny new basis to bootstrap automated risk-flagging.
3. **Research provisions loosened** (ss.67–71): "scientific research" expressly includes commercial and privately funded research; "broad consent" to an area of research is permitted; further processing for scientific research/archiving/statistics is deemed compatible with the original purpose. **This is the clause a vendor will be tempted to abuse to justify model training on tenant data. Do not.** The ICO's edtech audit expressly criticises providers who repurposed pupil data for product development on this kind of reasoning without a lawful basis, a compatibility assessment or transparency.
4. **Art 25 "children's higher protection matters"** — controllers of ISS likely to be accessed by children must expressly consider how best to protect and support children, that children merit specific protection, and that children have different needs at different ages and developmental stages. ICO position: conforming to the Age Appropriate Design Code satisfies this. (ICO guidance updated 15 May 2026.)
5. **Complaints duty** — must provide an accessible route (e.g. electronic form), acknowledge within **30 days**, respond without undue delay.
6. DfE's own note to schools: https://www.gov.uk/guidance/data-protection-in-schools/the-data-use-and-access-act-2025

### 1.3 Controller vs processor — the fault line

🔴 **LEGALLY REQUIRED.** Art 4(7)/(8); Art 28(10): *"if a processor infringes this Regulation by determining the purposes and means of the processing, the processor shall be considered a controller in respect of that processing."*

The ICO edtech report is unambiguous:

> *"If you determine the purposes and means of processing, you are a controller, regardless of how any contract about processing services describes your role."*

And the Children's Code edtech guidance (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/the-children-s-code-and-education-technologies-edtech/) says the same: *"The processing role of an edtech provider is not determined by your designation as a processor or controller as set out in a contract, but whether you in fact exercise control over the means and purposes."*

**School (or MAT) = controller. You = processor** — but **only** if all of:
- you process pupil data **solely** on the school's documented written instructions (Art 28(3)(a));
- there is a binding written contract meeting **Art 28(3)(a)–(h)** with specific, non-vague processing descriptions;
- the school can meaningfully configure the processing — retention periods, optional fields, optional features, on/off toggles;
- you do **nothing** with the data for your own purposes.

**You become an independent controller the moment you:**
- train, fine-tune, evaluate or benchmark models on tenant pupil data;
- produce cross-school aggregates, benchmarks, or "anonymised" datasets for your own use or sale (the *act of anonymising* is itself processing of personal data — ICO edtech report §"anonymisation");
- do product analytics, A/B testing, or feature development on real pupil records;
- fix retention periods or feature defaults universally with no school override (an actual ICO finding that turned a self-declared processor into a controller);
- decide substantively *which* pupils get flagged and on what criteria without the school having set or approved those criteria.

The ICO also identified a third pattern: **joint/shared control**, where the school picks what data to send and the provider picks the fields, the method and the outputs. For a "root cause analysis" engine that decides the analytic model itself, that risk is live.

🔴 The consequences of being a controller are not cosmetic: you need your own **Art 6 lawful basis and Art 9 condition**, your own **ROPA (Art 30)**, your own **DPIA (Art 35)**, your own **privacy information to children and parents (Arts 13/14)**, and you fall in scope of the **Children's Code**.

🔴 The ICO's key edtech finding: providers relying on **legitimate interests** for secondary use had done **no LIA**, and had **no Art 9 condition at all** for ethnicity/health data they were reusing. In one case the provider concluded on review that it *wasn't fair* to reuse special category data it only held because of its processor contract, and **deleted it**.

**Architectural consequence:** if you want to remain a clean processor — which is overwhelmingly the right commercial and legal posture — model improvement must not touch tenant data. See §6.

### 1.4 The school's lawful basis (which you inherit as processor)

🔴 For a maintained school or academy trust:

- **Art 6(1)(e) public task** for core pupil data processing. DfE: *"You may consider public task as a lawful basis if the tool enables you to carry out your school's official duties. However, if the tool has additional features that are beyond the scope of your instructions in performing your official duties, public task will not be appropriate."* (https://www.gov.uk/guidance/data-protection-in-schools/procuring-educational-technology-edtech)
- Statutory hooks: Education Act 1996, Education Act 2002 s.175, Education (Pupil Information) (England) Regulations 2005, Education (School Performance Information) Regs.
- ICO edtech guidance is explicit that **Art 6(1)(e) is not available to you as a vendor**: *"The 'public task' lawful basis... is unlikely to be an appropriate lawful basis for edtech providers."*

**Special category data.** SEND, EHCP, health/medical, and ethnicity are Art 9(1) data. EAL and FSM/Pupil Premium are not *per se* special category but are strong proxies for ethnicity and socio-economic status, and combining them is what generates the fairness risk (§7).

🔴 Route for schools: **Art 9(2)(g) substantial public interest**, plus a condition in **DPA 2018 Sch 1 Part 2**:
- **Para 6 — statutory etc. and government purposes**: necessary for the exercise of a function conferred by an enactment or rule of law, and necessary for reasons of substantial public interest. This is the workhorse for SEND/EHCP processing.
- **Para 8 — equality of opportunity or treatment**: permits processing racial/ethnic origin, religion, health, sexual orientation data to identify or keep under review the existence or absence of equality of opportunity between groups. **Critical limitation at para 8(3): the condition is NOT met if the processing is carried out "for the purposes of measures or decisions with respect to a particular data subject."** So para 8 supports *cohort-level gap analysis* but **cannot** support an individual pupil-level risk flag driven by ethnicity. Also excluded if likely to cause substantial damage or distress (8(4)).
- **Para 18 — safeguarding of children and of individuals at risk**: necessary for protecting an individual under 18 from neglect or physical/mental/emotional harm, or protecting their well-being, carried out without consent because consent cannot be given / can't reasonably be obtained / would prejudice the protection, and necessary for reasons of substantial public interest. This is the safeguarding route, and DfE points to it directly.
- **Para 5**: reliance on any Part 2 condition requires an **Appropriate Policy Document** (Sch 1 Part 4 para 39) in place at the time of processing, plus the Part 4 record-keeping safeguards.

Text: https://www.legislation.gov.uk/ukpga/2018/12/schedule/1/enacted

### 1.5 Safeguarding data specifically

🔴 **Recommendation: do not ingest safeguarding records at all in v1.** Reasons:
1. Para 18 is drafted around *protecting the individual child*, not around building predictive analytics or vendor-side insight products. A generalised analytics platform will struggle to show its processing is "necessary" for protecting a specific child.
2. Safeguarding logs contain third-party personal data (siblings, parents, alleged perpetrators, social workers) with independent rights and no relationship with you.
3. The reputational blast radius of a safeguarding-data leak is unbounded and will end the company.
4. The ICO's own audit scope treated safeguarding systems as a distinct, higher-sensitivity category; providers of safeguarding products were the ones who could *best* demonstrate design rigour. You will be benchmarked against them.

🟢 If safeguarding signals are eventually needed, take a **boolean, school-set flag** ("DSL has an open concern: yes/no") set manually by the school, never free-text narrative, never syncable, and excluded from any model training and any cross-school aggregation.

---

## 2. Children's data specifics

### 2.1 Does the Children's Code (Age Appropriate Design Code) apply?

The Code (statutory under DPA 2018 s.123) sets **15 standards**: 1 best interests of the child, 2 DPIAs, 3 age appropriate application, 4 transparency, 5 detrimental use of data, 6 policies and community standards, 7 default settings, 8 data minimisation, 9 data sharing, 10 geolocation, 11 parental controls, 12 profiling, 13 nudge techniques, 14 connected toys, 15 online tools.
https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/

🔴 **The Code does NOT apply to you only if all three of the following hold** (ICO edtech guidance, verbatim criteria):
1. the service is not accessed direct-to-consumer;
2. you process children's information **only** to fulfil the school's public tasks and educational functions as determined by the school; and
3. you act **solely** on the school's instruction and process the data in no other way.

Break any one — e.g. a parent/pupil-facing portal, product development on pupil data, cross-school benchmarking, model training — and the Code applies in full. Note the Code applies even to non-profit services, because equivalent services are normally provided for remuneration.

🟠 **Practical position: assume the Code applies and conform to it anyway.** Reasons: (a) DUAA's new Art 25 children's-higher-protection duty is satisfied by conforming to the AADC, and that duty applies to any ISS likely to be accessed by children; (b) MAT DPOs now ask about it directly — DfE tells them to (*"you must ensure that they meet the standards within the code"*); (c) the forthcoming statutory edtech code will be built on it.

**Standards that bite hardest for this product:**
- **1 Best interests of the child** — the primary consideration in design decisions, over commercial interest. Requires a documented best-interests assessment.
- **2 DPIAs** — mandatory; Annex D of the Code is a child-specific DPIA template.
- **5 Detrimental use of data** — do not use children's data in ways demonstrably detrimental to their wellbeing. A wrong risk-flag that lowers a teacher's expectations of a child is exactly this.
- **7 Default settings** — high privacy **by default**. The ICO found providers rolling out AI features switched **on** by default; that is a finding against you.
- **8 Data minimisation** — collect only what is needed for *the element of the service the child is actively engaged in*.
- **9 Data sharing** — no sharing unless compelling reason in the child's best interests. Cross-school benchmarking is data sharing unless truly anonymous.
- **12 Profiling** — 🔴 **profiling options off by default** unless a compelling reason justified by the child's best interests, and only with measures to protect the child from harmful effects. This is the single standard most in tension with the product concept.
- **13 Nudge techniques** — don't nudge children into lower privacy settings or extended engagement.
- **15 Online tools** — prominent, accessible tools for children to exercise their rights.

### 2.2 The cautionary tales

**ICO reprimand to the DfE, 2 November 2022** — https://ico.org.uk/media2/migrated/4022280/dfe-reprimand-20221102.pdf
The **Learning Records Service** database held the records of up to **28 million** children and young people from age 14 (name, DOB, gender; optional email, nationality). Poor due diligence meant Trust Systems Software UK Ltd (t/a **Trustopia**), an employment screening firm, had access from **September 2018 to January 2020** and ran **over 22,000 searches** to age-verify people opening **online gambling accounts**. The DfE only learned of it from a press report. The ICO said the DfE **would have been fined £10m** but for the public-sector enforcement approach; a reprimand was issued instead. Findings: failure of due diligence over third-party access, failure of transparency, breaches of Arts 5(1)(a) and 5(1)(f). There was also an ICO **compulsory audit of the DfE in 2020** which found **139 recommendations**, over 60% of them urgent or high priority, with the DfE unable to demonstrate it had a proper lawful basis or transparency for the National Pupil Database.

**The lesson for this platform is precise**: the failure was not a hack. It was *access granted to a downstream party for a purpose outside the original one, with no monitoring*. Sub-processor governance and purpose enforcement are the actual control surface (§5, §6).

### 2.3 Children exercising their own rights

🔴 **Scotland**: DPA 2018 **s.208** — a person aged **12 or over is presumed** to have sufficient age and maturity to understand what it means to exercise a data protection right or give consent, unless the contrary is shown. https://www.legislation.gov.uk/ukpga/2018/12/section/208

🔴 **England, Wales, NI**: no fixed age. The test is whether the child has **sufficient maturity and understanding**. DfE guidance (https://www.gov.uk/guidance/data-protection-in-schools/dealing-with-subject-access-requests-sars):
- *"A child does not have to be a certain age to make a SAR."*
- *"If the young person is over 13, you should treat the request the same way as if an adult made it, provided there are no issues with the child's competency."*
- A parent with parental responsibility can make a SAR for the child, but for a child aged 13+ the school should normally **seek the child's consent** before releasing.

🔴 **Product consequence.** The controller (school) must be able to satisfy a SAR within **one calendar month**. The ICO found **~30%** of audited providers had product areas where pupil data could not be retrieved or erased, and that this was *"a common issue for almost half of the providers of management information systems."*

🟠 Therefore: build **self-service DSAR export** (complete, including derived data, model inputs, scores, and audit logs), **rectification**, and **erasure** covering every store — including analytics warehouses, caches, embeddings, logs, and backups. A pupil's model-derived risk score **is their personal data** and must appear in a SAR response, along with meaningful information about the logic (Arts 13(2)(f), 14(2)(g), 15(1)(h)).

---

## 3. Automated decision-making and profiling — the sharpest risk

### 3.1 The statutory text now in force

**Art 22A** (inserted by DUAA s.80, in force 5 Feb 2026):
> (1)(a) a decision is **based solely on automated processing** if there is **no meaningful human involvement** in the taking of the decision, and (b) a decision is a **significant decision** if (i) it produces a legal effect for the data subject, or (ii) it has a **similarly significant effect**.
> (2) When considering whether there is meaningful human involvement, a person must consider, among other things, **the extent to which the decision is reached by means of profiling**.

**Art 22B** — restrictions. A significant decision based entirely or partly on **Art 9(1) special category data** may **not** be taken solely automatically unless either (a) explicit consent, or (b) the decision is necessary for a contract with the data subject *or required/authorised by law* **and** Art 9(2)(g) applies. Art 22B(4): a significant decision may not be taken solely automatically where the processing relies on **Art 6(1)(ea)** recognised legitimate interests.

**Art 22C** — safeguards. The controller must provide measures that: (a) inform the data subject about the decision; (b) enable them to make representations; (c) enable them to obtain **human intervention** from the controller; (d) enable them to **contest** the decision.

**Art 22D** — Secretary of State may define by regulations what counts as meaningful human involvement and what counts as similarly significant, and may add safeguards. **No such regulations and no ICO guidance on "meaningful human involvement" have been finalised yet.** This is a live regulatory unknown.

### 3.2 When does "this pupil is at risk" become a significant decision?

🔴 The ICO's children-specific ADM guidance is directly on point (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/what-if-we-want-to-profile-children-or-make-automated-decisions-about-them/):

> *"A decision has a similarly significant effect for a child if it has an equivalent impact on their circumstances, behaviour, opportunities or choices. For example, a decision that **significantly impacts their health or access to education**. In extreme cases, significant decisions might exclude or discriminate against the child."*

And its worked example: an automated system determining eligibility for **free school meals** produces a **legal effect**.

So: an insight that says *"pupil X is at risk"* is **not itself** a significant decision. It becomes one when it drives, or is treated as driving, an outcome such as:
- setting/streaming or subject-option restriction;
- removal from or entry into intervention groups, alternative provision, or off-rolling decisions;
- exam entry tier decisions (foundation vs higher);
- exclusion, isolation, or behaviour-sanction escalation;
- SEND referral or withdrawal of support;
- allocation or removal of a bursary, transport, or FSM-linked provision;
- predicted grades submitted to UCAS or an exam board.

🔴 And critically: because these datasets include **SEND/EHCP and health** (Art 9 data), **Art 22B applies**. Even under the liberalised regime, a solely automated significant decision **based partly on special category data** requires explicit consent or contract/law + Art 9(2)(g). Explicit consent from a child in a school power-imbalance context is not freely given and is not viable. **So the special category route is effectively closed.**

🔴 ICO's overall steer, still valid post-DUAA: Recital 71 says such decisions *"should not concern a child"*; the ICO reads this as *"such processing of children's personal data should not be the norm"* and states plainly: **"It is possible for you to profile or make automated decisions about children. However, you should avoid doing so wherever possible."**

### 3.3 Required safeguards — the design answer

🔴 **Design the product so Art 22A/B/C never engage**, by making genuine human involvement structurally necessary. That means:

1. **No auto-actioning.** The system produces information for a professional; it never triggers a workflow, a letter, a group assignment, or a status change on its own.
2. **Meaningful, not token, human involvement.** ICO: *"you must ensure it is active and not just a token gesture."* Design against automation bias (an ICO-named bias category): show the evidence, show the counter-evidence, show the confidence interval, force the teacher to record their own judgement and rationale before the flag can be acted on, and make "disagree" as cheap a click as "agree".
3. **Explanation by default.** Show which features drove the score, with magnitudes. Never ship an unexplained score.
4. **Contest route.** Pupil/parent-facing mechanism to challenge a flag, routed to the school, logged.
5. **Full audit trail** of every score, version, input snapshot, who saw it, what they did.
6. **Profiling off by default** (AADC standard 12) — school opts in per feature, per cohort.
7. 🟢 Contractually prohibit the school from using outputs as the sole basis for any of the listed high-stakes decisions, and surface that prohibition in the UI at the point of use.

### 3.4 The public and political record — why this is not merely a legal problem

- **Ofqual, summer 2020.** The A-level "standardisation" algorithm downgraded ~39% of teacher-assessed grades, with a documented class gradient (small cohorts at independent schools protected; large state-school cohorts penalised). Ofqual's own impact assessment misapplied Art 22; it asserted no ADM was taking place because teachers and exam board officers were "involved". The policy was abandoned within days under mass public protest ("**the algorithm**" became a political epithet). ICO commentary and legal analysis: https://www.pinsentmasons.com/out-law/news/exam-results-put-reliance-on-algorithms-in-the-spotlight · https://en.wikipedia.org/wiki/2020_United_Kingdom_school_exam_grading_controversy
  **Lesson:** in UK education, an algorithm that ranks children is a *political* object. Public tolerance is near zero, and "there was a human in the loop somewhere" is not a defence anyone accepted.
- **What Works for Children's Social Care, September 2020.** Machine-learning models trialled across four local authorities **failed to identify roughly four in five children who went on to be at risk** (~20% sensitivity at the operating points tested), while generating substantial false positives. https://www.communitycare.co.uk/2020/09/10/evidence-machine-learning-works-well-childrens-social-care-study-finds/
- **Guardian investigation, 2018–2019.** Bristol, Thurrock, Hackney, Newham and Brent using predictive analytics (Xantura and others) on children's data — indicators included domestic abuse history, youth offending and **truancy**. Sustained criticism over consent, transparency and stigmatisation; several programmes were subsequently wound down.
- Academic scoping reviews consistently find that models in child welfare **lack transparency, rarely publish error rates, and rarely test for algorithmic bias or the harms of false positives**.

🟢 **Strategic implication.** Positioning matters as much as architecture. A product framed as *"predicts which children will fail"* invites the Ofqual/social-care backlash. A product framed as *"surfaces the data a teacher already has, faster, with the evidence attached, and never decides anything"* is defensible. Also: publish your accuracy. The above cases were fatal partly because accuracy was never disclosed.

---

## 4. DPIA

### 4.1 Is a DPIA mandatory? Yes — several times over.

🔴 Art 35(1) plus the ICO's list of processing likely to result in high risk (https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/). The ICO's rule of thumb is that **two** European-guideline criteria indicate a DPIA; this product hits essentially all of them:

| ICO / EDPB criterion | How it is triggered |
|---|---|
| Evaluation or scoring | Risk scores, predictions, root-cause attribution |
| Systematic and extensive profiling with significant effects (Art 35(3)(a)) | Per-pupil profiles used in educational decisions |
| Large-scale special category data (Art 35(3)(b)) | SEND/EHCP, health, ethnicity across whole cohorts/MATs |
| Data concerning **vulnerable data subjects** | ICO: *"children are regarded as vulnerable"*; SEND pupils doubly so |
| **Matching or combining datasets** | MIS + attendance + behaviour + assessment + reading age |
| **Innovative technology** (incl. AI) | Explicitly listed; DPIA required in combination with any other criterion |
| **Large-scale profiling** | On the ICO's own list — **DPIA required automatically** |
| **Data matching** | On the ICO's own list — **DPIA required automatically** |
| **Denial of service** | Decisions about access to a service/opportunity based to any extent on ADM or involving special category data |
| Targeting of children/vulnerable individuals | Use of children's data for profiling or ADM |
| Invisible processing | Pupils/parents did not supply data to you directly (Art 14) |

🔴 **A DPIA is legally required before processing begins.** Two DPIAs actually exist here: the **school's** (theirs, but you must supply the material for it), and, for any processing where you are a controller, **your own**. The ICO found **over 40%** of edtech providers had done no DPIA at all — usually because they'd wrongly decided they were a processor.

### 4.2 Required content (Art 35(7))

🔴 Minimum: (a) systematic description of processing operations and purposes, including any legitimate interests pursued; (b) assessment of **necessity and proportionality**; (c) assessment of **risks to the rights and freedoms of data subjects**; (d) the measures envisaged to address risks, including safeguards, security measures and mechanisms to ensure protection of personal data and demonstrate compliance.

ICO findings on what edtech DPIAs get wrong — fix all of these:
- assessed risk **to the organisation** rather than **to the child**;
- no DPO advice recorded (Art 35(2) requires you to seek it);
- no evidence of **consultation with data subjects or their representatives** (Art 35(9)) — for this product that means pupils, parents, teachers, SENDCos;
- no senior leadership sign-off;
- not kept updated when the product changed.

🟠 **What a MAT DPO will actually want handed to them:** a completed vendor DPIA, a pre-filled school DPIA the DPO can adapt, a data-flow diagram, a ROPA extract, the LIA (if any), the Art 28 DPA, sub-processor list, security schedule, retention schedule, and the bias/fairness test report. Shipping this pack is the single highest-leverage sales asset you can build.

**Templates and sector references:**
- DfE data protection in schools hub: https://www.gov.uk/guidance/data-protection-in-schools (DPIA guidance sits under EdTech procurement: https://www.gov.uk/guidance/data-protection-in-schools/procuring-educational-technology-edtech)
- ICO "How do we do a DPIA?" + ICO DPIA template: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/how-do-we-do-a-dpia/
- Children's Code **Annex D: DPIA template** — child-specific, use this one.

### 4.3 Prior consultation with the ICO

🔴 Art 36(1): you must consult the ICO **before processing** if the DPIA indicates the processing **would result in a high risk in the absence of measures taken to mitigate the risk** — i.e. if, after applying all your mitigations, a **high residual risk** remains. The ICO must respond within 8 weeks (extendable by 6). Proceeding despite unmitigated high residual risk without consulting is itself an infringement (Art 83(4)(a) — up to £8.7m / 2% turnover).

🟢 Realistically: if your DPIA concludes "high residual risk" you should change the design, not consult. But if the platform ever moves into safeguarding prediction or automated intervention allocation, prior consultation becomes the honest answer.

---

## 5. Security and assurance: what a MAT DPO will actually demand

### 5.1 The DfE standards that frame the conversation

- **Digital and technology standards for schools and colleges**: https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges
- **Cyber security standards for schools and colleges**: https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges/cyber-security-standards-for-schools-and-colleges — includes: conduct annual cyber risk assessments; protect accounts with **MFA**; role-based least-privilege access; regular patching; firewalls; **backups with an offline/immutable copy**; incident response plan; staff training. DfE notes **Cyber Essentials is a funding-agreement requirement for colleges**, and that schools should ask outsourced IT whether they hold **Cyber Essentials or Cyber Essentials Plus**.
- **Generative AI in education** (policy paper): https://www.gov.uk/government/publications/generative-artificial-intelligence-in-education/generative-artificial-intelligence-ai-in-education
- **Generative AI: product safety standards** (first published 22 Jan 2025 as "product safety expectations"; substantially expanded **19 January 2026** with new standards on cognitive development, emotional and social development, mental health, and manipulation): https://www.gov.uk/government/publications/generative-ai-product-safety-standards/generative-ai-product-safety-standards

Sections of the DfE product safety standards that apply to a teacher-facing analytics product:
- **Stated purpose**: declare target demographic *including SEND status*, learning focus; **"Suppliers should not exaggerate the impact or capabilities of their tools. Any claims should be supported by robust and transparent evidence."**
- **Educational use cases**: this product is use case 3, *"Assessment and analytics"*, and arguably 7, *"Administrative and management"*. Both are largely teacher-facing, which mercifully takes you out of most of the filtering / anthropomorphisation / cognitive-offloading standards aimed at learner-facing chatbots.
- **Security**: permission levels per user, prompt patching, pre-release safety testing, robust authentication, **"be compatible with the Cyber Security Standards for Schools and Colleges."**
- **Privacy and data protection**: age-appropriate privacy notice presented at intervals; state **where data is processed** and safeguards if outside UK/EU; **conduct a DPIA during development and across the full lifecycle**; comply with the ICO's Children's code; and — decisive — **"not collect, store, share or use personal data for any commercial purposes, including further model training and fine-tuning, without confirmation of appropriate lawful basis."**
- **Intellectual property**: pupil and teacher inputs must not be used for training, fine-tuning, product improvement or development without the copyright owner's permission (parent/guardian for under-18s).
- **Design and testing**: testing with a diverse and realistic range of users; DfE cross-references the **Public Sector Equality Duty**, **Equality Act 2010**, ICO AI guidance on bias, and **Arts 13(2)(f)/14(2)(g)** on disclosing ADM logic.
- **Governance**: documented risk assessment per product; formal complaints mechanism; published AI safety policies.

### 5.2 Certifications — what matters and how much

| Assurance | Status |
|---|---|
| **Cyber Essentials** | 🟠 Effectively mandatory as a floor. Cheap (~£300–600). Get it before your first pitch. |
| **Cyber Essentials Plus** | 🟠 Increasingly demanded by MATs and by CCS/DfE frameworks. Get it before your first MAT-scale deal. |
| **ISO/IEC 27001** | 🟠 Expected by larger MATs and at framework level; the credible mid-term target (12–18 months). |
| **SOC 2 Type II** | 🟢 UK schools mostly don't ask. Useful only if you later sell to US/international schools or to enterprise partners. Do not prioritise over ISO 27001 for a UK MAT market. |
| **Independent penetration testing** | 🟠 Annual, with a shareable summary letter. DfE tells schools to ask whether the supplier *"publishes penetration test reports."* |
| **UK data residency** | 🟠 Practically a hard requirement. DfE's own worked example has a school **rejecting** a supplier because data was stored outside the UK and AI training couldn't be turned off. Host all pupil data in UK regions. |

### 5.3 Contractual expectations

🔴 **Art 28(3)** requires a written contract covering: subject matter, duration, nature and purpose, type of personal data, categories of data subjects; process only on documented instructions; confidentiality commitments; Art 32 security; **sub-processor rules (Art 28(2), (4))**; assistance with data subject rights; assistance with Arts 32–36; deletion or return at end of contract; audit and inspection rights.

🔴 **Breach notification:** the controller must notify the ICO within **72 hours** of becoming aware (Art 33(1)). **As processor you must notify the school "without undue delay" of ALL personal data breaches — regardless of risk level (Art 33(2)).** The ICO specifically found that over 70% of audited providers misunderstood this, wrongly filtering to "high risk only". Contract for a hard internal SLA (24 hours to the school is the norm buyers ask for).

🟠 Sub-processors: publish a **named list with locations and purposes**, give **advance notice with a right to object** for changes, do documented due diligence, and re-check annually. The ICO found ~30% had no proper authorisation and ~50% did no meaningful ongoing checks — including one provider whose sub-processor's own terms reserved the right to **retain a copy of children's data to train its AI**. Read every downstream ToS.

🟠 Retention and deletion: **school-configurable retention periods** (an ICO finding: fixed universal retention with no school override made providers controllers). State explicitly what happens at expiry. **Delete means delete** — the ICO criticised providers who anonymised instead of deleting while telling schools they deleted. Provide **certificates of deletion** at contract end, covering backups and caches with stated timescales.

🟠 Exit: full export in a usable format, agreed timescales, minimal downtime, confirmed deletion afterwards.

---

## 6. Privacy-enhancing architecture — recommendations

### 6.1 Pseudonymisation vs anonymisation
ICO guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/ (note: under review post-DUAA).

Key doctrine: **identifiability is a spectrum**; the test is the *"means reasonably likely to be used"* by you *or by anyone who might obtain access*, judged by cost, time and available technology; apply the **motivated intruder test**. Pseudonymised data **remains personal data**. The act of anonymising is itself processing of personal data.

**Recommendation:** 🔴 Treat everything in the platform as personal data. Do not claim anonymisation for anything a school could re-link. Use pseudonymisation as a *security control* (§6.2), never as a scope-escape. Only claim anonymity for outputs that pass a documented motivated-intruder assessment with a written methodology — and note the ICO caught a provider whose "anonymisation" was pseudonymisation with a retained key.

### 6.2 Structural pseudonymisation in the data model
**Recommendation: 🟢 strongly adopt.** Follow the ICO's model-good edtech example: the analytics core operates on **opaque per-tenant pupil tokens**; the name/DOB/UPN mapping lives in a separate, separately-encrypted identity store; only the school-facing presentation layer re-joins them, at query time, for authorised staff. Benefits: dramatically reduces breach severity, is explicitly incentivised by Recital 29 and Art 25/32, and demos extremely well to a DPO.

### 6.3 Tenant-level encryption and per-tenant key isolation
**Recommendation: 🟠/🟢 adopt.** Per-tenant data encryption keys held in a KMS/HSM, wrapped by a tenant-specific key. Prevents a single credential compromise from yielding all schools' data, makes deletion provable (destroy the key), and is a direct answer to "how do we know MAT B can't see MAT A's data". Consider customer-managed keys for the largest MATs as a paid tier. Full BYOK is 🟢 nice-to-have; per-tenant DEKs are the practical minimum.

### 6.4 Row-level security
**Recommendation: 🔴 mandatory, and belt-and-braces.** RLS in the database (e.g. Postgres/Supabase RLS keyed on tenant_id + role) **plus** tenant scoping in the application layer **plus** automated cross-tenant leakage tests in CI. Never rely on ORM-level filtering alone. Also enforce **intra-tenant** RLS: a class teacher should not see the whole MAT; SEND and any health-adjacent fields should be role-gated to SENDCo/SLT with access logged.

### 6.5 Purpose limitation enforced in code
**Recommendation: 🟢 adopt — this is the differentiator.** Tag every column with a declared purpose and lawful basis; make every query path assert a purpose; deny by default. Make secondary use *technically impossible* rather than policy-prohibited. Emit an immutable access log per record read. This is the direct engineering answer to the DfE/Trustopia failure mode and to seven of the ICO's ten edtech findings.

### 6.6 k-anonymity thresholds for cross-school benchmarking
**Recommendation: 🟠 mandatory if you benchmark at all.** Minimum cell size (k ≥ 10 is a defensible floor for school data; k ≥ 5 is the NHS/ONS-style minimum and is too low for small SEND or ethnicity subgroups), suppression of small cells, suppression of complementary cells to prevent differencing attacks, no year-on-year differencing that reconstructs an individual. **A cohort of 3 SEND EAL pupils in one year group is identifiable to anyone in the school.** Combine with l-diversity thinking for sensitive attributes. Document the methodology and re-run a motivated-intruder assessment.

### 6.7 Differential privacy
**Recommendation: 🟢 optional, targeted.** Genuine DP adds real value only for published or cross-tenant statistics, and typical school cohort sizes (n = 30–200) mean the noise required for a meaningful ε will destroy utility. **Do not** apply DP to within-school pupil-level insight — it would make the product wrong. **Do** consider DP (or simply not shipping the feature) for any public league-table-like or cross-MAT comparison output. Prefer suppression + k-anonymity as the primary control.

### 6.8 Federated / in-tenant analytics
**Recommendation: 🔴 adopt as the core architecture.** Raw pupil data stays in the school's tenant; computation runs in-tenant; only aggregates that pass the k-threshold ever leave. This:
- keeps you cleanly a **processor**;
- keeps the **Children's Code** out of scope (subject to the three-criteria test);
- makes "we never pool your children's data" a true and checkable claim;
- makes deletion, residency and exit trivially demonstrable.
Federated *learning* (training a shared model on gradients) is 🟢 a possible later step but note gradients can leak training data and it still requires a controller-side lawful basis. Do not start there.

### 6.9 Synthetic data for development
**Recommendation: 🔴 mandatory policy, 🟢 in ambition.** No real pupil data in dev, staging, test, demo, or debugging — ever. Generate structurally realistic synthetic cohorts (correct marginal distributions, correlations, missingness patterns, SEND/PP/EAL prevalences). The ICO singled this out as good practice. Where a production incident genuinely requires real data, use a break-glass process: named approver, time-boxed access, full audit, pseudonymised view only.

### 6.10 Sending pupil data to LLM APIs
This is the highest-risk single design decision in the product.

🔴 **Hard rules:**
1. **Never send special category data (SEND/EHCP, health, ethnicity) or safeguarding text to a third-party LLM API.** Period.
2. **Never send direct identifiers.** Pupil name, UPN, DOB, address, parent contact. Substitute tokens ("Pupil A") and re-hydrate client-side.
3. **Zero data retention / no-training contractual commitment in writing**, in the DPA, from the model provider — and check the provider's *own* sub-processor terms (the ICO found a sub-processor reserving the right to keep children's data for AI training).
4. **UK or EU processing region**, contractually pinned. If the provider can only offer US processing, you need an **Art 46 transfer mechanism** (UK IDTA or EU SCCs + UK Addendum) plus a **Transfer Risk Assessment**, and you will still lose deals — DfE's own guidance shows a school rejecting a supplier on exactly this point. Assume UK/EU residency is a gate, not a preference.
5. **Sub-processor disclosure and school right to object** before any LLM provider is added.
6. **Log every prompt and completion** for audit, retained under the same retention rules, and DSAR-exportable.
7. **Never let the LLM be the decision-maker.** Its output is drafting/summarisation for a human, never a score, never a flag, never a routing decision.

🟢 **Preferred architecture, in descending order of safety:**
1. Deterministic/statistical analytics for anything about a pupil; LLM used only for *narrative rendering* of already-computed, already-pseudonymised aggregates.
2. In-tenant / self-hosted open-weights model for pupil-adjacent text, so nothing leaves the tenant boundary.
3. UK-region enterprise API with zero-retention DPA, tokenised inputs, special-category redaction enforced by a pre-flight filter that fails closed.

🟠 A school-configurable **"no external AI processing"** switch (which degrades features rather than disabling the product) will win procurement conversations and satisfies AADC standard 7.

---

## 7. The ICO AI and data protection risk toolkit, and fairness/bias

**Sources:**
- AI and data protection risk toolkit: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/ai-and-data-protection-risk-toolkit/
- Guidance on AI and data protection: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/
- Annex A: Fairness in the AI lifecycle: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/annex-a-fairness-in-the-ai-lifecycle/
- Audit framework — AI toolkit, Discrimination and Bias: https://ico.org.uk/for-organisations/advice-and-services/audits/data-protection-audit-framework/toolkits/artificial-intelligence/discrimination-and-bias/

The toolkit is organised around control measures, risks, "ways to meet our expectations" and "options to consider", across: governance and accountability; transparency; contracts and third parties; data minimisation; information security; data protection by design; **statistical accuracy**; **discrimination and bias**; **human review**; plus a tracker template. It is the closest thing to an ICO audit script and should be worked through line by line and evidenced.

🔴 **Legal hooks.** Unfair outcomes breach **Art 5(1)(a)** (fairness). Failure to design against them breaches **Art 25**. Discriminatory outputs engage the **Equality Act 2010** and, through the school, the **Public Sector Equality Duty (s.149)** — which DfE explicitly cross-references in the GenAI product safety standards.

### 7.1 Bias testing that would be expected

🔴/🟠 For a model that flags pupils at risk, expect to evidence:

**Before build:**
- Problem formulation: what does "at risk" actually mean, operationally, and who decided? Document why the model is applied to these pupils and not others (an explicit ICO expectation).
- Participatory design: consult teachers, SENDCos, pupils, parents. Record it in the DPIA (Art 35(9)).

**On data:**
- Check representativeness and class balance across **ethnicity, SEND status, EHCP, EAL, FSM/Pupil Premium, sex, year group, and school type**.
- Test for **historical/structural bias**: attendance, behaviour points and exclusions are *themselves* products of documented differential treatment. A model trained on behaviour incidents will learn who gets sanctioned, not who misbehaves. This is the deepest technical problem in the product.
- Identify and handle **proxies**: postcode, FSM, EAL, first language, and even reading age function as proxies for ethnicity and deprivation. ICO calls this "anti-classification" — identify and exclude proxies, or include protected characteristics deliberately in order to *measure* and correct.

**On the model:**
- Report performance **disaggregated by subgroup and by intersection** (ICO explicitly names intersectional discrimination): true positive rate, false positive rate, precision, calibration, per subgroup.
- Set and publish an explicit fairness criterion (equalised odds / equal opportunity / calibration) and acknowledge the impossibility results — you cannot satisfy all simultaneously; document which you chose and why.
- **False positives are the primary harm.** A wrongly flagged PP/SEND/Black Caribbean pupil is stigmatised, subjected to intervention they don't need, and has expectations lowered — precisely the "detrimental use of data" the Children's Code prohibits. ICO expects analysis of *"reliance on false positives and true negatives."*
- Mitigations across all three stages the ICO names: **pre-processing** (reweighting, resampling), **in-processing** (fairness constraints), **post-processing** (subgroup-specific thresholds — legally delicate under the Equality Act, take advice).
- Guard against **automation bias** in the humans — ICO lists it as a bias type to mitigate.

**On deployment:**
- Pre-go-live discrimination testing, documented, with human-in-the-loop validation by domain experts, and a documented go/no-go.
- **Ongoing monitoring** with drift and disparity alerts; re-test on new datasets; a documented rollback trigger.
- Decommissioning plan.

🔴 A specific legal trap: to test for bias you need **ethnicity** data — Art 9 data. Processing it for that purpose is supportable under **DPA 2018 Sch 1 para 8 (equality of opportunity or treatment)**, but **para 8(3) forbids using that condition for "measures or decisions with respect to a particular data subject."** So: **ethnicity may be used for aggregate fairness evaluation but must be excluded from any individual pupil's score.** This is a hard architectural boundary — separate the fairness-evaluation pipeline from the inference pipeline, with different data access, different purposes tags, and different lawful bases.

🟢 **Publish an annual model card / fairness report.** Given the What Works and Ofqual history, voluntary transparency about accuracy and subgroup performance is both the strongest trust asset and the best insurance against the "secret algorithm ranks children" narrative.

---

## 8. Consolidated checklist

**🔴 Legally required (non-negotiable)**
1. Art 28 DPA with every school/MAT, with specific processing instructions — not boilerplate.
2. Stay a processor: no model training, product development, benchmarking, analytics or anonymisation on tenant pupil data without becoming a controller and doing the full controller stack.
3. Your own ROPA (Art 30) and, for any controller-role processing, your own lawful basis + Art 9 condition + LIA + Appropriate Policy Document.
4. DPIA before processing (Art 35), child-risk-focused, DPO advice recorded, stakeholders consulted, senior sign-off, kept live. Art 36 prior consultation if high residual risk remains.
5. No solely automated significant decisions about pupils. Art 22B closes the special category route anyway.
6. Art 22C-grade safeguards (information, representations, human intervention, contest) wherever there's any doubt.
7. Full data-subject-rights capability across every store including derived data, logs, embeddings and backups; one-month SAR turnaround.
8. Breach: notify the school of **all** breaches without undue delay (Art 33(2)); support the school's 72-hour ICO clock.
9. Art 32 security: encryption at rest and in transit, MFA, least privilege, audit logging, tested restore.
10. UK data residency, or a valid Art 46 mechanism plus TRA.
11. Documented sub-processor authorisation, due diligence and ongoing checks.
12. Retention schedule, school-configurable, with real deletion and certificates.

**🟠 Buyer-expected**
13. Cyber Essentials now; Cyber Essentials Plus before MAT-scale; ISO 27001 on the roadmap.
14. Annual penetration test with shareable summary.
15. A procurement pack: vendor DPIA, pre-filled school DPIA, data-flow diagram, DPA, sub-processor list, security schedule, retention schedule, fairness report.
16. Conformance with the Children's Code (all 15 standards) and DUAA's Art 25 children's higher protection duty.
17. Alignment with DfE's Generative AI product safety standards and the Cyber security standards for schools and colleges.
18. School-side configurability: retention, optional fields, feature toggles, "no external AI" switch — everything off by default.

**🟢 Best practice / differentiator**
19. In-tenant (federated) analytics; only k-anonymised aggregates leave.
20. Structural pseudonymisation with a separated identity store; per-tenant encryption keys.
21. Purpose limitation enforced in code, with per-record access logs.
22. Synthetic data for all non-production environments.
23. Published model card with disaggregated accuracy and fairness metrics, updated annually.
24. Separate, ring-fenced fairness-evaluation pipeline (Sch 1 para 8) that cannot feed individual scores.
25. No safeguarding narrative data in v1.

---

## 9. Source list

**Legislation**
- Data (Use and Access) Act 2025 — https://www.legislation.gov.uk/ukpga/2025/18
- DUAA s.80 (Arts 22A–22D) — https://www.legislation.gov.uk/ukpga/2025/18/section/80/enacted
- DPA 2018 Sch 1 — https://www.legislation.gov.uk/ukpga/2018/12/schedule/1/enacted
- DPA 2018 s.208 (Scotland, age 12) — https://www.legislation.gov.uk/ukpga/2018/12/section/208

**ICO**
- Edtech examined (24 June 2026) — https://ico.org.uk/action-weve-taken/audits-and-overview-reports/2026/06/edtech/ · PDF https://ico.org.uk/media2/13yfm55z/edtech-examined-key-findings-from-our-audits.pdf
- Children's code and education technologies — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/the-children-s-code-and-education-technologies-edtech/
- Age appropriate design code — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/
- AADC standard 12 (Profiling) — .../12-profiling/
- Profiling children / ADM — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/children-and-the-uk-gdpr/what-if-we-want-to-profile-children-or-make-automated-decisions-about-them/
- When do we need to do a DPIA — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/
- How do we do a DPIA — .../how-do-we-do-a-dpia/
- AI and data protection risk toolkit — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/ai-and-data-protection-risk-toolkit/
- Annex A: fairness in the AI lifecycle — .../annex-a-fairness-in-the-ai-lifecycle/
- Audit framework: AI — Discrimination and Bias — https://ico.org.uk/for-organisations/advice-and-services/audits/data-protection-audit-framework/toolkits/artificial-intelligence/discrimination-and-bias/
- Anonymisation guidance — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/
- DUAA: what does it mean for organisations — https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/
- DfE reprimand, 2 Nov 2022 — https://ico.org.uk/media2/migrated/4022280/dfe-reprimand-20221102.pdf

**DfE / gov.uk**
- Data protection in schools — https://www.gov.uk/guidance/data-protection-in-schools
- Data processing a school is permitted to do — .../data-processing-a-school-is-permitted-to-do
- Procuring educational technology (EdTech) — .../procuring-educational-technology-edtech
- Subject access requests — .../dealing-with-subject-access-requests-sars
- Generative AI and data protection in schools — .../generative-artificial-intelligence-ai-and-data-protection-in-schools
- The Data Use and Access Act 2025 — .../the-data-use-and-access-act-2025
- Generative AI: product safety standards — https://www.gov.uk/government/publications/generative-ai-product-safety-standards/generative-ai-product-safety-standards
- Generative AI in education — https://www.gov.uk/government/publications/generative-artificial-intelligence-in-education/generative-artificial-intelligence-ai-in-education
- Cyber security standards for schools and colleges — https://www.gov.uk/guidance/meeting-digital-and-technology-standards-in-schools-and-colleges/cyber-security-standards-for-schools-and-colleges

**Context / cautionary**
- Community Care on the What Works for Children's Social Care ML review — https://www.communitycare.co.uk/2020/09/10/evidence-machine-learning-works-well-childrens-social-care-study-finds/
- Pinsent Masons on Ofqual and Art 22 — https://www.pinsentmasons.com/out-law/news/exam-results-put-reliance-on-algorithms-in-the-spotlight
- 2020 UK exam grading controversy — https://en.wikipedia.org/wiki/2020_United_Kingdom_school_exam_grading_controversy
- Defend Digital Me on the LRS chronology — https://defenddigitalme.org/the-learner-records-service-data-breach-and-ico-audit-a-connected-chronology/
- Burges Salmon analysis of the ICO edtech audit — https://www.burges-salmon.com/articles/102ndb0/ico-spotlight-on-edtech-key-data-protection-lessons-from-the-icos-latest-audit/
