export type CurriculumLinkType =
  | "prerequisite_of"
  | "supports"
  | "extends"
  | "contrasts_with"
  | "part_of";

export interface CurriculumObjectiveNode {
  id: string;
  subject_id?: string | null;
  unit_id?: string | null;
  lesson_id?: string | null;
  code?: string | null;
  title: string;
  sort_order?: number | null;
  lesson_number?: number | null;
}
export interface CurriculumGraphEdge {
  id?: string;
  from_objective_id: string;
  to_objective_id: string;
  link_type: CurriculumLinkType;
  status?: "proposed" | "approved" | "rejected";
  strength?: "required" | "supporting";
  rationale?: string | null;
}

export interface CurriculumGenerationContext {
  schemaVersion: 1;
  objective: { id: string; code?: string | null; title: string } | null;
  statement?: string | null;
  successCriteria?: string[];
  prerequisites: Array<{
    id: string;
    code?: string | null;
    title: string;
    strength?: string | null;
    rationale?: string | null;
  }>;
  unlocks: Array<{
    id: string;
    code?: string | null;
    title: string;
    rationale?: string | null;
  }>;
  misconceptions: Array<{
    title: string;
    description?: string | null;
    diagnosticPrompt?: string | null;
    correctionStrategy?: string | null;
  }>;
  vocabulary: Array<{
    term: string;
    definition?: string | null;
    role?: string | null;
  }>;
  practicalRequirements?: string | null;
  readingDemand?: number | null;
  provenance: {
    approvedOnly: true;
    graphVersion: "reviewed_curriculum_graph_v1";
  };
}

const normalise = (value: unknown) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

export function wouldCreateCurriculumCycle(
  edges: CurriculumGraphEdge[],
  candidate: Pick<CurriculumGraphEdge, "from_objective_id" | "to_objective_id" | "link_type">,
): boolean {
  if (candidate.link_type !== "prerequisite_of") return false;
  if (candidate.from_objective_id === candidate.to_objective_id) return true;

  const outgoing = new Map<string, string[]>();
  for (const edge of [...edges, candidate as CurriculumGraphEdge]) {
    if (edge.link_type !== "prerequisite_of" || edge.status === "rejected") continue;
    const next = outgoing.get(edge.from_objective_id) || [];
    next.push(edge.to_objective_id);
    outgoing.set(edge.from_objective_id, next);
  }

  const target = candidate.from_objective_id;
  const queue = [candidate.to_objective_id];
  const seen = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(outgoing.get(current) || []));
  }
  return false;
}

/**
 * Build conservative proposals only between adjacent taught lessons.
 * These are sequence hints, not approved prerequisite claims.
 */
export function sequenceLinkCandidates(
  objectives: CurriculumObjectiveNode[],
  lessonOrder: Record<string, number>,
): CurriculumGraphEdge[] {
  const byUnit = new Map<string, CurriculumObjectiveNode[]>();
  for (const objective of objectives) {
    if (!objective.unit_id || !objective.lesson_id) continue;
    const rows = byUnit.get(objective.unit_id) || [];
    rows.push(objective);
    byUnit.set(objective.unit_id, rows);
  }

  const candidates: CurriculumGraphEdge[] = [];
  for (const [unitId, unitObjectives] of byUnit) {
    const byLesson = new Map<string, CurriculumObjectiveNode[]>();
    for (const objective of unitObjectives) {
      const rows = byLesson.get(objective.lesson_id!) || [];
      rows.push(objective);
      byLesson.set(objective.lesson_id!, rows);
    }
    const lessonIds = [...byLesson.keys()].sort(
      (a, b) => (lessonOrder[a] ?? Number.MAX_SAFE_INTEGER) - (lessonOrder[b] ?? Number.MAX_SAFE_INTEGER),
    );
    for (let index = 1; index < lessonIds.length; index++) {
      const previous = (byLesson.get(lessonIds[index - 1]) || []).sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
      );
      const current = (byLesson.get(lessonIds[index]) || []).sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0),
      );
      if (!previous.length || !current.length) continue;
      const pairCount = Math.max(previous.length, current.length);
      for (let pair = 0; pair < pairCount; pair++) {
        const from = previous[Math.min(pair, previous.length - 1)];
        const to = current[Math.min(pair, current.length - 1)];
        candidates.push({
          from_objective_id: from.id,
          to_objective_id: to.id,
          link_type: "prerequisite_of",
          strength: "supporting",
          status: "proposed",
          rationale: `Suggested from adjacent lesson order in unit ${unitId}; requires curriculum-lead review.`,
        });
      }
    }
  }
  return candidates;
}

export function curriculumGraphCoverage(input: {
  objectives: Array<{ id: string }>;
  profiles: Array<{ objective_id: string; status: string }>;
  links: Array<{ status: string }>;
  objectiveMisconceptions: Array<{ objective_id: string; status: string }>;
  objectiveVocabulary: Array<{ objective_id: string; status: string }>;
}) {
  const objectiveIds = new Set(input.objectives.map((row) => row.id));
  const approvedProfiles = new Set(
    input.profiles
      .filter((row) => row.status === "approved" && objectiveIds.has(row.objective_id))
      .map((row) => row.objective_id),
  );
  const misconceptionCoverage = new Set(
    input.objectiveMisconceptions
      .filter((row) => row.status === "approved" && objectiveIds.has(row.objective_id))
      .map((row) => row.objective_id),
  );
  const vocabularyCoverage = new Set(
    input.objectiveVocabulary
      .filter((row) => row.status === "approved" && objectiveIds.has(row.objective_id))
      .map((row) => row.objective_id),
  );
  const total = objectiveIds.size;
  const pct = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  return {
    objectives: total,
    approvedProfiles: approvedProfiles.size,
    profileCoveragePct: pct(approvedProfiles.size),
    misconceptionCoveragePct: pct(misconceptionCoverage.size),
    vocabularyCoveragePct: pct(vocabularyCoverage.size),
    approvedLinks: input.links.filter((row) => row.status === "approved").length,
    proposedAssertions:
      input.links.filter((row) => row.status === "proposed").length +
      input.profiles.filter((row) => row.status === "proposed").length +
      input.objectiveMisconceptions.filter((row) => row.status === "proposed").length +
      input.objectiveVocabulary.filter((row) => row.status === "proposed").length,
  };
}

const bounded = <T>(values: T[], limit: number) => values.slice(0, limit);

export function buildCurriculumGraphPrompt(context: CurriculumGenerationContext): string {
  if (!context.objective) return "";
  const lines = [
    "Use the following human-reviewed curriculum graph as bounded curriculum context.",
    `Target objective: ${normalise(context.objective.code)}${context.objective.code ? " — " : ""}${normalise(context.objective.title)}.`,
    context.statement ? `Curriculum statement: ${normalise(context.statement)}.` : "",
    context.successCriteria?.length
      ? `Success criteria: ${bounded(context.successCriteria, 6).map(normalise).join("; ")}.`
      : "",
    context.prerequisites.length
      ? `Secure or diagnose these prerequisites first: ${bounded(context.prerequisites, 8)
          .map((row) => `${normalise(row.title)}${row.strength === "required" ? " [required]" : ""}`)
          .join("; ")}.`
      : "",
    context.misconceptions.length
      ? `Confront these reviewed misconceptions: ${bounded(context.misconceptions, 8)
          .map((row) => `${normalise(row.title)} — ${normalise(row.description)}`)
          .join("; ")}.`
      : "",
    context.vocabulary.length
      ? `Teach and check this vocabulary: ${bounded(context.vocabulary, 14)
          .map((row) => `${normalise(row.term)}${row.definition ? ` (${normalise(row.definition)})` : ""}`)
          .join("; ")}.`
      : "",
    context.practicalRequirements
      ? `Practical requirement: ${normalise(context.practicalRequirements)}.`
      : "",
    context.unlocks.length
      ? `Preserve progression towards: ${bounded(context.unlocks, 6)
          .map((row) => normalise(row.title))
          .join("; ")}.`
      : "",
    "Treat this as reviewed guidance, not proof that any pupil has a misconception. Use the lesson evidence to diagnose before adapting.",
  ];
  return lines.filter(Boolean).join("\n").slice(0, 8000);
}
