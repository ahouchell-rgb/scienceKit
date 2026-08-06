export interface CopilotCitation {
  ref: string;
  label: string;
}

export interface CopilotAction {
  label: string;
  href: string;
  kind: "review" | "teach" | "monitor";
}

export interface CopilotAnswer {
  answer: string;
  citations: CopilotCitation[];
  suggestedActions: CopilotAction[];
}

const BLOCKED_PATTERNS = [
  /ignore (all |the )?(previous|system) instructions/i,
  /reveal (private|hidden|confidential|personal) (data|records|information|prompt)/i,
  /(assign|give|calculate|create).{0,25}(pupil|student).{0,20}(risk score|risk label)/i,
  /(accept|approve|deliver|send).{0,30}(automatically|without (a )?human|on my behalf)/i,
];

export function copilotSafetyFlags(message: string, roleLevel: string) {
  const flags: string[] = [];
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(message))) flags.push("blocked_instruction");
  if (/caus(e|ed|al|ation)|because of attendance/i.test(message)) flags.push("causal_claim_request");
  if (roleLevel === "trust" && /(named pupil|individual pupil|student names?|pupil names?)/i.test(message)) {
    flags.push("trust_pupil_drilldown");
  }
  return flags;
}

export function isBlockedCopilotRequest(flags: string[]) {
  return flags.includes("blocked_instruction") || flags.includes("trust_pupil_drilldown");
}

export function inferCopilotIntent(message: string) {
  if (/lesson|reteach|powerpoint|slides|teach next/i.test(message)) return "plan_teaching_response";
  if (/attendance|behaviour|trend|pattern/i.test(message)) return "review_cross_domain_evidence";
  if (/impact|proof|worked|outcome|rating/i.test(message)) return "review_operational_proof";
  if (/data|fresh|quality|missing/i.test(message)) return "review_data_quality";
  return "prioritise_daily_work";
}

export function parseCopilotAnswer(text: string): CopilotAnswer | null {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed.answer !== "string" || !Array.isArray(parsed.citations)) return null;
    const citations = parsed.citations.slice(0, 8).flatMap((value: any) =>
      typeof value?.ref === "string" && typeof value?.label === "string"
        ? [{ ref: value.ref.slice(0, 160), label: value.label.slice(0, 160) }]
        : [],
    );
    const suggestedActions = (Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [])
      .slice(0, 4)
      .flatMap((value: any) => {
        if (
          typeof value?.label !== "string" || typeof value?.href !== "string" ||
          !value.href.startsWith("/") || !["review", "teach", "monitor"].includes(value?.kind)
        ) return [];
        return [{
          label: value.label.slice(0, 120),
          href: value.href.slice(0, 240),
          kind: value.kind as CopilotAction["kind"],
        }];
      });
    return { answer: parsed.answer.trim().slice(0, 6000), citations, suggestedActions };
  } catch {
    return null;
  }
}

export function fallbackCopilotAnswer(evidence: {
  signals: any[];
  queue: any[];
  proof?: any | null;
}, blocked = false): CopilotAnswer {
  if (blocked) {
    return {
      answer: "I can help interpret evidence and prepare a human-reviewed response, but I cannot reveal restricted records, create pupil risk labels, override safeguards or take consequential actions for you.",
      citations: [],
      suggestedActions: [{ label: "Open today’s reviewed queue", href: "/intel/operating-system", kind: "review" }],
    };
  }
  const topSignal = evidence.signals[0];
  const topQueue = evidence.queue[0];
  if (topSignal) {
    return {
      answer: `${topSignal.headline}. ${topSignal.summary} Start by checking the underlying evidence and classroom context; any response still needs a named member of staff to accept it.`,
      citations: [{ ref: `signal:${topSignal.id}`, label: "Highest-materiality active signal" }],
      suggestedActions: topQueue?.href
        ? [{ label: "Open the next reviewed response", href: topQueue.href, kind: "teach" }]
        : [{ label: "Review today’s recommendations", href: "/intel/operating-system", kind: "review" }],
    };
  }
  return {
    answer: "There is not enough current scoped evidence to make a specific recommendation. Refresh source health, then review any new signals before planning a response.",
    citations: [],
    suggestedActions: [{ label: "Review source health", href: "/intel/operating-system", kind: "monitor" }],
  };
}

export function buildCopilotSystemPrompt(role: { level: string; job: string }) {
  return `You are the read-only School Intelligence copilot for a ${role.level}-level user.
Their job is: ${role.job}

Non-negotiable contract:
- Use only the supplied, role-scoped evidence. Never invent a fact or citation.
- Never expose pupil-level data to a trust-level user.
- Never create a fixed pupil risk score or label.
- Treat forecasts as uncertain and cross-domain patterns as hypotheses, never causal proof.
- Do not accept, reject, deliver, message, write or take any consequential action.
- Recommendations always require a named human decision.
- If evidence is missing or stale, say so plainly.

Return JSON only with this exact shape:
{"answer":"concise answer","citations":[{"ref":"supplied ref","label":"description"}],"suggestedActions":[{"label":"action","href":"internal path","kind":"review|teach|monitor"}]}`;
}
