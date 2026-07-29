# Palantir: Technical / Architectural Teardown

**Researched:** 2026-07-27 · **Purpose:** understand what Palantir actually builds, so we can steal the good ideas for an education analytics platform and ignore the enterprise theatre.

All claims below are sourced inline. Where Palantir's own marketing is the only source, I say so.

---

## 0. The shape of the company

Palantir's own 10-K describes four platforms: **Gotham**, **Foundry**, **Apollo**, and **AIP** ([FY2024 10-K](https://www.sec.gov/Archives/edgar/data/1321655/000132165525000022/pltr-20241231.htm), [FY2025 10-K](https://investors.palantir.com/files/2025%20FY%20PLTR%2010-K.pdf)). Gotham and Foundry are the two data platforms; Apollo is a cloud-agnostic continuous-delivery control plane that ships updates into air-gapped and classified environments; AIP is the LLM layer that sits on top of both. Revenue split in 2025 was ~54% government / ~46% commercial.

Palantir's docs describe the architecture as Apollo underneath, Foundry as the data-operations platform, AIP as the generative-AI layer, and nine capability sets across them — Ontology system (Language, Engine, Toolchain), Data Services, Logic Services, Workflow Services, Analytics & Applications, Automations, Product Delivery — all sitting on six "mesh-wide" components: Storage, Compute, Networking, Security, Governance, Workspace ([architecture centre](https://www.palantir.com/docs/foundry/architecture-center/platforms)).

The single most important architectural idea in the whole company is the **Ontology**. Everything else is plumbing around it. Section 3 is the one that matters.

---

## 1. GOTHAM

### Origin

Founded 2003, first money from **In-Q-Tel** (the CIA's VC arm, ~$2M in 2004), built to let intelligence analysts fuse disparate databases post-9/11 ([Wikipedia](https://en.wikipedia.org/wiki/Palantir_Technologies), [Britannica](https://www.britannica.com/money/Palantir-Technologies-Inc)). The founding premise was explicitly a *human-in-the-loop* tool: not an algorithm that finds terrorists, but an interface that lets a human analyst traverse a fused graph fast enough to form and test hypotheses. That design DNA is still visible in the product.

### Architecture

Gotham is a **dynamic-ontology object graph** with an investigative UI on top. The key documented components:

- **Revisioning Database (RevDB)** — the primary store. All integrated data is stored as objects with full revision history; every change is tracked, and analysts get individual *sandboxes* so they can hypothesise destructively without corrupting the shared graph. This is Gotham's equivalent of git branching, at the object level.
- **Horizon** — an in-memory distributed query engine, described by Palantir as "similar in design to Apache Spark", that powers Object Explorer: query billions of objects, get results in seconds ([Gotham service definition, UK G-Cloud](https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-14/documents/92736/801146272055049-service-definition-document-2024-11-26-1253.pdf)).
- **Phoenix** — a clustered store for massive-scale data that Gotham federates search out to, importing only relevant results into RevDB on the fly. This is the "don't copy the whole haystack" tier.
- **Nexus / Nexus Peering** — a Nexus is a scoped body of object data; *peering* synchronises Nexuses between Gotham instances (or across a distributed single instance) by capturing, cycling and fusing changes, so field deployments in low-connectivity environments converge to a consistent state without duplicate or conflicting copies ([Palantir secure-collaboration material](https://www.palantir.com/assets/xrfr7uokpv1b/4JWbqPQ8d6vYcNijOVqD0D/2857507783a328b6ddb6aef1ffc5fac4/Palantir_for_Secure_Collaboration__1_.pdf)).

**Note on "Nexus Peabody":** I could not find any Palantir source using that term. The real terms are **Nexus** and **Nexus Peering**, plus the **dynamic ontology** as the data model. Worth correcting in any writeup — "Peabody" appears to be a mishearing/conflation.

### The dynamic ontology

Gotham's model is objects → properties → links, with the crucial property that the schema is *dynamic*: analysts and deployment engineers can extend object and link types without a schema migration, and the same underlying source row can be re-mapped as understanding evolves. The academic literature calls this out as the core technical contribution ("big data integration and business mapping techniques based on dynamic ontologies") — see *A Brief Analysis of Palantir Gotham* ([IEEE Xplore](https://ieeexplore.ieee.org/document/10808897/)).

**Entity resolution** is the load-bearing, under-marketed part. A "Person" object is not a row; it is a resolved entity assembled from many source records (arrest record, phone bill, visa application, sensor hit), with provenance preserved back to each contributing record. Every property value carries its source. When an analyst asks "why do you think this is the same person?", the system can show the evidence chain. This is what makes the graph trustworthy enough to act on, and it is genuinely hard — see §8 on Splink for the open-source version.

### Applications and the analyst session

- **Object Explorer** — top-down: filter billions of objects down to an interesting subset by property histograms and facets, then push that set into another app.
- **Graph** — link analysis: expand from a node to its neighbours, run path-finding between two entities, view aggregated property statistics over a subgraph, style/annotate/organise the graph as a shareable artefact.
- **Map** — geospatial: geotemporal tracks, geofences, heatmaps, spatial joins.
- **Timeline / Histogram** — temporal: sequence events, find co-occurrence in time.
- **Dossier / Notepad** — collaborative writeups where live objects are embedded (not screenshotted), so the narrative stays bound to the data.
- **Target Workbench** — targeting workflow with an API (create/modify/archive targets with location, type, aimpoints) ([Gotham API docs](https://www.palantir.com/docs/gotham/api/target-workbench/target/create-target)); there is an official [Python client](https://github.com/palantir/gotham-platform-python).
- **Alerting / rules** — standing queries over the graph that fire when new data satisfies a pattern, turning an investigation into a monitor.

A typical session: analyst starts from a lead (a phone number). Object Explorer resolves it to a Person object. They open it in Graph, expand one hop to accounts/vehicles/associates, drop the resulting set onto the Map to see where the associates cluster, switch to Timeline to see whether meetings preceded a known incident, prune the graph to the six nodes that matter, annotate it, save it into a Dossier, and set an alert so any new record touching those six objects notifies them. Every step is a set operation on the same object set, and the set carries between apps.

### Why the UX reads as "game-like"

Not because it's gamified — because of four properties dashboards don't have:

1. **Direct manipulation of a persistent object set.** You are not filtering a chart; you are carrying a *selection* between tools. State is the object set, not the view.
2. **Everything is expandable.** Any object is a doorway one hop further. The loop is explore → expand → prune, which is the same loop as an adventure game map.
3. **Branching without consequence.** Sandboxes/RevDB mean speculative edits are free and reversible — the "save scumming" affordance.
4. **The artefact is the output.** A graph you shaped, annotated and shared *is* the deliverable, not a PDF exported from it.

Dashboards answer questions you already had. Gotham is built for questions you discover mid-session. That distinction is the single most transferable idea in this entire document.

---

## 2. FOUNDRY

Foundry is the commercial/enterprise sibling: same ontology idea, but with a serious data-integration stack underneath and app-building on top.

### Datasets, transactions, branches

Foundry datasets are versioned file collections. The unit of change is a **transaction**, explicitly analogised to a git commit — "datasets, branches, and transactions are analogous to Git repositories, branches, and commits" ([data integration docs](https://www.palantir.com/docs/foundry/data-integration/datasets/index.html), [Robert Fink's blog post on dataset versioning](https://blog.palantir.com/on-dataset-versioning-in-palantir-foundry-8f23de22cc4c)). Four transaction types: `SNAPSHOT` (replace the view — the basis of batch pipelines), `APPEND` (add files — the basis of incremental pipelines), `UPDATE`, `DELETE`.

**Transforms** are code (PySpark/Java/SQL, or the no-code Pipeline Builder) that produce a dataset from other datasets. Because both the code repo and the datasets are branched, you can branch *logic and data together*: create a Pipeline Builder branch matching a Code Repositories branch name and both read from the matching branch ([branching docs](https://www.palantir.com/docs/foundry/data-integration/branching), [branching & release process](https://www.palantir.com/docs/foundry/building-pipelines/branching-release-process)).

**Global Branching** goes further: a single branch forks datasets, code, *ontology resources*, applications and pipelines together, with rebase, conflict resolution, a proposal/review step, approvals gated by resource-protection policies, and merge-with-build-trigger ([Global Branching core concepts](https://www.palantir.com/docs/foundry/foundry-branching/core-concepts)). This is the strongest genuinely-differentiated engineering in Foundry: **PR review for your entire data platform, including its semantic model.**

### The app layer

- **Contour** — point-and-click analysis over tabular data at scale; a "path" of stacked analysis steps, each inspectable, that compiles to Spark. Think Excel pivot semantics with lineage.
- **Quiver** — time-series and object-centric analysis, plus read-only interactive dashboards embeddable elsewhere.
- **Object Explorer** — search/discovery across the Ontology.
- **Object Views** — a configurable "profile page" per object type: properties, linked objects, metrics, embedded analyses, and the actions you can take on it.
- **Workshop** — no-code app builder *natively on the Ontology*, with a layout system and an events system; Palantir positions it as producing something closer to a custom React app than a dashboard ([app-building overview](https://www.palantir.com/docs/foundry/app-building/overview)).
- **Slate** — lower-level, code-ish app builder for heavy customisation; can hit datasets directly, not just the Ontology.
- **OSDK (Ontology SDK)** — generates a typed client (TypeScript/Python/Java, or OpenAPI spec for anything else) from your ontology, managed via **Developer Console**, so external apps get first-class typed access to objects, links and actions ([OSDK overview](https://www.palantir.com/docs/foundry/ontology-sdk/overview), [osdk-ts on GitHub](https://github.com/palantir/osdk-ts)).

### How this differs from warehouse + BI

A normal stack is: warehouse (Snowflake/BigQuery) → dbt → BI (Looker/Tableau). It is **read-only and terminates in a chart**. Foundry differs on three axes:

1. **Writeback.** Actions write user decisions back into the ontology and into a writeback dataset, so operational state lives in the same place as analytical state. A BI tool has no equivalent.
2. **Versioning of the semantic model itself**, not just of the SQL.
3. **Apps as first-class output.** The intended artefact is an "operational decision app" — a screen a nurse/dispatcher/planner uses to *do the job*, where the data and the action are the same surface. Looker cannot dispatch a truck.

That's the honest differentiation. Everything else (Spark, Parquet, lineage, catalogs) is table stakes you can assemble from open source.

---

## 3. THE ONTOLOGY (the part that matters)

Palantir's own line: "In Foundry, the Ontology is the digital twin of an organization, integrating the organization's digital assets (datasets and models) into a coherent whole" ([core concepts](https://www.palantir.com/docs/foundry/ontology/core-concepts)).

### Three layers

From the [Ontology overview](https://www.palantir.com/docs/foundry/ontology/overview):

- **Semantic layer** — what things *are*: object types, properties, link types. The nouns.
- **Kinetic layer** — what you can *do*: action types and functions. The verbs. This is the layer nobody else has.
- **Dynamic layer** — granular security, governance tracking, version control over every ontology element.

### The mapping table (memorise this)

| Datasets | Ontology |
|---|---|
| Dataset | Object type |
| Row | Object |
| Column | Property |
| Field value | Property value |
| Join | Link type |

So the Ontology is, structurally, *a named, governed, permissioned, API-exposed view over your warehouse tables*. That is less magical than the marketing but far more useful than it sounds, because naming the join and the entity once, centrally, is exactly what stops every downstream consumer (BI, app, LLM) from re-deriving business logic slightly differently.

### The primitives, precisely

- **Object type** — schema for a real-world entity or event. Instances are *objects*; collections are *object sets* (object sets are the currency passed between apps). Backed by a dataset, virtual table, or restricted view.
- **Property** — schema for a characteristic. **Shared properties** are reusable across object types for consistent modelling.
- **Link type** — schema for a relationship. 1:1, 1:many, many:many supported; many:many needs a join/mapping dataset ([link types](https://www.palantir.com/docs/foundry/object-link-types/link-types-overview)).
- **Interface** — describes shape/capability across object types, enabling polymorphism ("anything that is `Assignable`").
- **Action type** — a transactional set of edits: create/modify/delete objects, add/remove links, set property values, applied atomically. Has **parameters** (typed inputs, defaults, dropdowns), **rules** (what changes), **submission criteria** (validation + who may submit), and **side effects** (notifications, webhooks to external systems, function calls) ([action types](https://www.palantir.com/docs/foundry/action-types/overview)). Edits land in the object type's **writeback dataset** and are recorded in edit history.
- **Function** — arbitrary business logic in TypeScript/Python that takes objects as input, reads properties, traverses links, and can return objects or ontology edits ([functions on objects](https://www.palantir.com/docs/foundry/functions/api-objects-links)).
- **Roles** — the permissioning model, applied at ontology or individual-resource level.

### Why "digital twin" is a defensible claim (and where it isn't)

Defensible: because actions write back, the ontology holds not just what the world *was* (analytical snapshot) but what people *decided* (operational state). Over time the ontology becomes the record of the organisation's behaviour, not just its data. That's a real thing a warehouse can't do.

Not defensible: it is not a simulation, not a physics model, not autonomous. It is a governed CRUD layer with a graph API and good tooling. "Digital twin" is doing marketing work.

### Grounding LLMs on it

The point of the Ontology in the AI era: an LLM given raw table access hallucinates joins and leaks data. An LLM given *object types with typed properties, typed links, and a finite set of permissioned actions* has a bounded, typed, auditable tool surface, and the user's own permissions are enforced on every read and write. That is the whole AIP thesis, and it is correct.

### Worked example: an education ontology

```
OBJECT TYPES
  Student        (id, year_group, sen_status[marked PII], pp_flag[marked PII], eal)
  Class          (id, subject, teacher_id, academic_year)
  Teacher        (id, name, department)
  Objective      (id, spec_code, subject, topic, tier, ks3_or_gcse)
  Question       (id, objective_id, difficulty, marks, type)
  Attempt        (id, student_id, question_id, ts, correct, seconds_taken, hint_used)
  MasteryState   (student_id, objective_id, p_known, last_seen, next_due)
  Intervention   (id, student_id, type, owner_id, opened_at, status, notes[PII])
  Assessment     (id, class_id, date, paper_id)

LINK TYPES
  Student  --enrolled_in-->        Class            (many:many, via enrolment table)
  Class    --taught_by-->          Teacher          (many:1)
  Question --assesses-->           Objective        (many:1)
  Attempt  --by-->                 Student          (many:1)
  Attempt  --on-->                 Question         (many:1)
  Objective--prerequisite_of-->    Objective        (many:many)  <-- the interesting one
  Student  --has_mastery-->        MasteryState     (1:many)
  Intervention --for-->            Student          (many:1)

INTERFACES
  Reviewable  { owner, status, opened_at }   // Intervention, Assessment both implement

ACTIONS
  logIntervention(student, type, owner, note)
      rules: create Intervention, link to Student, set status=open
      submission criteria: submitter is student's teacher OR head of year
      side effect: notify head of year; webhook to MIS
  markObjectiveRetaught(class, objective, date)
      rules: create RetaughtEvent, link Class->Objective
  overrideMastery(student, objective, new_p, reason)
      submission criteria: reason non-empty AND submitter has role TeacherLead
      side effect: write audit note

FUNCTIONS
  classGapReport(Class) -> Objective[]          // objectives where median p_known < 0.5
  prerequisiteChain(Objective) -> Objective[]   // walk prerequisite_of backwards
  nextBestQuestion(Student) -> Question         // spaced-repetition scheduler
  cohortComparison(ObjectiveSet, ClassSet) -> Metric[]
```

Now an LLM agent with the tools `queryObjects(Student, Objective, MasteryState)`, `callFunction(classGapReport)`, and `action(logIntervention)` can answer "which three topics should I reteach 9B next week, and log an intervention for the four students furthest behind" — grounded, permissioned, auditable, and it *writes back*. That is a genuinely valuable product and it is buildable by a small team. `Objective --prerequisite_of--> Objective` is the link that makes the whole thing more than a gradebook.

---

## 4. AIP

**AIP Logic** — a no-code environment for building, testing and releasing LLM-backed *functions*. You compose blocks; the central one is a "Use LLM" block that takes a prompt and is granted **tools** — e.g. "Query objects" over specific object types. Inputs/outputs are ontology objects, strings, or ontology edits. Functions are versioned, published, and callable from automations, Workshop apps and OSDK ([AIP Logic overview](https://www.palantir.com/docs/foundry/logic/overview)).

**AIP Agent Studio / Chatbot Studio** — build conversational agents with:
- *Object query tool*: which object types the LLM may read, with filtering, aggregation, inspection and link traversal.
- *Action tool*: lets the agent execute ontology edits, either auto-executed or gated behind user confirmation.
- *Function tool*: invoke any Foundry function including published AIP Logic functions, version-pinned.
- *Retrieval context*: fixed object sets or semantic search over objects; also documents.
- *Request-clarification tool*; command tools that drive other Palantir apps.
- Both prompted and native tool-calling modes ([tools](https://www.palantir.com/docs/foundry/agent-studio/tools), [retrieval context](https://www.palantir.com/docs/foundry/agent-studio/retrieval-context)).

**The write-back loop** is the differentiator: agent reads ontology → proposes an *Action* → action passes submission criteria and permission checks → edit lands transactionally with edit history → downstream apps and pipelines see it. The LLM never writes raw rows; it can only invoke actions a human explicitly defined, with validation the human wrote. This is a much better safety architecture than "give the model SQL write access", and it is cheap to copy.

**Guardrails and evaluation.** Two mechanisms:

1. *Permission inheritance.* AIP runs under the invoking user's permissions; Palantir's line is that the model gets "access only to what is necessary to complete a task." Third-party model providers (Azure/AWS/GCP endpoints, regional US/UK/EU) are contractually and technically barred from retaining prompts/completions or training on them; data is discarded after completion ([AIP security & privacy](https://www.palantir.com/docs/foundry/aip/aip-security)).
2. *AIP Evals.* Evaluation suites = test cases + evaluation functions, run against a target function, with LLM-as-a-judge and exact-match evaluators, an experiments feature for sweeping parameter combinations (prompt/model/temperature) against cost and quality, intermediate-parameter evaluation so you can score a single block's output rather than only the end-to-end result, and a metrics dashboard comparing runs and versions. Palantir explicitly recommends running each test case ≥3× because LLMs are non-deterministic ([AIP Evals overview](https://www.palantir.com/docs/foundry/aip-evals/overview), [run a suite](https://www.palantir.com/docs/foundry/aip-evals/run-suite), [experiments](https://www.palantir.com/docs/foundry/aip-evals/experiments)).

Honest assessment: the eval tooling is competent and conventional (it is Braintrust/LangSmith/promptfoo with better ontology integration). The *grounding architecture* is the real innovation, not the eval harness.

---

## 5. SECURITY & GOVERNANCE

This is where Palantir is genuinely ahead, and where most of the transferable-for-a-regulated-market thinking lives.

**Markings** — mandatory access controls, orthogonal to roles. "A user cannot access a file in any way unless the user satisfies all Marking requirements." Even an Owner cannot remove a marking without the marking's Expand Access permission. Markings **inherit down the file hierarchy** (project → folder → file) and **propagate downstream through data dependencies** — if dataset A is marked PII, everything derived from A inherits PII. Applying/removing a marking is itself flagged as a sensitive action ([markings](https://www.palantir.com/docs/foundry/security/markings)). This solves the single hardest governance problem in analytics: sensitivity leaking silently into derived tables.

**Restricted views** — row-level security. A view over a backing dataset whose policy combines *user attributes* (from SSO/user manager), *column names*, and *values* to decide which rows a user sees. Restricted views can't be transform inputs; they back ontology object types ([restricted views](https://www.palantir.com/docs/foundry/security/restricted-views), [granular policies](https://www.palantir.com/docs/foundry/platform-security-management/manage-granular-policies)). Column-level control is done via markings on properties; object security policies handle object-level ([object security policies](https://www.palantir.com/docs/foundry/object-permissioning/object-security-policies)).

**Purpose-Based Access Control (PBAC)** — the most interesting and most copyable idea. Instead of requesting access to a dataset, a user requests access to a **Purpose**, defined by data-governance staff to contain exactly the data needed for that goal — "no more, no less" ([Palantir Explained #2](https://blog.palantir.com/purpose-based-access-controls-at-palantir-f419faa400b3)). Access is therefore justified, time-boxed, reviewable and auditable *by intent*, which maps directly onto GDPR purpose limitation and data minimisation. For UK education data (DfE data protection expectations, ICO age-appropriate design) this is the exact abstraction a regulator wants to see.

**Audit logging** — comprehensive who/what/when/where. Current schema **Audit.3**: ~15-minute latency, enforced structured categories (`dataExport`, `dataLoad`, `userLogin`, `tokenGeneration`, …), guaranteed fields per category, direct API endpoints (`list-log-files`, `get-log-file-content`) for SIEM ingestion without going through Foundry, or export to a Foundry dataset with retention up to 730 days; `audit-export:view` permission required. Legacy **Audit.2** had 24h+ delay and inconsistent categories ([audit logs](https://www.palantir.com/docs/foundry/security/audit-logs-overview)).

**Lineage & provenance** — every dataset and object property traces back through transforms to source, which is what makes marking propagation and "why does the system believe this?" possible ([data lineage](https://www.palantir.com/docs/foundry/data-lineage/elements-reference)).

**Privacy & Civil Liberties (PCL) Engineering** — Palantir says it created one of the first such teams over a decade ago: an interdisciplinary group of engineers, data scientists, philosophers, policy experts and designers who work directly with customers on privacy-protective deployments ([Palantir Explained #5](https://blog.palantir.com/privacy-civil-liberties-engineering-palantir-explained-5-4f027b207923)). Critics regard this as reputational cover; supporters point to PBAC and marking propagation as real artefacts of it. Both can be true.

**How compliance is demonstrated to regulators:** exportable audit logs into the customer's own SIEM (so the customer, not Palantir, holds the evidence); documented purposes with named approvers; lineage graphs showing where personal data flows; markings proving mandatory controls; DPIAs written against Purposes rather than systems; plus the usual certifications and, for government, accreditation of the deployment (Apollo enables air-gapped/on-prem delivery so the data never leaves the customer's boundary).

---

## 6. THE CRITICISMS

### Cost and commercial model

No published list prices; deals are negotiated annual platform fees, with comparable mid-size deployments reportedly varying by 2–3× ([Redress Compliance negotiation guide](https://redresscompliance.com/palantir-aip-foundry-negotiation)). The **AIP Bootcamp** motion — free/cheap 5-day engagement, high reported conversion — works precisely *because ontology work creates switching costs before commercial terms are agreed*. That is a deliberate design: get the customer's semantic model inside your platform, then price.

### Lock-in

The clearest documented case is the NHS FDP. Palantir retains IP in the software; NHS staff cannot fully read or edit the underlying code; analysts report being "forced to write code basically only compatible with Foundry"; in a 2017 NYPD dispute Palantir declined to hand over translatable versions of analytics ([Medact briefing, March 2026](https://www.medact.org/2026/resources/briefings/briefing-palantir-fdp/)). The lock-in isn't contractual, it's *operational dependency* — the semantic model, the apps and the workflows all live in a proprietary format.

### "It's just consultants + Spark"

Critics call Palantir "an opaque, slow-growing business that looks suspiciously like a consulting firm wearing a software company's clothes", and note that without discipline the **Forward Deployed Engineer** model "collapses into consulting" — FDE work is often "deploying other people's code of varying quality and shoehorning it into a place to solve a problem" ([Forbes, July 2026](https://www.forbes.com/sites/stevebanker/2026/07/10/palantir-and-forward-deployed-engineering-what-should-we-believe/); [Medium analysis](https://medium.com/activated-thinker/a-comprehensive-analysis-of-palantirs-forward-deployed-engineering-model-4502a036b5e4)). Anaplan's CEO called FDE a good sales tactic but a poor long-term strategy producing lock-in and limited functionality. Palantir's defence, from its own 10-K: FDE is "the human equivalent of backpropagation" — bespoke work is deliberately harvested back into platform features. Both readings have evidence; the truthful summary is that Palantir is a product company whose product is substantially co-designed by a services organisation, and the ratio matters enormously to margins.

### NHS Federated Data Platform

The most instructive case for UK public-sector work. Facts and allegations from the [Medact briefing](https://www.medact.org/2026/resources/briefings/briefing-palantir-fdp/) (endorsed by Good Law Project, Privacy International, Just Treatment, Corporate Watch, UTAW; supported by Amnesty, Keep Our NHS Public), [openDemocracy](https://www.opendemocracy.net/en/palantir-nhs-federated-data-platform-peter-thiel-data-privacy/), [pharmaphorum](https://pharmaphorum.com/news/concerns-voiced-palantir-wins-ps330m-nhs-data-contract) and [The Register](https://www.theregister.com/2024/02/20/legal_campaigners_challenge_government_decision/):

- **Procurement**: original COVID-era contract awarded March 2020 without competitive tender at nominal £1; ministerial powers used to bypass confidentiality rules. The published FDP contract had 417 of 586 pages redacted until a Good Law Project challenge; privacy sections were heavily censored, so "the public is unable properly to understand or scrutinise the arrangements."
- **Legal basis**: FDP board documents indicated NHS England legal advice that IQVIA's privacy-enhancing-technology component "lacked a legal basis" to process the data.
- **Pseudonymisation**: experts argue NHS de-identification is inadequate — the memorable line being that covering the NHS number doesn't make the record non-sensitive.
- **Capability**: Leeds Teaching Hospitals said they'd "lose functionality rather than gain it"; Greater Manchester ICB found no FDP system-level product matching their existing tooling; the NHS Chief Data and Analytical Officer Network (Feb 2025) concluded existing tools "presently exceed the capability" of FDP. Most hospitals had not adopted it.
- **Cost**: £330m headline (some reporting £480m); Imperial spent ~£500k implementing; Northumbria paid £412.5k extra for support; HSJ estimates true national cost >£1bn; NHS England paid KPMG £8.5m to *promote adoption*.
- **Professional opposition**: BMA AGM resolution against rollout (June 2025), BMA directing doctors to limit engagement (Feb 2026); DAUK-commissioned YouGov poll showing 48% of English adults likely to opt out; 47,000+ written patient complaints by Feb 2026.
- **Revolving door**: multiple senior NHS/NHSX figures now at Palantir (e.g. Indra Joshi, Harjeet Dhaliwal, Paul Howells).
- **Wider**: MoD £240m without competitive tender (Dec 2025); UK government contracts totalling ≥£670m (The Nerve, Jan 2026).

### Civil liberties

Predictive policing deployments (LAPD cross-referencing ~160 datasets including race, tattoos, employment history; NYPD; Chicago) drew sustained criticism from Stop LAPD Spying Coalition for disproportionately targeting Black and Latino neighbourhoods. ICE work: $95.9m (2022) for the Investigative Case Management system, $30m (April 2025) for "ImmigrationOS". A Liberty investigation (June 2025) found UK police deployments combining criminal records with financial and personal data including trade union membership, sexual orientation, health and race. UN Special Rapporteur Francesca Albanese (June 2025) and Amnesty (Sept 2025) named Palantir in relation to Israel/Palestine; Storebrand divested.

### The marketing/reality gap

Three specific gaps worth naming: (1) "Ontology = digital twin" is a governed CRUD-and-graph layer, not a simulation; (2) "AI that runs your enterprise" is in practice tightly-scoped LLM functions with human-confirmed actions; (3) the platform's power is real but is unlocked by expensive humans, which is why NHS trusts with good existing analytics teams repeatedly concluded they'd go backwards.

---

## 7. WHAT'S ACTUALLY TRANSFERABLE — blunt version

### Steal these (high value, low cost, works at any scale)

1. **The Ontology as a real artefact.** One versioned definition of your object types, properties, links, and — crucially — *actions*. In our stack that's a TypeScript/Zod (or Pydantic) schema module generating: DB views, an API, typed client, and LLM tool definitions from one source. This is a weekend-to-fortnight of work and it is the single highest-leverage thing on this list.
2. **Actions as the only write path.** Never let application code or an LLM write rows. Every mutation is a named action with typed parameters, validation, a permission predicate, side effects, and an immutable edit-history row. This gives you audit, undo, agent safety and a changelog for free. Cheap. Do it now.
3. **`prerequisite_of` links.** The education analogue of link analysis. A knowledge graph over objectives is where the real product is — "which upstream gap explains this failure" is a graph traversal, not a dashboard filter.
4. **Object sets carried between views.** Pick a cohort once; carry it into the heatmap, the timeline, the intervention list. This is the "game-like" UX property and it costs a state-management decision, not a platform.
5. **Purpose-based access control.** For schools/MATs/DfE this is a genuine sales weapon. "Access is granted to a Purpose, time-boxed and logged" is a two-table implementation and it lands hard in a DPIA conversation.
6. **Marking propagation through lineage.** If a source is marked `pupil-PII`, every derived table/view inherits it and is blocked from export by default. Implementable in dbt with tags + a CI check.
7. **Structured audit logs from day one** with enforced categories and a documented retention window, exportable to the customer.
8. **Branch data + logic together.** dbt + a seeded ephemeral Postgres/DuckDB per PR gets you 80% of Global Branching. Version the ontology definition in the same repo so schema changes go through PR review.
9. **LLM grounded on the ontology, not the DB.** Tools = `queryObjects`, `callFunction`, `action` (confirm-before-execute). Enforce the *user's* permissions inside the tool implementation, not in the prompt.
10. **Evals as a habit.** Test cases + LLM-as-judge + run ≥3× + compare across versions. promptfoo/Braintrust/a 200-line harness. Do not ship LLM features without it.

### Ignore these (enterprise theatre, or only pays back at $10M scale)

- **Building your own Foundry.** Palantir has ~10 years and thousands of engineers in that pipeline stack. Use Postgres/DuckDB/dbt/Supabase.
- **Full lineage-graph UI, catalog product, data-marketplace.** Nobody in a school will look at it. `dbt docs` is enough.
- **A no-code app builder (Workshop/Slate clone).** This exists because Palantir must serve customers with no engineers. You *are* the engineer. Building an internal low-code layer is the classic small-team death spiral.
- **Nexus-style multi-instance peering / offline CRDT sync.** That exists for warzones. Schools have wifi.
- **Air-gapped/on-prem delivery (Apollo).** Enormous cost; nobody in UK education will pay for it.
- **Cell-level security with a policy engine.** Row-level via Postgres RLS + column masking on a handful of PII fields covers everything a MAT needs.
- **Dynamic runtime-extensible schema.** Gotham needs it because analysts discover new entity types mid-investigation. Education has a stable ontology (student, class, objective, attempt). Hard-code it; migrate with normal migrations.
- **Forward-deployed engineering as a business model.** Tempting because early customers will ask. It destroys margin and product focus at your size. Do at most 2–3 design partners and refuse bespoke builds.
- **Entity resolution at Gotham scale.** You will have UPNs/MIS IDs. Resolve on those. Only reach for probabilistic linkage if you're joining across MATs without a shared key.
- **"Digital twin" language.** Sounds like nonsense to a headteacher. Say "a live model of what each pupil knows."

### The uncomfortable lesson from the NHS FDP

The most-cited reason trusts rejected FDP was not privacy, it was that **their existing tools were better**. Palantir sold platform capability to organisations that needed specific answers. For an education product the corollary is: nobody buys an ontology. They buy "which three things should I reteach 9B on Monday, and here's the evidence." Build the ontology because it makes that answer cheap and trustworthy — then never mention it in a sales meeting.

---

## 8. "Palantir for X" clones and open-source equivalents

**Direct Foundry-alikes (mostly early / thin):**
- [openfoundry (Przyval)](https://github.com/Przyval/openfoundry) — ontology-first open data platform, claims `@osdk/foundry` SDK compatibility.
- [openfoundry (Shamdon)](https://github.com/Shamdon/openfoundry) — self-hosted: connectors, ontology, pipelines, dashboards.
- [foundry-ontology-open](https://github.com/cloudbadal007/foundry-ontology-open) — Foundry ontology architecture with an OWL/SHACL export bridge.
- Treat all of these as reference reading, not dependencies. None has the maturity to build a business on.

**The realistic open assembly** (as several writeups note): orchestrator (Airflow/Prefect/Dagster) + transformation (dbt/SQLMesh) + store (Postgres/ClickHouse/DuckDB) + catalog & lineage (DataHub / OpenMetadata) + a context-assembly service that is your ontology. See [Demystifying Palantir](https://dashjoin.medium.com/demystifying-palantir-features-and-open-source-alternatives-ed3ed39432f9) and [Beyond Palantir's Ontology](https://medium.com/towards-data-engineering/beyond-palantirs-ontology-the-paradigm-the-platform-and-the-path-to-open-semantics-f8e8b3b5fe93).

**Semantic layers:** dbt Semantic Layer (MetricFlow) and [Cube](https://cube.dev) give you metrics-as-code and a governed API — the *semantic* third of the Ontology, with no kinetic layer. Snowflake Semantic Views and Databricks Unity Catalog metric views are the warehouse-native versions. **The gap in all of them is actions/writeback** — that's the whitespace worth occupying.

**Lineage/catalog:** DataHub (LinkedIn), OpenMetadata, OpenLineage/Marquez, Amundsen. Metaphor is the commercial one. For a small team, dbt's exposures + column-level lineage is sufficient.

**Graph:** Neo4j (mature, Cypher, GDS algorithms), [Kùzu](https://kuzudb.com) (embedded, columnar, Cypher — the DuckDB of graphs, ideal for a prerequisite graph you ship inside the app), Memgraph, Apache AGE (Postgres extension — lets you keep one database), plus plain recursive CTEs in Postgres, which is genuinely enough for a prerequisite DAG of a few thousand nodes.

**Entity resolution:** [Splink](https://moj-analytical-services.github.io/splink/) from the UK Ministry of Justice — probabilistic record linkage implementing the Fellegi–Sunter model with EM parameter estimation, term-frequency adjustments, user-defined fuzzy comparisons; links ~1M records on a laptop in about a minute via DuckDB, and scales to 100M+ on Spark/Athena ([GDS blog](https://dataingovernment.blog.gov.uk/2022/09/23/splink-fast-accurate-and-scalable-record-linkage/)). Built for exactly our sector's problem — linking people across UK administrative systems with no shared key — and it's free. Also Zingg, Dedupe.io, RecordLinkage.

**Investigative-UI analogues:** Linkurious, Cytoscape.js / Sigma.js / G6 for graph rendering, Kepler.gl for geo, Perspective (FINOS) for fast in-browser analytics grids. Quantexa is the commercial "Palantir for financial crime"; Tom Sawyer and KeyLines for link analysis widgets.

**Agent/eval:** LangSmith, Braintrust, promptfoo, Inspect (UK AISI) — the AIP Evals equivalents.

---

## Bottom line

Palantir's durable inventions are three: **the Ontology as a governed semantic + kinetic layer**, **actions as the sole audited write path**, and **purpose-based access control with marking propagation**. All three are architectural ideas, not code, and all three are implementable by a two-person team in weeks. Everything else — the pipeline stack, the low-code builders, the peering, the air-gapped delivery, the FDE army — is either commodity or exists to serve $10M+ customers with no engineers, and copying it at our scale is how startups die.
