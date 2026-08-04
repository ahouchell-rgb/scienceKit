export interface ResponseEvidence {
  headline: string;
  summary?: string | null;
  objectiveLabel?: string | null;
  baselineMastery?: number | null;
  marked?: number | null;
  students?: number | null;
}

export interface ResponseGenerationSpec {
  schemaVersion: 1;
  purpose: "misconception_reteach";
  objective: string | null;
  reviewedFinding: string;
  teacherJudgement: string | null;
  baseline: {
    masteryPct: number | null;
    markedResponses: number | null;
    pupilsObserved: number | null;
  };
  requiredComponents: [
    "misconception_confrontation",
    "diagnostic_hinge",
    "guided_practice",
    "parallel_delayed_recheck",
  ];
  recheckWindowSchoolDays: { min: 5; max: 10 };
  prohibitedClaims: ["fixed_pupil_risk", "causal_impact_without_design"];
  prompt: string;
}

export function buildResponseFocus(evidence: ResponseEvidence): string {
  const baseline =
    evidence.baselineMastery == null
      ? "No valid baseline percentage is available."
      : `The frozen baseline is ${Math.round(evidence.baselineMastery)}% mastery`;
  const exposure = [
    evidence.marked ? `${evidence.marked} marked responses` : null,
    evidence.students ? `${evidence.students} pupils observed` : null,
  ]
    .filter(Boolean)
    .join(" across ");

  return [
    `Respond to the reviewed finding: "${evidence.headline}".`,
    evidence.objectiveLabel ? `Target objective: ${evidence.objectiveLabel}.` : "",
    evidence.summary ? `Teacher judgement: ${evidence.summary}` : "",
    `${baseline}${exposure ? ` from ${exposure}` : ""}.`,
    "Build a misconception-confronting reteach, a diagnostic hinge question with interpretable distractors, and a short parallel recheck suitable 5–10 school days later.",
    "Do not describe pupils as fixed-risk or claim the lesson caused any future change.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildResponseSpec(evidence: ResponseEvidence): ResponseGenerationSpec {
  const baseline =
    evidence.baselineMastery == null || !Number.isFinite(Number(evidence.baselineMastery))
      ? null
      : Math.max(0, Math.min(100, Number(evidence.baselineMastery)));
  return {
    schemaVersion: 1,
    purpose: "misconception_reteach",
    objective: evidence.objectiveLabel?.trim() || null,
    reviewedFinding: evidence.headline.trim(),
    teacherJudgement: evidence.summary?.trim() || null,
    baseline: {
      masteryPct: baseline,
      markedResponses: evidence.marked == null ? null : Math.max(0, Number(evidence.marked)),
      pupilsObserved: evidence.students == null ? null : Math.max(0, Number(evidence.students)),
    },
    requiredComponents: [
      "misconception_confrontation",
      "diagnostic_hinge",
      "guided_practice",
      "parallel_delayed_recheck",
    ],
    recheckWindowSchoolDays: { min: 5, max: 10 },
    prohibitedClaims: ["fixed_pupil_risk", "causal_impact_without_design"],
    prompt: buildResponseFocus(evidence),
  };
}

export interface DescriptiveOutcome {
  baseline: number;
  outcome: number;
  delta: number;
  sampleSize: number | null;
  interpretation: string;
  attributionStrength: "descriptive";
}

function boundedPercent(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

export function descriptiveOutcome(input: {
  baseline: unknown;
  outcome: unknown;
  sampleSize?: unknown;
}): DescriptiveOutcome {
  const baseline = boundedPercent(input.baseline);
  const outcome = boundedPercent(input.outcome);
  if (baseline == null || outcome == null) {
    throw new Error("Baseline and outcome must both be percentages from 0 to 100.");
  }
  const parsedSample = Number(input.sampleSize);
  const sampleSize =
    Number.isInteger(parsedSample) && parsedSample >= 0 ? parsedSample : null;
  const delta = Math.round((outcome - baseline) * 10) / 10;
  const comparison =
    delta === 0
      ? "unchanged from the frozen baseline"
      : `${Math.abs(delta).toFixed(1)} percentage points ${delta > 0 ? "higher" : "lower"} than the frozen baseline`;

  return {
    baseline,
    outcome,
    delta,
    sampleSize,
    attributionStrength: "descriptive",
    interpretation: `The recheck was ${comparison}. This is a descriptive before/after change, not a causal estimate.`,
  };
}
