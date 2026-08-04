import {
  LEVEL_DEFS,
  levelForProfile,
  type Level,
} from "@/lib/intel/scope";

export type BrainHealthStatus =
  | "healthy"
  | "degraded"
  | "stale"
  | "blocked"
  | "unknown";

export interface SourceHealth {
  source_key: string;
  domain: string;
  required: boolean;
  status: BrainHealthStatus;
  last_event_at?: string | null;
  freshness_minutes?: number | null;
  accepted_records?: number;
  rejected_records?: number;
  unresolved_records?: number;
  checked_at?: string;
  detail?: Record<string, unknown>;
}

export interface BrainHealthSummary {
  status: BrainHealthStatus;
  checkedAt: string | null;
  healthy: number;
  attention: number;
  sources: SourceHealth[];
}

export interface OperatingSystemItem {
  id: string;
  kind: "recommendation" | "action" | "recheck" | "finding";
  lane: "now" | "next" | "watch";
  title: string;
  why: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueAt: string | null;
  actionId: string | null;
  recommendationId: string | null;
  href: string | null;
  humanDecisionRequired: boolean;
  score: number;
}

export interface RoleOperatingContract {
  level: Level;
  label: string;
  job: string;
  headline: string;
  queueLimit: number;
}

const PRIORITY_SCORE = { low: 5, normal: 15, high: 30, urgent: 50 } as const;

const validPriority = (value: unknown): keyof typeof PRIORITY_SCORE =>
  value === "low" || value === "high" || value === "urgent" ? value : "normal";

const dueScore = (dueAt: unknown, now: Date) => {
  const parsed = Date.parse(String(dueAt || ""));
  if (!Number.isFinite(parsed)) return 0;
  const days = (parsed - now.getTime()) / 86_400_000;
  if (days < 0) return 35;
  if (days <= 1) return 25;
  if (days <= 7) return 10;
  return 0;
};

export function operatingContract(profile: unknown): RoleOperatingContract {
  const level = levelForProfile((profile || {}) as Record<string, unknown>);
  const definition = LEVEL_DEFS[level];
  const headline =
    level === "trust"
      ? "Where does the trust need to unblock capacity or assure impact?"
      : level === "school"
        ? "What changed across the school, and who needs coordination today?"
        : level === "department"
          ? "What is not landing, and what response should the department align?"
          : "What changed for my classes, and what should I do next?";
  return {
    level,
    label: definition.label,
    job: definition.job,
    headline,
    queueLimit: level === "teacher" ? 8 : 12,
  };
}

export function summariseBrainHealth(rows: SourceHealth[]): BrainHealthSummary {
  const sources = [...rows].sort(
    (a, b) => Number(b.required) - Number(a.required) || a.source_key.localeCompare(b.source_key),
  );
  const required = sources.filter((source) => source.required);
  const status: BrainHealthStatus = required.some((source) => source.status === "blocked")
    ? "blocked"
    : required.some((source) => source.status === "stale")
      ? "stale"
      : sources.some((source) => source.status === "degraded")
        ? "degraded"
        : required.length > 0 && required.every((source) => source.status === "healthy")
          ? "healthy"
          : "unknown";
  const checkedAt = sources.reduce<string | null>((latest, source) => {
    if (!source.checked_at) return latest;
    if (!latest || Date.parse(source.checked_at) > Date.parse(latest)) return source.checked_at;
    return latest;
  }, null);
  return {
    status,
    checkedAt,
    healthy: sources.filter((source) => source.status === "healthy").length,
    attention: sources.filter((source) =>
      ["blocked", "degraded", "stale"].includes(source.status),
    ).length,
    sources,
  };
}

export function buildTodayQueue(input: {
  findings?: any[];
  recommendations?: any[];
  rechecks?: any[];
  now?: Date;
  limit?: number;
}): OperatingSystemItem[] {
  const now = input.now || new Date();
  const items: OperatingSystemItem[] = [];

  for (const recommendation of input.recommendations || []) {
    if (recommendation.status !== "proposed") continue;
    const priority = validPriority(recommendation.priority);
    items.push({
      id: `recommendation:${recommendation.id}`,
      kind: "recommendation",
      lane: "now",
      title: String(recommendation.headline || "Review recommendation"),
      why: String(recommendation.rationale || "A governed recommendation is waiting for a human decision."),
      priority,
      dueAt: null,
      actionId: null,
      recommendationId: recommendation.id,
      href: null,
      humanDecisionRequired: true,
      score: 100 + PRIORITY_SCORE[priority],
    });
  }

  for (const recheck of input.rechecks || []) {
    if (recheck.status !== "scheduled") continue;
    const dueAt = String(recheck.due_at || "") || null;
    const urgency = dueScore(dueAt, now);
    const actionId = recheck.action_id || null;
    items.push({
      id: `recheck:${recheck.id}`,
      kind: "recheck",
      lane: urgency >= 25 ? "now" : "next",
      title: `Complete recheck: ${recheck.finding?.headline || recheck.objective_key || "learning response"}`,
      why: "The response loop needs a delayed check before any learning claim is made.",
      priority: urgency >= 25 ? "high" : "normal",
      dueAt,
      actionId,
      recommendationId: null,
      href: actionId ? `/response/${actionId}` : null,
      humanDecisionRequired: false,
      score: 70 + urgency,
    });
  }

  for (const finding of input.findings || []) {
    const actions = Array.isArray(finding.actions) ? finding.actions : [];
    for (const action of actions) {
      if (!["proposed", "accepted", "in_progress"].includes(action.status)) continue;
      const priority = validPriority(action.priority);
      const dueAt = String(action.due_at || "") || null;
      const waiting = action.status === "proposed" && action.requires_human_acceptance !== false;
      const urgency = dueScore(dueAt, now);
      const lane = waiting || urgency >= 25 ? "now" : action.status === "in_progress" ? "now" : "next";
      items.push({
        id: `action:${action.id}`,
        kind: "action",
        lane,
        title: String(action.title || finding.headline || "Intelligence action"),
        why: String(action.description || finding.summary || "A reviewed finding needs a response."),
        priority,
        dueAt,
        actionId: action.id,
        recommendationId: null,
        href: action.status === "proposed" ? null : `/response/${action.id}`,
        humanDecisionRequired: waiting,
        score: (waiting ? 85 : 45) + PRIORITY_SCORE[priority] + urgency,
      });
    }
    if (finding.status === "open" && actions.length === 0) {
      items.push({
        id: `finding:${finding.id}`,
        kind: "finding",
        lane: "watch",
        title: String(finding.headline || "Review finding"),
        why: String(finding.summary || "This finding has no agreed response yet."),
        priority: validPriority(finding.evidence_strength === "strong" ? "high" : "normal"),
        dueAt: null,
        actionId: null,
        recommendationId: null,
        href: finding.objective_id ? `/objective/${finding.objective_id}` : null,
        humanDecisionRequired: true,
        score: finding.evidence_strength === "strong" ? 50 : 25,
      });
    }
  }

  const deduplicated = [...new Map(items.map((item) => [item.id, item])).values()];
  return deduplicated
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, input.limit || 12));
}

export interface LessonBundleSpec {
  schemaVersion: 2;
  purpose: "evidence_responsive_lesson";
  learningTarget: string;
  audience: {
    classId: string | null;
    pupilsObserved: number | null;
  };
  evidenceBasis: {
    findingId: string;
    evidenceAsOf: string;
    baselineMasteryPct: number | null;
    evidenceCount: number | null;
    uncertaintyPoints: number | null;
  };
  curriculum: {
    unitId: string;
    lessonId: string | null;
    approvedGraphOnly: true;
    graphVersion: number | string | null;
    prerequisites: string[];
    misconceptions: string[];
    vocabulary: string[];
  };
  sequence: Array<{ phase: string; purpose: string; required: boolean }>;
  adaptiveBranches: Array<{ when: string; then: string }>;
  outputBundle: string[];
  delayedRecheck: { required: true; schoolDays: { min: 5; max: 10 }; parallel: true };
  guardrails: string[];
}

const boundedStrings = (values: unknown, limit: number) =>
  (Array.isArray(values) ? values : [])
    .map((value: any) => String(value?.title || value?.term || value || "").trim())
    .filter(Boolean)
    .slice(0, limit);

export function buildLessonBundleSpec(input: {
  finding: any;
  responseSpec: any;
  liveState?: any;
  curriculumGraph?: any;
  unitId: string;
  lessonId?: string | null;
}): LessonBundleSpec {
  const finding = input.finding || {};
  const baseline = Number(finding.evidence_snapshot?.masteryPct);
  const graph = input.curriculumGraph || {};
  const objective = String(
    input.responseSpec?.objective || graph.objective?.title || finding.objective_key || "Reviewed learning objective",
  );
  return {
    schemaVersion: 2,
    purpose: "evidence_responsive_lesson",
    learningTarget: objective,
    audience: {
      classId: finding.class_id || null,
      pupilsObserved: Number.isFinite(Number(finding.evidence_snapshot?.students))
        ? Number(finding.evidence_snapshot.students)
        : null,
    },
    evidenceBasis: {
      findingId: finding.id,
      evidenceAsOf: finding.evidence_as_of,
      baselineMasteryPct: Number.isFinite(baseline) ? baseline : null,
      evidenceCount: Number.isFinite(Number(input.liveState?.evidence_count))
        ? Number(input.liveState.evidence_count)
        : null,
      uncertaintyPoints: Number.isFinite(Number(input.liveState?.uncertainty_points))
        ? Number(input.liveState.uncertainty_points)
        : null,
    },
    curriculum: {
      unitId: input.unitId,
      lessonId: input.lessonId || null,
      approvedGraphOnly: true,
      graphVersion: graph.provenance?.graphVersion ?? null,
      prerequisites: boundedStrings(graph.prerequisites, 8),
      misconceptions: boundedStrings(graph.misconceptions, 8),
      vocabulary: boundedStrings(graph.vocabulary, 14),
    },
    sequence: [
      { phase: "entry_diagnostic", purpose: "Test the reviewed misconception before reteaching.", required: true },
      { phase: "explicit_instruction", purpose: "Model the target using approved curriculum language.", required: true },
      { phase: "diagnostic_hinge", purpose: "Choose the next branch from live evidence.", required: true },
      { phase: "guided_practice", purpose: "Rehearse with feedback and fading support.", required: true },
      { phase: "independent_check", purpose: "Check transfer without the worked model.", required: true },
      { phase: "exit_check", purpose: "Capture a same-lesson signal without calling it impact.", required: true },
    ],
    adaptiveBranches: [
      { when: "hinge_not_secure", then: "Use a second representation and another worked example." },
      { when: "hinge_secure", then: "Move to a transfer example with reduced scaffolding." },
      { when: "evidence_is_thin", then: "Keep claims tentative and collect another comparable attempt." },
    ],
    outputBundle: ["lesson_deck", "teacher_notes", "student_task", "exit_check", "delayed_recheck"],
    delayedRecheck: { required: true, schoolDays: { min: 5, max: 10 }, parallel: true },
    guardrails: [
      "Use only the frozen reviewed finding and approved curriculum graph as evidence.",
      "Do not describe a pupil or class as fixed-risk.",
      "Do not claim that the lesson caused a later outcome.",
      "Keep teacher review and editing available before delivery.",
    ],
  };
}

export function buildLessonBundlePrompt(spec: LessonBundleSpec): string {
  return [
    "Build the lesson from this structured, versioned teaching contract.",
    `Learning target: ${spec.learningTarget}`,
    `Required phases: ${spec.sequence.map((phase) => phase.phase).join(", ")}.`,
    spec.curriculum.prerequisites.length
      ? `Diagnose prerequisites: ${spec.curriculum.prerequisites.join("; ")}.`
      : "",
    spec.curriculum.misconceptions.length
      ? `Confront reviewed misconceptions: ${spec.curriculum.misconceptions.join("; ")}.`
      : "",
    `Adaptive branches: ${spec.adaptiveBranches.map((branch) => `${branch.when} -> ${branch.then}`).join(" ")}`,
    `Bundle contract: ${spec.outputBundle.join(", ")}. The deck is the first generated artifact; preserve the remaining outputs in its teacher notes and task slides.`,
    ...spec.guardrails,
  ].filter(Boolean).join("\n").slice(0, 8_000);
}

export interface PolicyEvaluation {
  evaluationStatus: "insufficient_data" | "candidate" | "hold" | "retire_review";
  recommendationCount: number;
  acceptedCount: number;
  deliveredCount: number;
  recheckedCount: number;
  outcomeCount: number;
  teacherOverrideCount: number;
  acceptanceRate: number | null;
  deliveryRate: number | null;
  recheckRate: number | null;
  meanTeacherRating: number | null;
  meanDescriptiveDelta: number | null;
  limitations: string[];
}

const rate = (numerator: number, denominator: number) =>
  denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;

const mean = (values: unknown[]) => {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length
    ? Number((valid.reduce((total, value) => total + value, 0) / valid.length).toFixed(2))
    : null;
};

export function evaluateResponsePolicy(input: {
  recommendations?: any[];
  deliveries?: any[];
  rechecks?: any[];
  outcomes?: any[];
  feedback?: any[];
  minimumOutcomeSample?: number;
}): PolicyEvaluation {
  const recommendations = input.recommendations || [];
  const accepted = recommendations.filter((row) => row.status === "accepted");
  const uniqueActionRows = (values: any[]) => [
    ...new Map(values.map((row, index) => [row.action_id || row.id || index, row])).values(),
  ];
  const deliveries = uniqueActionRows(input.deliveries || []);
  const completedRechecks = uniqueActionRows(
    (input.rechecks || []).filter((row) => row.status === "completed"),
  );
  const outcomes = input.outcomes || [];
  const feedback = input.feedback || [];
  const overrides = feedback.filter((row) => ["edited", "rejected"].includes(row.feedback_type));
  const ratings = feedback.filter((row) => row.rating != null).map((row) => row.rating);
  const deltas = outcomes.map((row) => row.delta);
  const minimum = Math.max(5, input.minimumOutcomeSample || 20);
  const acceptanceRate = rate(accepted.length, recommendations.length);
  const deliveryRate = rate(deliveries.length, accepted.length);
  const recheckRate = rate(completedRechecks.length, deliveries.length);
  const meanTeacherRating = mean(ratings);
  const meanDescriptiveDelta = mean(deltas);

  let evaluationStatus: PolicyEvaluation["evaluationStatus"] = "insufficient_data";
  if (outcomes.length >= minimum) {
    if (
      (recheckRate || 0) >= 0.6 &&
      (meanTeacherRating == null || meanTeacherRating >= 3.5) &&
      (meanDescriptiveDelta || 0) > 0
    ) {
      evaluationStatus = "candidate";
    } else if ((meanDescriptiveDelta || 0) < -5 || (meanTeacherRating != null && meanTeacherRating < 2.5)) {
      evaluationStatus = "retire_review";
    } else {
      evaluationStatus = "hold";
    }
  }

  return {
    evaluationStatus,
    recommendationCount: recommendations.length,
    acceptedCount: accepted.length,
    deliveredCount: deliveries.length,
    recheckedCount: completedRechecks.length,
    outcomeCount: outcomes.length,
    teacherOverrideCount: overrides.length,
    acceptanceRate,
    deliveryRate,
    recheckRate,
    meanTeacherRating,
    meanDescriptiveDelta,
    limitations: [
      "Outcomes are descriptive before/after changes, not causal impact estimates.",
      "Teacher acceptance and ratings measure usefulness, not pupil learning.",
      "Candidate status requires human governance review and never promotes a policy automatically.",
    ],
  };
}
