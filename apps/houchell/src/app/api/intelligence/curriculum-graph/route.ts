import {
  authenticateIntelligence,
  canManageGlobalCurriculum,
  canManageSchool,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
  rpcAsUser,
  UUID_RE,
  type IntelligenceAuth,
} from "@/lib/intelligence/server";
import { skAdmin } from "@/lib/serverHelpers";
import {
  curriculumGraphCoverage,
  sequenceLinkCandidates,
  wouldCreateCurriculumCycle,
  type CurriculumGraphEdge,
  type CurriculumObjectiveNode,
} from "@/lib/curriculumGraph";

export const runtime = "nodejs";

const REVIEW_TABLES = {
  objective_profile: "curriculum_objective_profiles",
  objective_link: "curriculum_objective_links",
  misconception: "curriculum_misconceptions",
  objective_misconception: "curriculum_objective_misconceptions",
  vocabulary: "curriculum_vocabulary",
  objective_vocabulary: "curriculum_objective_vocabulary",
  resource_objective: "curriculum_resource_objectives",
} as const;

const scopeFilter = (schoolId: string | null, includeCanon = true) =>
  schoolId
    ? includeCanon
      ? `or=(school_id.is.null,school_id.eq.${schoolId})`
      : `school_id=eq.${schoolId}`
    : "school_id=is.null";

async function canManageScope(
  auth: IntelligenceAuth,
  schoolId: string | null,
) {
  return schoolId
    ? canManageSchool(auth, schoolId)
    : canManageGlobalCurriculum(auth);
}

function graphMigrationPending(error: unknown) {
  return isMissingDatabaseObject(
    error,
    [
      "curriculum_graph_bundle",
      "curriculum_objective_profiles",
      "curriculum_objective_links",
      "curriculum_misconceptions",
      "curriculum_vocabulary",
    ],
  );
}

function textTitle(value: unknown) {
  const clean = String(value || "").trim().replace(/\s+/g, " ");
  const first = clean.split(/(?<=[.!?])\s/)[0] || clean;
  return first.slice(0, 120);
}

async function graphRows(
  token: string,
  subjectId: string,
  schoolId: string | null,
) {
  const bundle = await rpcAsUser<any>(
    "curriculum_graph_bundle",
    token,
    {
      p_subject_id: subjectId,
      p_school_id: schoolId,
      p_objective_limit: 600,
    },
  );
  const value =
    Array.isArray(bundle) && bundle.length === 1 ? bundle[0] : bundle || {};
  return {
    objectives: Array.isArray(value.objectives) ? value.objectives : [],
    lessons: Array.isArray(value.lessons) ? value.lessons : [],
    profiles: Array.isArray(value.profiles) ? value.profiles : [],
    links: Array.isArray(value.links) ? value.links : [],
    misconceptions: Array.isArray(value.misconceptions) ? value.misconceptions : [],
    objectiveMisconceptions: Array.isArray(value.objectiveMisconceptions)
      ? value.objectiveMisconceptions
      : [],
    vocabulary: Array.isArray(value.vocabulary) ? value.vocabulary : [],
    objectiveVocabulary: Array.isArray(value.objectiveVocabulary)
      ? value.objectiveVocabulary
      : [],
    resourceObjectives: Array.isArray(value.resourceObjectives)
      ? value.resourceObjectives
      : [],
  };
}

export async function GET(request: Request) {
  let auth: IntelligenceAuth | null;
  try {
    auth = await authenticateIntelligence(request);
  } catch {
    return jsonNoStore({ error: "Couldn't resolve your curriculum scope" }, 500);
  }
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  const params = new URL(request.url).searchParams;
  const requestedSchool = params.get("schoolId");
  const requestedSubject = params.get("subjectId");
  const requestedObjective = params.get("objectiveId");
  if (requestedSchool && !UUID_RE.test(requestedSchool)) {
    return jsonNoStore({ error: "Invalid school id" }, 400);
  }
  if (requestedSubject && !UUID_RE.test(requestedSubject)) {
    return jsonNoStore({ error: "Invalid subject id" }, 400);
  }

  try {
    const [schools, subjects] = await Promise.all([
      restAsUser("schools?select=id,name,trust_id&order=name.asc&limit=100", auth.token),
      restAsUser("subjects?select=id,name,slug&order=sort_order.asc&limit=100", auth.token),
    ]);
    const schoolId =
      requestedSchool ||
      auth.profile.school_id ||
      (Array.isArray(schools) ? schools[0]?.id : null) ||
      null;

    let objectiveSubjectId: string | null = null;
    if (requestedObjective && UUID_RE.test(requestedObjective)) {
      objectiveSubjectId = (
        await restAsUser<any[]>(
          `objectives?id=eq.${requestedObjective}&select=subject_id&limit=1`,
          auth.token,
        )
      )?.[0]?.subject_id;
    }
    const subjectId =
      requestedSubject ||
      objectiveSubjectId ||
      (Array.isArray(subjects) ? subjects[0]?.id : null);
    if (!subjectId) {
      return jsonNoStore({
        enabled: true,
        profile: auth.profile,
        schools,
        subjects,
        selectedSchoolId: schoolId,
        selectedSubjectId: null,
        objectives: [],
      });
    }

    try {
      const rows = await graphRows(auth.token, subjectId, schoolId);
      return jsonNoStore({
        enabled: true,
        profile: auth.profile,
        schools,
        subjects,
        selectedSchoolId: schoolId,
        selectedSubjectId: subjectId,
        selectedObjectiveId:
          requestedObjective && rows.objectives.some((row: any) => row.id === requestedObjective)
            ? requestedObjective
            : rows.objectives[0]?.id || null,
        ...rows,
        coverage: curriculumGraphCoverage(rows),
        permissions: {
          canManage: await canManageScope(auth, schoolId),
          scope: schoolId ? "school" : "global",
        },
        guardrails: {
          inferredAssertionsAutoApproved: false,
          generationUsesApprovedOnly: true,
          prerequisiteDepthLimit: 12,
        },
      });
    } catch (error) {
      if (graphMigrationPending(error)) {
        const objectives = await restAsUser(
          `objectives?subject_id=eq.${subjectId}&select=id,subject_id,unit_id,lesson_id,code,title,key_stage,sort_order&order=sort_order.asc&limit=600`,
          auth.token,
        );
        return jsonNoStore({
          enabled: false,
          reason: "stage13_migration_pending",
          profile: auth.profile,
          schools,
          subjects,
          selectedSchoolId: schoolId,
          selectedSubjectId: subjectId,
          objectives,
        });
      }
      throw error;
    }
  } catch {
    return jsonNoStore({ error: "Couldn't load the curriculum knowledge graph" }, 500);
  }
}

async function seedGraph(
  auth: IntelligenceAuth,
  subjectId: string,
  schoolId: string | null,
) {
  const rows = await graphRows(auth.token, subjectId, schoolId);
  const lessons = rows.lessons;
  const inExactScope = (row: any) => (row.school_id || null) === schoolId;
  const lessonOrder = Object.fromEntries(
    (lessons || []).map((row: any) => [
      row.id,
      Number(row.sort_order ?? row.lesson_number ?? Number.MAX_SAFE_INTEGER),
    ]),
  );

  const existingProfiles = rows.profiles.filter(inExactScope);
  const profiled = new Set((existingProfiles || []).map((row: any) => row.objective_id));
  const newProfiles = rows.objectives
    .filter((row: any) => !profiled.has(row.id))
    .map((row: any) => ({
      objective_id: row.id,
      school_id: schoolId,
      statement: row.title,
      status: "proposed",
      source_kind: "sequence_seed",
      source_ref: row.lesson_id ? `lesson:${row.lesson_id}` : row.unit_id ? `unit:${row.unit_id}` : null,
      confidence: 0.7,
      rationale: "Seeded from the existing canonical objective; curriculum-lead review required.",
      provenance: { stage: 13, sourceTable: "objectives" },
      created_by: auth.userId,
    }));
  if (newProfiles.length) {
    await skAdmin("POST", "curriculum_objective_profiles", newProfiles);
  }

  const existingLinks = rows.links.filter(
    (row: any) => inExactScope(row) && row.status !== "rejected",
  );
  const linkKeys = new Set(
    (existingLinks || []).map(
      (row: any) => `${row.from_objective_id}:${row.to_objective_id}:${row.link_type}`,
    ),
  );
  const candidates = sequenceLinkCandidates(
    rows.objectives as CurriculumObjectiveNode[],
    lessonOrder,
  )
    .filter(
      (row) =>
        !linkKeys.has(`${row.from_objective_id}:${row.to_objective_id}:${row.link_type}`),
    )
    .filter(
      (row, index, all) =>
        all.findIndex(
          (other) =>
            other.from_objective_id === row.from_objective_id &&
            other.to_objective_id === row.to_objective_id &&
            other.link_type === row.link_type,
        ) === index,
    )
    .slice(0, 500);
  const effectiveEdges = rows.links as CurriculumGraphEdge[];
  const safeCandidates: CurriculumGraphEdge[] = [];
  for (const candidate of candidates) {
    if (!wouldCreateCurriculumCycle([...effectiveEdges, ...safeCandidates], candidate)) {
      safeCandidates.push(candidate);
    }
  }
  if (safeCandidates.length) {
    await skAdmin(
      "POST",
      "curriculum_objective_links",
      safeCandidates.map((row) => ({
        subject_id: subjectId,
        school_id: schoolId,
        ...row,
        source_kind: "sequence_seed",
        source_ref: "adjacent_lesson_order",
        confidence: 0.45,
        evidence: { stage: 13, assertion: "sequence_hint_not_prerequisite_fact" },
        created_by: auth.userId,
      })),
    );
  }

  const objectiveByLesson = new Map<string, any[]>();
  for (const objective of rows.objectives) {
    if (!objective.lesson_id) continue;
    const values = objectiveByLesson.get(objective.lesson_id) || [];
    values.push(objective);
    objectiveByLesson.set(objective.lesson_id, values);
  }

  const existingVocabulary = rows.vocabulary.filter(
    (row: any) => inExactScope(row) && row.status !== "rejected",
  );
  const vocabularyByTerm = new Map<string, any>(
    (existingVocabulary || []).map((row: any) => [String(row.term).toLowerCase(), row]),
  );
  const vocabularySeeds = new Map<string, { term: string; lessonId: string }>();
  for (const lesson of lessons || []) {
    for (const raw of Array.isArray(lesson.keywords) ? lesson.keywords : []) {
      const term = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (term) vocabularySeeds.set(term.toLowerCase(), { term, lessonId: lesson.id });
    }
  }
  const newVocabulary = [...vocabularySeeds.entries()]
    .filter(([key]) => !vocabularyByTerm.has(key))
    .map(([, seed]) => ({
      subject_id: subjectId,
      school_id: schoolId,
      term: seed.term,
      tier: 3,
      status: "proposed",
      source_kind: "sequence_seed",
      source_ref: `lesson:${seed.lessonId}`,
      confidence: 0.75,
      provenance: { stage: 13, sourceField: "lessons.keywords" },
      created_by: auth.userId,
    }));
  const createdVocabulary = newVocabulary.length
    ? await skAdmin("POST", "curriculum_vocabulary", newVocabulary)
    : [];
  for (const row of createdVocabulary || []) {
    vocabularyByTerm.set(String(row.term).toLowerCase(), row);
  }

  const existingVocabularyMaps = rows.objectiveVocabulary.filter(
    (row: any) => inExactScope(row) && row.status !== "rejected",
  );
  const vocabularyMapKeys = new Set(
    (existingVocabularyMaps || []).map(
      (row: any) => `${row.objective_id}:${row.vocabulary_id}`,
    ),
  );
  const vocabularyMaps: any[] = [];
  for (const lesson of lessons || []) {
    for (const raw of Array.isArray(lesson.keywords) ? lesson.keywords : []) {
      const vocabulary = vocabularyByTerm.get(String(raw || "").trim().toLowerCase());
      if (!vocabulary) continue;
      for (const objective of objectiveByLesson.get(lesson.id) || []) {
        const key = `${objective.id}:${vocabulary.id}`;
        if (vocabularyMapKeys.has(key)) continue;
        vocabularyMapKeys.add(key);
        vocabularyMaps.push({
          objective_id: objective.id,
          vocabulary_id: vocabulary.id,
          school_id: schoolId,
          role: "essential",
          status: "proposed",
          source_kind: "sequence_seed",
          rationale: "Inherited from the existing lesson keyword list; review required.",
          created_by: auth.userId,
        });
      }
    }
  }
  if (vocabularyMaps.length) {
    await skAdmin("POST", "curriculum_objective_vocabulary", vocabularyMaps.slice(0, 1500));
  }

  const existingMisconceptions = rows.misconceptions.filter(
    (row: any) => inExactScope(row) && row.status !== "rejected",
  );
  const misconceptionByTitle = new Map<string, any>(
    (existingMisconceptions || []).map((row: any) => [String(row.title).toLowerCase(), row]),
  );
  const misconceptionSeeds = new Map<string, { title: string; description: string; lessonId: string }>();
  for (const lesson of lessons || []) {
    const description = String(lesson.misconception_alerts || "").trim().replace(/\s+/g, " ");
    const title = textTitle(description);
    if (title) {
      misconceptionSeeds.set(title.toLowerCase(), {
        title,
        description: description.slice(0, 3000),
        lessonId: lesson.id,
      });
    }
  }
  const newMisconceptions = [...misconceptionSeeds.entries()]
    .filter(([key]) => !misconceptionByTitle.has(key))
    .map(([, seed]) => ({
      subject_id: subjectId,
      school_id: schoolId,
      title: seed.title,
      description: seed.description,
      pattern_kind: "conceptual",
      status: "proposed",
      source_kind: "sequence_seed",
      source_ref: `lesson:${seed.lessonId}`,
      confidence: 0.55,
      provenance: { stage: 13, sourceField: "lessons.misconception_alerts" },
      created_by: auth.userId,
    }));
  const createdMisconceptions = newMisconceptions.length
    ? await skAdmin("POST", "curriculum_misconceptions", newMisconceptions)
    : [];
  for (const row of createdMisconceptions || []) {
    misconceptionByTitle.set(String(row.title).toLowerCase(), row);
  }

  const existingMisconceptionMaps = rows.objectiveMisconceptions.filter(
    (row: any) => inExactScope(row) && row.status !== "rejected",
  );
  const misconceptionMapKeys = new Set(
    (existingMisconceptionMaps || []).map(
      (row: any) => `${row.objective_id}:${row.misconception_id}`,
    ),
  );
  const misconceptionMaps: any[] = [];
  for (const lesson of lessons || []) {
    const misconception = misconceptionByTitle.get(
      textTitle(lesson.misconception_alerts).toLowerCase(),
    );
    if (!misconception) continue;
    for (const objective of objectiveByLesson.get(lesson.id) || []) {
      const key = `${objective.id}:${misconception.id}`;
      if (misconceptionMapKeys.has(key)) continue;
      misconceptionMapKeys.add(key);
      misconceptionMaps.push({
        objective_id: objective.id,
        misconception_id: misconception.id,
        school_id: schoolId,
        priority: 2,
        status: "proposed",
        source_kind: "sequence_seed",
        rationale: "Inherited from the existing lesson misconception alert; review required.",
        created_by: auth.userId,
      });
    }
  }
  if (misconceptionMaps.length) {
    await skAdmin(
      "POST",
      "curriculum_objective_misconceptions",
      misconceptionMaps.slice(0, 1000),
    );
  }

  const summary = {
    objectiveProfiles: newProfiles.length,
    sequenceLinks: safeCandidates.length,
    vocabularyTerms: newVocabulary.length,
    vocabularyMappings: vocabularyMaps.length,
    misconceptions: newMisconceptions.length,
    misconceptionMappings: misconceptionMaps.length,
  };
  await skAdmin("POST", "curriculum_graph_events", {
    school_id: schoolId,
    subject_id: subjectId,
    entity_kind: "batch",
    entity_id: null,
    event_type: "seeded",
    after_snapshot: summary,
    actor_id: auth.userId,
  });
  return summary;
}

export async function POST(request: Request) {
  let auth: IntelligenceAuth | null;
  try {
    auth = await authenticateIntelligence(request);
  } catch {
    return jsonNoStore({ error: "Couldn't resolve your curriculum scope" }, 500);
  }
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, 400);
  }
  const operation = String(body.operation || "");
  const schoolId =
    body.scope === "global" || body.schoolId == null || body.schoolId === ""
      ? null
      : String(body.schoolId);
  if (schoolId && !UUID_RE.test(schoolId)) return jsonNoStore({ error: "Invalid school id" }, 400);
  if (!(await canManageScope(auth, schoolId))) {
    return jsonNoStore({ error: "Curriculum-lead scope required" }, 403);
  }

  if (operation === "seed") {
    const subjectId = String(body.subjectId || "");
    if (!UUID_RE.test(subjectId)) return jsonNoStore({ error: "Choose a valid subject" }, 400);
    try {
      return jsonNoStore({ seeded: await seedGraph(auth, subjectId, schoolId) }, 201);
    } catch (error) {
      if (graphMigrationPending(error)) {
        return jsonNoStore({ error: "Apply the Stage 13 migration before seeding the graph" }, 503);
      }
      return jsonNoStore({ error: `Couldn't seed graph proposals: ${String((error as any)?.message || "").slice(0, 180)}` }, 500);
    }
  }

  if (operation === "create_link") {
    const fromObjectiveId = String(body.fromObjectiveId || "");
    const toObjectiveId = String(body.toObjectiveId || "");
    const linkType = String(body.linkType || "");
    if (!UUID_RE.test(fromObjectiveId) || !UUID_RE.test(toObjectiveId)) {
      return jsonNoStore({ error: "Choose two valid objectives" }, 400);
    }
    if (!["prerequisite_of", "supports", "extends", "contrasts_with", "part_of"].includes(linkType)) {
      return jsonNoStore({ error: "Invalid relationship type" }, 400);
    }
    try {
      const objectives = await restAsUser<any[]>(
        `objectives?id=in.(${fromObjectiveId},${toObjectiveId})&select=id,subject_id`,
        auth.token,
      );
      if (objectives.length !== 2 || objectives[0].subject_id !== objectives[1].subject_id) {
        return jsonNoStore({ error: "Both objectives must exist in the same subject" }, 400);
      }
      const scope = scopeFilter(schoolId);
      const edges = await restAsUser<CurriculumGraphEdge[]>(
        `curriculum_objective_links?${scope}&subject_id=eq.${objectives[0].subject_id}&status=neq.rejected&select=from_objective_id,to_objective_id,link_type,status`,
        auth.token,
      );
      const candidate = {
        from_objective_id: fromObjectiveId,
        to_objective_id: toObjectiveId,
        link_type: linkType as any,
      };
      if (wouldCreateCurriculumCycle(edges || [], candidate)) {
        return jsonNoStore({ error: "That prerequisite would create a curriculum cycle" }, 409);
      }
      const created = (
        await skAdmin("POST", "curriculum_objective_links", {
          subject_id: objectives[0].subject_id,
          school_id: schoolId,
          from_objective_id: fromObjectiveId,
          to_objective_id: toObjectiveId,
          link_type: linkType,
          strength: body.strength === "required" ? "required" : "supporting",
          status: "proposed",
          source_kind: "human",
          confidence: null,
          rationale: String(body.rationale || "").trim().slice(0, 2000) || null,
          evidence: { stage: 13, submittedFrom: "curriculum_graph_workbench" },
          created_by: auth.userId,
        })
      )?.[0];
      await skAdmin("POST", "curriculum_graph_events", {
        school_id: schoolId,
        subject_id: objectives[0].subject_id,
        entity_kind: "objective_link",
        entity_id: created.id,
        event_type: "proposed",
        after_snapshot: created,
        actor_id: auth.userId,
      });
      return jsonNoStore({ link: created }, 201);
    } catch (error: any) {
      if (/duplicate key|23505/.test(String(error?.message || ""))) {
        return jsonNoStore({ error: "That relationship is already in the review graph" }, 409);
      }
      if (/cycle|23514/.test(String(error?.message || ""))) {
        return jsonNoStore({ error: "That prerequisite would create a curriculum cycle" }, 409);
      }
      return jsonNoStore({ error: "Couldn't create the curriculum relationship" }, 500);
    }
  }

  if (operation === "review") {
    const entityKind = String(body.entityKind || "") as keyof typeof REVIEW_TABLES;
    const table = REVIEW_TABLES[entityKind];
    const entityId = String(body.entityId || "");
    const decision = String(body.decision || "");
    if (!table || !UUID_RE.test(entityId) || !["approved", "rejected"].includes(decision)) {
      return jsonNoStore({ error: "Invalid review decision" }, 400);
    }
    try {
      const before = (
        await restAsUser<any[]>(`${table}?id=eq.${entityId}&select=*&limit=1`, auth.token)
      )?.[0];
      if (!before) return jsonNoStore({ error: "Assertion not found in your scope" }, 404);
      if ((before.school_id || null) !== schoolId) {
        return jsonNoStore({ error: "Review the assertion in its original scope" }, 409);
      }
      const after = (
        await skAdmin("PATCH", `${table}?id=eq.${entityId}`, {
          status: decision,
          reviewed_by: auth.userId,
          reviewed_at: new Date().toISOString(),
        })
      )?.[0];
      await skAdmin("POST", "curriculum_graph_events", {
        school_id: schoolId,
        subject_id: before.subject_id || body.subjectId || null,
        entity_kind: entityKind,
        entity_id: entityId,
        event_type: decision,
        before_snapshot: before,
        after_snapshot: after,
        actor_id: auth.userId,
      });
      return jsonNoStore({ assertion: after });
    } catch (error: any) {
      if (/cycle|23514/.test(String(error?.message || ""))) {
        return jsonNoStore({ error: "Approval would introduce a prerequisite cycle" }, 409);
      }
      return jsonNoStore({ error: "Couldn't record the curriculum review" }, 500);
    }
  }

  return jsonNoStore({ error: "Unsupported curriculum graph operation" }, 400);
}
