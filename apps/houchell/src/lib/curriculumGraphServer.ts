import type { CurriculumGenerationContext } from "@/lib/curriculumGraph";
import { restAsUser } from "@/lib/intelligence/server";

const scopeFilter = (schoolId: string | null) =>
  schoolId
    ? `or=(school_id.is.null,school_id.eq.${schoolId})`
    : "school_id=is.null";

export async function loadApprovedCurriculumContext(input: {
  token: string;
  objectiveId: string;
  schoolId: string | null;
}): Promise<CurriculumGenerationContext> {
  const objective = (
    await restAsUser<any[]>(
      `objectives?id=eq.${input.objectiveId}&select=id,subject_id,code,title&limit=1`,
      input.token,
    )
  )?.[0];
  if (!objective) {
    return {
      schemaVersion: 1,
      objective: null,
      prerequisites: [],
      unlocks: [],
      misconceptions: [],
      vocabulary: [],
      provenance: {
        approvedOnly: true,
        graphVersion: "reviewed_curriculum_graph_v1",
      },
    };
  }

  const scope = scopeFilter(input.schoolId);
  const [profiles, subjectLinks, misconceptionMaps, vocabularyMaps] = await Promise.all([
    restAsUser<any[]>(
      `curriculum_objective_profiles?${scope}&objective_id=eq.${objective.id}&status=eq.approved&select=*&limit=5`,
      input.token,
    ),
    restAsUser<any[]>(
      `curriculum_objective_links?${scope}&subject_id=eq.${objective.subject_id}&status=eq.approved&select=id,from_objective_id,to_objective_id,link_type,strength,rationale&limit=2000`,
      input.token,
    ),
    restAsUser<any[]>(
      `curriculum_objective_misconceptions?${scope}&objective_id=eq.${objective.id}&status=eq.approved&select=misconception_id,priority&order=priority.asc&limit=20`,
      input.token,
    ),
    restAsUser<any[]>(
      `curriculum_objective_vocabulary?${scope}&objective_id=eq.${objective.id}&status=eq.approved&select=vocabulary_id,role&limit=40`,
      input.token,
    ),
  ]);

  const links = (subjectLinks || []).filter(
    (row: any) =>
      row.from_objective_id === objective.id || row.to_objective_id === objective.id,
  );
  const relatedIds = [
    ...new Set(
      links.flatMap((row: any) => [row.from_objective_id, row.to_objective_id]),
    ),
  ].filter((id) => id !== objective.id);
  const misconceptionIds = (misconceptionMaps || []).map((row: any) => row.misconception_id);
  const vocabularyIds = (vocabularyMaps || []).map((row: any) => row.vocabulary_id);

  const [relatedObjectives, misconceptions, vocabulary] = await Promise.all([
    relatedIds.length
      ? restAsUser<any[]>(
          `objectives?id=in.(${relatedIds.join(",")})&select=id,code,title&limit=200`,
          input.token,
        )
      : [],
    misconceptionIds.length
      ? restAsUser<any[]>(
          `curriculum_misconceptions?${scope}&id=in.(${misconceptionIds.join(",")})&status=eq.approved&select=id,title,description,diagnostic_prompt,correction_strategy&limit=40`,
          input.token,
        )
      : [],
    vocabularyIds.length
      ? restAsUser<any[]>(
          `curriculum_vocabulary?${scope}&id=in.(${vocabularyIds.join(",")})&status=eq.approved&select=id,term,definition&limit=80`,
          input.token,
        )
      : [],
  ]);
  const objectiveById = new Map(
    (relatedObjectives || []).map((row: any) => [row.id, row]),
  );
  const misconceptionById = new Map(
    (misconceptions || []).map((row: any) => [row.id, row]),
  );
  const vocabularyById = new Map(
    (vocabulary || []).map((row: any) => [row.id, row]),
  );
  const profile =
    (profiles || []).find((row: any) => row.school_id === input.schoolId) ||
    (profiles || []).find((row: any) => row.school_id == null) ||
    null;

  return {
    schemaVersion: 1,
    objective: {
      id: objective.id,
      code: objective.code,
      title: objective.title,
    },
    statement: profile?.statement || null,
    successCriteria: Array.isArray(profile?.success_criteria)
      ? profile.success_criteria.map(String)
      : [],
    prerequisites: links
      .filter(
        (row: any) =>
          row.link_type === "prerequisite_of" &&
          row.to_objective_id === objective.id,
      )
      .map((row: any) => ({
        ...(objectiveById.get(row.from_objective_id) as any),
        strength: row.strength,
        rationale: row.rationale,
      }))
      .filter((row: any) => row.id),
    unlocks: links
      .filter(
        (row: any) =>
          row.link_type === "prerequisite_of" &&
          row.from_objective_id === objective.id,
      )
      .map((row: any) => ({
        ...(objectiveById.get(row.to_objective_id) as any),
        rationale: row.rationale,
      }))
      .filter((row: any) => row.id),
    misconceptions: (misconceptionMaps || [])
      .map((mapping: any) => misconceptionById.get(mapping.misconception_id))
      .filter(Boolean)
      .map((row: any) => ({
        title: row.title,
        description: row.description,
        diagnosticPrompt: row.diagnostic_prompt,
        correctionStrategy: row.correction_strategy,
      })),
    vocabulary: (vocabularyMaps || [])
      .map((mapping: any) => {
        const row: any = vocabularyById.get(mapping.vocabulary_id);
        return row
          ? { term: row.term, definition: row.definition, role: mapping.role }
          : null;
      })
      .filter(Boolean) as any,
    practicalRequirements: profile?.practical_requirements || null,
    readingDemand: profile?.reading_demand || null,
    provenance: {
      approvedOnly: true,
      graphVersion: "reviewed_curriculum_graph_v1",
    },
  };
}
