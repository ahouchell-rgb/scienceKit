# UK School Data, MIS & Analytics Landscape

**Research brief 02 — competitive and data-availability map for a "Gotham for schools" entity/graph intelligence platform**
Date: 2026-07-27. All claims sourced inline. Prices are indicative list prices found publicly; real prices are almost always negotiated and LA/MAT-discounted.

---

## 0. Executive orientation

Three structural facts shape everything below.

1. **The MIS market just flipped.** Arbor has overtaken ESS SIMS. Across the UK: Arbor 9,858 schools (37%), ESS SIMS 7,636 (28%), Bromcom 4,893 (18%), SEEMiS 2,445 (9%). In England alone Arbor is ~44%, SIMS ~32%, Bromcom ~16% — SIMS was 85% a decade ago ([Tes](https://www.tes.com/magazine/news/general/ess-sims-loses-market-dominance-school-information-systems-mis), [WhichMIS](https://www.whichmis.com/arbor-takes-no-1-spot-from-ess-sims/)). Practically: you need Arbor + Bromcom + SIMS coverage, and the cloud-native two (Arbor, Bromcom) have real APIs.
2. **Data extraction is a solved commodity.** Wonde is effectively the sector standard — it is the DfE's own contracted route for the daily attendance collection ([Norfolk CC](https://www.schools.norfolk.gov.uk/article/78012/School-Attendance-Data-sharing-and-statutory-returns-Changes-to-data-collection---May-2026)). Groupcall Xporter is in 20,000+ schools ([Groupcall](https://www.groupcall.com/product/xporter)). Assembly was absorbed into Groupcall/Community Brands. Plumbing is not a moat.
3. **The regulatory floor just moved up.** The ICO's *Edtech examined* report (June 2026) audited 28 edtech providers and issued 596 recommendations; ~80% could not demonstrate data-protection-by-design for children, and the ICO flagged vendors using children's data for product development and AI training ([ICO](https://ico.org.uk/media2/13yfm55z/edtech-examined-key-findings-from-our-audits.pdf), [Burges Salmon](https://www.burges-salmon.com/articles/102ndb0/ico-spotlight-on-edtech-key-data-protection-lessons-from-the-icos-latest-audit/), [Digital Staffroom](https://www.thedigitalstaffroom.org/the-ico-has-just-audited-28-edtech-providers-the-findings-should-concern-every-school/)). A statutory edtech code is being trailed. A cross-domain pupil-graph product is *exactly* the shape the ICO is now watching.

---

## 1. What data actually exists in a UK secondary school, and where it lives

### 1.1 The MIS — the spine

| MIS | Vendor / owner | Share (UK) | What it holds | API reality |
|---|---|---|---|---|
| **Arbor** | The Key Group | ~37% UK / ~44% England | Full: roll, demographics, attendance registers, behaviour & rewards, assessment marksheets, timetable, groups/sets, interventions, comms, MAT MIS layer | Modern REST API + Developer Portal; school approves partner app in *System > Partner Apps* ([Arbor](https://support.arbor-education.com/hc/en-us/articles/360009421273-Setting-up-and-managing-third-party-API-integrations-in-Arbor)) |
| **ESS SIMS** | Education Software Solutions (Parthenon/PE-owned) | ~28% UK | Same domains, plus decades of legacy modules; historically SQL Server on-prem, now SIMS Next Gen | Restrictive. In 2024 the CMA was drawn in after SIMS told customers that sending DB copies to third parties breached contract ([Schools Week](https://schoolsweek.co.uk/dfe-looks-to-reduce-mis-legal-risk-amid-200m-turf-war/)) |
| **Bromcom** | Bromcom (independent) | ~18% UK | Full MIS incl. strong native behaviour, assessment, cashless catering, MAT "Vision" analytics | **Free open APIs** — "a large range of APIs that anyone can use, free of charge"; school admin creates an API user account ([Bromcom docs](https://docs.bromcom.com/knowledge-base/managing-third-party-integrations/)) |
| **ScholarPack / Integris** | The Key Group | Being sunset | Primary-focused | Migrating to Arbor |
| **iSAMS / Engage** | iSAMS (independent sector) | Independent schools | Same domains + boarding, fees, co-curricular | REST API, strong in independent sector |
| **Progresso / Advanced** | Advanced | Small residual | Legacy | Limited |
| **SEEMiS** | Scotland | 9% UK | Scottish-only | Closed |

**Everything in a secondary school ultimately reconciles to the MIS UPN/pupil ID.** That is your entity resolution key: UPN (Unique Pupil Number, 13 chars, follows the child nationally), plus MIS-internal pupil ID, plus admission number. Staff have a TRN (Teacher Reference Number). Schools have a URN and LAESTAB from **GIAS** (Get Information About Schools) — that's your free, open, school-level dimension table.

### 1.2 Attendance

Session-level registers, twice daily, coded with the DfE register codes. The 2024 code overhaul (effective 19 Aug 2024) matters because it introduced sub-codes:

| Group | Codes |
|---|---|
| Present | `/` AM, `\` PM, `L` late before registers close |
| Approved educational activity | `B` educated off site, `K` LA-arranged provision, `P` sporting, `V` educational visit, `W` work experience |
| Authorised absence | `C` leave, `C1` regulated performance/employment abroad, `C2` part-time timetable, `E` excluded no AP, `I` illness, `J1` interview, `M` medical/dental, `R` religious observance, `S` study leave, `T` traveller |
| Unauthorised | `G` unagreed holiday, `N` no reason yet, `O` unauthorised, `U` late after close |
| Not counted in possible attendance | `D` dual registration, `Q` no LA transport/boarding access, `X` non-statutory age, `Y1–Y7` unavoidable causes, `Z` not on roll |

([ScholarPack](https://support.scholarpack.com/hc/en-gb/articles/20903075403549-New-Attendance-Codes-as-of-19th-August-2024), [Suffolk Learning](https://suffolklearning.com/wp-content/uploads/2024/06/Attendance-Codes-Academic-Year-2024-25.pdf))

**The 2024/25 daily attendance collection is the single most important change for a product like yours.** From the start of 2024/25 it became *mandatory* for schools to share daily attendance with the DfE, collected automatically from electronic registers by Wonde under contract, at no cost to schools, with corrections up to 7 days later re-synced ([Arbor](https://support.arbor-education.com/hc/en-us/articles/18770475202077-Sharing-Your-Attendance-Data-with-the-DfE), [DfE guidance via GovWire](https://www.govwire.co.uk/news/department-for-education/guidance-share-your-daily-school-attendance-data-86308)). Consequences: (a) every school in England now has a live Wonde connection and an internal precedent for daily automated extraction; (b) the DfE publishes weekly national attendance statistics you can benchmark against ([Explore Education Statistics](https://explore-education-statistics.service.gov.uk/find-statistics/pupil-attendance-in-schools)); (c) the "we can't share data automatically" objection is dead.

Also present: **persistent absence (PA, <90%)** and **severe absence (<50%)** flags, lateness, and — separately from registers — **suspensions and permanent exclusions** with statutory reason codes.

### 1.3 Behaviour and rewards

- **MIS-native behaviour** (Arbor, Bromcom, SIMS): incident logs, positive/negative points, detentions, internal exclusion, linked to lesson/timetable slot and to the staff member who issued it. This is the richest teacher-linked dataset in a school and the most politically loaded.
- **ClassCharts** (owned by Tes): seating plans + behaviour points, huge secondary footprint ([ePraise comparison](https://www.epraise.co.uk/competitors)).
- **Class Dojo**: primary, effectively irrelevant to secondary.
- **ePraise, Satchel One's behaviour module, Go4Schools behaviour module** — overlapping alternatives.

Key structural point: a behaviour record has *pupil × teacher × subject × timetable period × room × time*. That's a five-way edge, and it is the raw material for both the best insights and the worst political fights.

### 1.4 Assessment, tracking and progress

- **In-MIS marksheets** — teacher assessment grades, 2–3 times a year post-*Making Data Work* (see §4).
- **SISRA Analytics** (Juniper) — 1,800+ secondaries; KS3/4/5 analysis, bespoke grade scales, Attitude-to-Learning (AtL) analysis alongside grades, and a Data Collaboration benchmark across 1,400+ schools ([Juniper](https://junipereducation.org/classroom-secondary/sisra-analytics)).
- **4Matrix** — secondary performance data, strong on results-day analysis and KS3 "life without levels"; more visual flightpaths, less drillable than SISRA per user reports ([EduGeek](https://www.edugeek.net/forums/mis-systems/165860-sisra-vs-4matrix-what-purchase.html)).
- **Insight Tracking** — primary-focused pupil tracking.
- **Go4Schools** — markbooks + behaviour + attendance + homework + reports + parent app; base "Starter" licence from **£1,519 + VAT p.a.** plus per-student cost, banded 0–399 / 400–799 / 800–1199 / 1200–1699 / 1700+ students, with 2–3 year and MAT discounts ([Go4Schools pricing](https://www.go4schools.com/pricing), [T&Cs](https://support.go4schools.com/support/solutions/articles/80001033517-go-4-schools-modular-terms-and-conditions-1-april-2025-)).
- **Juniper Sonar Tracker** — primary (consolidation of OTrack, Classroom Monitor, Pupil Asset, Target Tracker) ([Juniper](https://junipereducation.org/sonar-tracker/)).
- **Alps** — the post-16 value-added standard; 2025 offers dual benchmarks (2019 DfE national and 2025 Alps customer benchmark); Alps Connect does teaching-set/tutor-group analysis and "what-if" quality improvement planning ([Alps](https://alps.education/news/adding-value-post-16-in-2022-and-2023/)); ~10% cheaper via LA subscription routes ([Leeds for Learning](https://www.leedsforlearning.co.uk/Store/Contract/65349)).

### 1.5 National and benchmark datasets

| Dataset | What it gives you | Access |
|---|---|---|
| **FFT Aspire** | Pupil-level estimates/targets from KS2 priors, national benchmarking, attendance analytics, live-link to MIS | Subscription; new schools **£785 + £1.30/pupil**, Secondary Pupil Tracking add-on **£800 p.a.**; ~40% cheaper via LA ([FFT](https://fft.org.uk/fft-aspire/secondary-pupil-tracking/), [Leeds](https://www.leedsforlearning.co.uk/Article/168765)) |
| **ASP (Analyse School Performance)** | DfE's own school-level performance analysis | Free, DfE Sign-in |
| **IDSR** | Ofsted's pre-inspection data summary: context, ethnicity, SEN, prior attainment, cohort stability, disadvantage, attendance from the daily collection, 16–18 performance | Free via Ofsted/ASP; updated Nov, Dec, Feb, May ([GOV.UK](https://www.gov.uk/guidance/school-inspection-data-summary-report-idsr-guide), [Norfolk](https://www.schools.norfolk.gov.uk/article/74116/Inspection-Data-Summary-Report-IDSR-2025)) |
| **NPD (National Pupil Database)** | Pupil-level census + attainment + absence + exclusions, longitudinally, nationally | **Not commercially available.** Applications via the DfE Data Sharing Service; default route is the ONS Secure Research Service; **data cannot be downloaded** from the SRS ([GOV.UK](https://www.gov.uk/guidance/apply-for-department-for-education-dfe-personal-data), [UKAuthority](https://www.ukauthority.com/articles/ons-creates-secure-research-service-to-draw-on-schoolchildren-s-database/)) |
| **GIAS** | URN, LAESTAB, phase, trust, Ofsted, size, closure | Free bulk download |
| **Explore Education Statistics** | KS2/KS4/KS5 outcomes, absence, exclusions, workforce, at LA and school level | Free, machine-readable |

**Prior attainment**: KS2 scaled scores in reading and maths are the universal Y7 baseline in England and are transferred via CTF (Common Transfer File) from the primary school into the MIS. This is your single most valuable predictive covariate and it's already in the MIS.

### 1.6 Cognitive and reading measures

- **GL Assessment CAT4** — cognitive abilities (verbal, quantitative, non-verbal, spatial); near-universal Y7 baseline. **NGRT** — standardised reading age. **PASS** — attitudes to self and school. **PT Series** — progress tests in English/maths/science. Priced per pupil, quoted not listed ([GL](https://www.gl-assessment.co.uk/guides/how-to-buy/)).
- **Renaissance Accelerated Reader / STAR** — reading practice + STAR standardised reading age; STAR used in 7,000+ UK/IE schools; AR indicatively **~£9 per pupil per year** ([EEF trial](https://educationendowmentfoundation.org.uk/projects-and-evaluation/projects/accelerated-reader), [Renaissance UK](https://uk.renaissance.com/solutions/assessment/)).
- **CEM MidYIS / Yellis / Alis** — now consolidated as **Cambridge Secondary Insight (Baseline)** on a new platform ([CEM help](https://help.cem.org/hc/en-gb/articles/21706756463378), [Cambridge](https://www.cambridge.org/insight/secondary-assessments)). Note for the product: the CEM brand is being retired, so any integration should target Cambridge Insight.

Reading age is the highest-leverage variable for the specific insight you described ("trajectory dropped in Y9, root cause looks like reading age"). It is **not** in the MIS by default — it lives in GL's or Renaissance's platform and is usually imported as a flat file. That gap is a genuine product opportunity.

### 1.7 Homework and independent-practice platforms

| Platform | Data it holds | Notes |
|---|---|---|
| **Satchel One (Show My Homework)** | Homework set/submitted/late, by teacher & class | 1,500+ UK secondaries ([Satchel](https://www.teamsatchel.com/schools/secondary.html)) |
| **Sparx Maths / Sparx Science / Sparx Reader** | Per-question completion, time-on-task, accuracy, weekly compliance | Bespoke per-school pricing ([Sparx](https://sparxmaths.com/)) |
| **Educake** | Science/maths/geog quiz scores, per-topic | Unlimited accounts per subscription; 4+ school discounts ([Educake](https://www.educake.co.uk/pricing/)) |
| **Seneca** | Revision engagement, quiz scores | Premium **£646 ex VAT p.a.** for 600+ pupil schools ([Seneca](https://help.senecalearning.com/en/articles/13413714-seneca-for-schools-benefits-pricing-plans)) |
| **Century, Doddle, Carousel, Quizlet** | Adaptive/retrieval engagement | Fragmented |

These are the *behavioural* signals nobody joins to attainment. Sparx alone knows more about a pupil's actual effort than any grade in the MIS.

### 1.8 Safeguarding, careers, compliance

- **CPOMS** (StudentSafe/StaffSafe/Engage/Insight) — 20,000+ settings, market leader; tiered pricing on request ([CPOMS](https://www.cpoms.co.uk/pricing/)).
- **MyConcern** (Tes) — direct competitor ([Tes](https://www.tes.com/for-schools/safeguard-my-school)).
- **Unifrog** — careers/destinations/post-16 pathways.
- **Every (IRIS)** — compliance, H&S, HR, absence, assets, contracts; 12,000+ schools across the IRIS education suite ([Every](https://www.weareevery.com/), [IRIS](https://www.iris.co.uk/education/school-management-suite/every-compliance-by-iris/)).
- **The Key** — leadership/governance guidance and compliance content; owns Arbor.

**Safeguarding data is a hard boundary.** CPOMS/MyConcern records are need-to-know, restricted to DSLs, and must not flow into a general analytics graph. Design the product so it can consume a *flag* ("has an open safeguarding record", or nothing at all) but never the content. Getting this wrong is fatal.

### 1.9 Statutory censuses

School Census runs three times a year — Autumn (October), Spring (January), Summer (May) ([Oxfordshire](https://schools.oxfordshire.gov.uk/performance-and-information-team/school-census)). Items include: sex, ethnicity, first language (EAL), FSM eligibility, **FSM6** (eligible at any point in last 6 years — the Pupil Premium driver), SEN status (**K** = SEN Support, **E** = EHC Plan) and primary need, service child, LAC/PLAC, in-care status, exclusions, attendance, addresses/UPN. These feed DSG and Pupil Premium allocations. Also: the **School Workforce Census** (November) — every teacher's TRN, subject taught, hours, pay, absence, qualifications. That last one is the teacher-side dataset and is *deeply* sensitive.

---

## 2. How you actually get the data out

### 2.1 The aggregators

| Route | Model | Cost | Notes |
|---|---|---|---|
| **Wonde** | Single API across MIS; school approves each app in its Wonde portal; 700+ integrated apps, 30,000+ schools, 35M individuals ([Wonde](https://www.wonde.com/), [developers](https://www.wonde.com/developers/)) | School-side licences reported around **£360–£600 per school per year**, with setup fee, read licence, and extra for write-back; secondaries pay more than primaries ([EduGeek](https://www.edugeek.net/forums/topic/215176-wonde-now-charging-%C2%A3360-per-year-but-you-dont-need-it/), [Clever analysis](https://www.clever.com/blog/2025/10/wonde-pricing)). App-provider pricing is not published — assume a per-school or per-pupil rev-share negotiated deal | The DfE's own attendance contractor. Fastest route to credibility |
| **Groupcall Xporter** | Agent installed in school, scheduled extracts; 20,000+ schools; also Xporter-for-LAs ([Groupcall](https://www.groupcall.com/product/xporter)) | Not published | Now owns **Assembly**; Assembly's interface is being folded into Xporter ([CEC](https://careersandenterprise.zendesk.com/hc/en-gb/articles/5505633005212)) |
| **Salamander** | LA-oriented data transfer/analysis | Not published | Smaller |
| **Direct MIS APIs** | Bromcom free open API; Arbor Developer Portal with application process; iSAMS REST | Bromcom free; Arbor application-gated | Best margins, worst coverage. SIMS is the blocker |

### 2.2 The consent chain (this is the real work)

For each school you need, in order:
1. **The headteacher / SLT sponsor** — buys the value proposition.
2. **The data manager / MIS admin** — actually clicks approve in Wonde or creates the API user in Bromcom/Arbor. In practice this person is the gatekeeper and the person you must not annoy.
3. **The DPO** — usually an outsourced service or a MAT-level officer. Wants: your DPIA, your sub-processor list, your data residency, retention schedule, lawful basis (public task/legitimate interests as processor under the school's controllership), and a signed **Data Processing Agreement** naming the school as controller.
4. **The MIS vendor** — for Arbor, approval of your partner app; for SIMS, potential contractual friction (the CMA/SIMS third-party database dispute).
5. **Privacy notice update** — the school's pupil privacy notice must name the processing.

Realistic timeline: 4–12 weeks per school for a first deployment, faster once you're on a MAT's approved-supplier list.

### 2.3 Policy tailwind: the DfE MIS framework

The DfE opened a consultation (announced 14 Nov 2025) on a new MIS procurement framework, explicitly to reduce schools' "legal risks", with a market sized at **~£200m**. Draft principles: MIS contracts capped at **three years including extensions**, auto-renewals limited to a single 12-month extension, no cap on the number of suppliers, transparent pricing, and — crucially for you — a commitment that data should "flow smoothly across school, trust, local authority and national levels" with simplified "contract exit around transfer of data" ([Schools Week](https://schoolsweek.co.uk/dfe-looks-to-reduce-mis-legal-risk-amid-200m-turf-war/), [WhichMIS](https://www.whichmis.com/dfes-new-mis-framework/)). The direction of travel is towards mandated data portability. Build assuming that lands.

Counterweight: the ICO's June 2026 *Edtech examined* audit will likely produce a **statutory edtech code of practice**. Findings to design around: controller/processor confusion (~when vendors use pupil data for their own product development they become controllers); ~30% of providers had not properly authorised sub-processors; ~half had done no meaningful sub-processor due diligence; ~80% could not evidence data-protection-by-design for children; and specific concern about **training AI on children's data** ([ICO PDF](https://ico.org.uk/media2/13yfm55z/edtech-examined-key-findings-from-our-audits.pdf), [Freeths](https://www.freeths.co.uk/insights-events/legal-articles/2026/the-icos-edtech-audit-a-warning-shot-before-the-rules-are-written/), [5Rights](https://5rightsfoundation.com/ico-audit-confirms-serious-concerns-about-childrens-data-in-education-technology/)).

---

## 3. Competitors — and the white space

| Product | What it does | Rough price | Buyer | Weakness |
|---|---|---|---|---|
| **FFT Aspire** | National benchmarking, KS2-based estimates, attendance analytics, live MIS link | £785 + £1.30/pupil; +£800 secondary tracking | Head / data lead | Backward-looking, cohort-level, statistical not causal; no behaviour, no homework, no teacher layer |
| **SISRA Analytics** (Juniper) | KS3/4/5 attainment analysis, AtL, 1,400-school collaboration benchmark | Low-mid £000s | Data manager / DHT | Attainment-only; every analysis starts from a data drop; nothing real-time |
| **4Matrix** | Secondary results analysis, flightpaths | Low £000s | Data manager | Desktop-era UX; results-day tool |
| **Insight Tracking** | Primary pupil tracking | ~£300–800 | Primary head | Wrong phase for you |
| **Arbor Analytics / MAT MIS** | Trust-wide dashboards, MAT averages, cross-school Ofsted page, BI streaming | Bundled with MIS | MAT COO/Head of Data | Only works if all schools are on Arbor; descriptive dashboards, not inference; no external datasets |
| **Bromcom Vision** | Same, Bromcom-locked | Bundled | Same | Same |
| **Go4Schools** | Markbooks, behaviour, attendance, homework, parent app | £1,519+ base + per-pupil | SLT | Operational not analytical; a second MIS not a brain |
| **Educater** | Curriculum/assessment tracking | Low £000s | Primary/MAT | Small, primary-weighted |
| **IRIS / Every** | Compliance, HR, H&S, absence | Modular, £000s | Business manager | Not pupil-outcome data at all |
| **Juniper Sonar** | Primary tracking (OTrack/Classroom Monitor/Pupil Asset consolidation) | £000s | Primary | Primary |
| **Pupil Progress** | Subject-level GCSE tracking spreadsheets-as-a-service | Low £000s | HoD | Narrow |
| **Alps** | Post-16 value-added, subject/teacher-level VA, what-if planning | £000s; 10% LA discount | Sixth form head | KS5 only; annual cadence; VA at teaching-set level is already politically spicy |
| **The Key** | Guidance, policy, compliance content; owns Arbor & ScholarPack | ~£500–1,500 | Head/governors | Content not data |
| **Steplab** | Instructional coaching platform, 88,000+ teachers ([Steplab](https://steplab.co/us/)) | Per-teacher | Trust CPD lead | Deliberately *not* data-driven — no MIS integration, no outcome linkage |
| **Bluesky Education** | Appraisal, CPD, professional standards tracking | Per-teacher | HR / CPD lead | Process management; no outcome data |
| **Evidence Based Education / Great Teaching Toolkit** | Teacher development model, self-assessment, student surveys; the printed toolkit is £99 ([Lancashire](https://www.lancashire.gov.uk/lpds/publications/details/?id=1262)) | Per-teacher subs | T&L lead | Framework, not analytics |
| **Edurio** | Stakeholder surveys, 150+ trusts, 2,000+ schools; retention, parental engagement, T&L perceptions | Per-trust £000s | MAT central | Survey data only; nothing joined to pupil outcomes |
| **TeacherTapp** | Daily national teacher panel | Free to teachers; sells insight | Researchers/policy | National not school-level; not a school tool |
| **Schools BI** | Bespoke Power-BI-style dashboards over MIS + finance + HR + assessment; 300+ schools, 40+ MATs ([Schools BI](https://schoolsbi.co.uk/)) | Bespoke, £000s+ | MAT/independent | Consultancy-shaped; bespoke ≠ scalable; dashboards not inference |
| **School Analytics Ltd, DCPro** | Power BI for MATs; single-page MAT dashboard with context, attendance, exclusions, assessment ([DCPro](https://www.dcpro.co.uk/features/mats/), [School Analytics](https://www.schoolanalytics.co.uk/)) | Bespoke | MAT | Same |
| **CPOMS / MyConcern** | Safeguarding case management | £000s | DSL | Walled garden by design |
| **Schoolzine** | Comms/newsletters | Low | Office | Irrelevant to analytics |

### 3.1 Where the white space actually is

Reading across the table, four things are true of essentially every incumbent:

- **They are single-domain.** Attainment tools don't see behaviour. Behaviour tools don't see reading age. Homework platforms don't see attendance. Nobody holds the joined graph.
- **They are descriptive, not explanatory.** Every product above shows you *that* a number moved. None of them says *why*, and none of them ranks candidate causes.
- **They are cohort-cadenced.** Data drop → report → SLT meeting, 2–3 times a year (because *Making Data Work* told schools to stop collecting more often). Nothing operates on the daily attendance/behaviour stream that now exists.
- **They stop at the school boundary.** Except FFT and Alps, nothing benchmarks externally; and FFT/Alps benchmark outcomes only, never process.

**White space 1 — the joined pupil graph with causal narrative.** "Y9 trajectory dropped; the strongest correlate is reading age 2.1 years below chronological, and it shows in every text-heavy subject but not in maths or PE." Nobody ships this. It requires exactly three things you can get: MIS attendance/behaviour/assessment, GL/Renaissance reading data, and KS2 priors. The hard part is not the data, it's the inference being *defensible* and *legible* to a head of year in 15 seconds.

**White space 2 — cross-platform effort/engagement signal.** Sparx, Educake, Satchel, Seneca each hold rich effort data that dies inside its own product. A layer that normalises "homework compliance and effort across all subjects" and joins it to attendance and attainment is genuinely novel and politically *safe* (it's about pupils, and it's about effort, not teacher quality).

**White space 3 — cohort-level early warning at daily cadence.** The daily attendance collection created a live national data stream in 2024/25 and almost nobody has built on it. Weekly "these 14 pupils changed trajectory this week and here's the likely reason" beats any termly dashboard. Pastoral leads have no tool for this; they currently do it by memory and gut.

**Secondary white space:** subject/department diagnostics framed as *curriculum* questions ("Y8 chemistry results dip specifically on quantitative items — a maths dependency, not a teaching problem") rather than teacher-quality questions. And SEND/EAL-aware analysis — SENDCos are drowning and have almost no analytics designed for them.

---

## 4. The teacher-analytics landmine

This is the section that decides whether the product is adopted or blacklisted.

### 4.1 *Making Data Work* (Teacher Workload Advisory Group, Nov 2018) — the governing document

The DfE **accepted all recommendations in full** ([report PDF](https://assets.publishing.service.gov.uk/media/5be1ccca40f0b667c116be10/Workload_Advisory_Group-report.pdf), [DERA](https://dera.ioe.ac.uk//32443/)). The load-bearing points:

- Schools should hold **no more than two or three attainment data collection points a year**.
- Pay progression **"should never be dependent upon quantitative assessment metrics, such as test results."**
- The performance of a **single exam class must not be used as a principal measure of teaching quality** in performance management.
- Eliminate **performative data practices** — data collected for accountability rather than learning.
- Every data collection must have a stated purpose and a use; if you can't name the action it drives, don't collect it.

NASUWT has published its own member guidance built on this report ([NASUWT/Barnsley](https://www.barnsley.gov.uk/media/16143/nasuwt-making-data-work.pdf)).

### 4.2 Union positions

- **NASUWT**: objects "in the strongest terms" to numerical targets as performance management objectives; advises members to refuse objectives requiring pupils to hit quantitative attainment targets; campaigns to break the pay/performance link entirely ([NASUWT](https://www.nasuwt.org.uk/advice/performance-management/break-link-between-pay-progression-and-pm.html)).
- **NEU**: "no data targets in performance management — it is a teacher's performance management objective, not the children's"; too many factors outside a teacher's control ([NEU Norfolk](https://norfolkneu.org/faqs/performance-management/), [NEU](https://neu.org.uk/advice/your-rights-work/pay-advice/pay-bargaining-toolkit/ending-performance-related-pay)).

### 4.3 The policy stack has moved *away* from data-judging teachers

- **Graded lesson observations** were dropped by Ofsted from 2014 and by most schools since.
- **Ofsted 2019 EIF**: inspectors will **not use schools' internal performance data for current pupils as inspection evidence**, because they cannot validate it; instead they gather first-hand evidence of curriculum quality ([GOV.UK consultation](https://www.gov.uk/government/consultations/education-inspection-framework-2019-inspecting-the-substance-of-education/education-inspection-framework-2019-inspecting-the-substance-of-education), [Ofsted School Inspection Update Jan 2019](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/772056/School_inspection_update_-_January_2019_Special_Edition_180119.pdf)). Inspectors *will* ask leaders to justify **why** they collect whatever they collect — which is a direct question your product must help a head answer well.
- **STPCD 2024** (Sept 2024): the requirement to operate performance-related pay was **removed**; every eligible teacher progresses annually unless subject to capability procedures ([NASUWT](https://www.nasuwt.org.uk/advice/performance-management/changes-to-stpcd-2024-25-england.html), [VWV](https://www.vwv.co.uk/insights/articles/the-school-teachers-pay-conditions-document-2024-key-changes/), [Ward Hadaway](https://www.wardhadaway.com/insights/updates/teachers-performance-related-pay-will-become-optional/)).
- **Ofsted from Nov 2025**: report cards, five-point scale (Exceptional / Strong / Expected / Needs attention / Urgent improvement), six evaluation areas including a standalone **Inclusion** area, plus attendance and behaviour ([GOV.UK EIF Nov 2025](https://www.gov.uk/government/publications/education-inspection-framework-eif/education-inspection-framework-for-use-from-november-2025), [The Key](https://thekeysupport.com/blog/from-grades-to-report-cards-how-ofsted-will-share-inspection-outcomes/)). Inclusion becoming its own graded area is a *product opportunity*: disadvantaged/SEND/EAL gap analysis is now directly inspection-relevant.

### 4.4 Design rules for a teacher-facing feature

| Career-ending | Acceptable |
|---|---|
| Ranking teachers by pupil outcomes | Flagging *cohort-level* patterns for CPD planning, never named-teacher league tables |
| Anything that could feed a pay or capability decision | Explicit, contractual "not for performance management or pay" guarantee, enforced in the product (no export of teacher-comparative views) |
| Individual teacher dashboards visible to SLT | Individual teacher dashboards visible **only to that teacher**, opt-in sharing with a coach |
| "This teacher needs behaviour support" surfaced to the head | "Period 5 Thursday in D-block shows 3× behaviour incidents across all staff" — a *system* framing, not a person framing |
| Judgements from a single class | Aggregation thresholds (min N classes, min N terms) with confidence intervals shown |
| Silent data collection | Staff privacy notice, named-in-DPIA, union consultation at trust level before rollout |

The framing that survives contact with a staffroom is **workload reduction plus system diagnosis**: the product does the analysis so teachers do fewer data drops, and it points at timetables, curriculum sequencing, room allocation and cohort composition rather than at people. The *Making Data Work* recommendation of 2–3 collections a year is a gift here — you can honestly market "we need fewer data drops from you, not more."

Note the tension you must resolve explicitly: your stated example insight, *"this teacher needs behaviour support"*, is the single most dangerous sentence the product could emit. Reframe it as a self-service signal to the teacher plus an anonymous aggregate to the CPD lead, or drop it.

---

## 5. Buyers and budgets

### 5.1 Who buys

| Setting | Decision maker | Influencers | Budget line |
|---|---|---|---|
| Standalone secondary | Head / Deputy Head (Data or Standards) | Data manager, business manager, DPO | School improvement / ICT |
| Small MAT (2–10) | CEO or Director of Education | Head of Data, school heads | Central top-slice (typically 3–5% of GAG) |
| Large MAT (11+) | Director of Education / Chief Data Officer | Central improvement team, IT director, procurement lead | Central services budget |
| LA / diocese | School improvement lead | Buys on behalf of maintained schools, resells at discount (the FFT/Alps model) | Traded services |

Central procurement is now the norm in MATs — trusts negotiate trust-wide and you deal with a finance/procurement team, not individual heads ([Procure Partnerships](https://procurepartnerships.co.uk/news/how-can-frameworks-support-multi-academy-trusts/), [BESA MAT Report 2025](https://www.besa.org.uk/)).

### 5.2 Realistic price points

Benchmarks from the table above imply a defensible pricing corridor for an analytics layer:

- **Per pupil per year: £2–£8** is the realistic band for a single-purpose analytics tool (FFT is £1.30/pupil + base; AR ~£9/pupil is a full learning programme, not analytics).
- **Per school per year: £1,500–£6,000** for a secondary of 1,000–1,500 pupils. Go4Schools starts at £1,519 base; SISRA/4Matrix/Alps sit in the low thousands.
- **MAT-wide: £15k–£80k** for a 10–30 school trust, with per-school unit price falling 30–50%.
- A "Gotham" positioning could justify the top of that band (£6–10/pupil) *only* if it demonstrably replaces two or three existing subscriptions (e.g. SISRA + a bespoke Power BI consultancy + FFT add-ons).

### 5.3 Procurement routes

- **DfE-approved frameworks** — the forthcoming MIS framework, plus existing DfE "Get help buying for schools" deals.
- **CPC (Crescent Purchasing Consortium)** — education-owned, heavily used by MATs.
- **ESPO** — has a dedicated "My Academy Trust" offer and education frameworks ([ESPO](https://www.espo.org/frameworks-for-education), [My Academy Trust](https://www.espo.org/my-academy-trust)).
- **YPO** — similar, northern-weighted.
- **Crown Commercial Service / G-Cloud (Digital Marketplace)** — most competitors here list on G-Cloud (Arbor, Go4Schools, CPOMS, FFT all do). **Listing on G-Cloud is cheap and removes a major procurement objection** — do it early.
- **LA traded services** — Leeds for Learning, The Education People (Kent), EGfL (Ealing) etc. resell FFT/Alps at 10–40% discounts. A distribution channel worth 100+ schools at a time.

### 5.4 Sales cycle

UK school B2B edtech sales cycles run **6–18 months**; even small purchases involve multiple stakeholders and often MAT approval ([FlairRepublic](https://flairrepublic.co.uk/education-edtech-marketing-playbook/), [Aurelius](https://www.aureliusmedia.co/blog/edtech-marketing)). Budget-setting happens Feb–April for a September start; the practical implication is that a September 2027 launch needs signed intent by ~March 2027. MAT leadership forums convert better than mass marketing. Being on a framework is a long-term asset.

---

## 6. Implications for build sequencing

1. **Start with Bromcom (free open API) and Arbor (developer portal) direct**, add Wonde when you need SIMS schools. Do not build MIS connectors from scratch for SIMS.
2. **Anchor on the daily attendance stream** — it's mandatory, live, and universally connected.
3. **Import reading age (NGRT/STAR) and CAT4 as first-class, not afterthoughts.** That's what makes the causal narrative possible, and it's the gap nobody fills.
4. **Ship the pupil graph before the teacher graph.** The pupil-facing product is commercially sufficient and politically safe; the teacher layer can follow once you have trust and a defensible methodology.
5. **Do the DPIA and sub-processor discipline before the first pilot**, and publish it. The ICO's 2026 audit means DPOs will now ask specifically about controller/processor role, sub-processors, retention, and AI training on children's data. Being the vendor that answers all four crisply is a real competitive advantage in a market where 80% of audited providers could not.
6. **List on G-Cloud and target one LA traded-services channel** for distribution leverage.

---

*Sources are linked inline throughout. Prices marked "not published" require direct vendor contact; treat all figures as indicative list prices before LA/MAT discount.*
