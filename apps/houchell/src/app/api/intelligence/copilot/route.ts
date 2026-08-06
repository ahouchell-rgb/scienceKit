import { artifactFingerprint } from "@/lib/artifactLineage";
import { enforceAiBudget } from "@/lib/aiBudget";
import {
  buildCopilotSystemPrompt,
  copilotSafetyFlags,
  fallbackCopilotAnswer,
  inferCopilotIntent,
  isBlockedCopilotRequest,
  parseCopilotAnswer,
} from "@/lib/intelligence/copilot";
import { buildTodayQueue, operatingContract } from "@/lib/intelligence/operatingSystem";
import {
  authenticateIntelligence,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
} from "@/lib/intelligence/server";
import { canAccessIntelligenceSchool } from "@/lib/intelligence/scopeService";
import { parseCopilotRequest, ValidationError } from "@/lib/intelligence/validation";
import {
  AI_MODELS,
  anthropicText,
  callAnthropic,
  logTokenUsage,
  skAdmin,
} from "@/lib/serverHelpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const rows = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value : [];
const MODEL = AI_MODELS.HAIKU;

export async function POST(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  let input;
  try {
    input = parseCopilotRequest(await request.json());
  } catch (error) {
    return jsonNoStore({ error: error instanceof ValidationError ? error.message : "Invalid JSON" }, 400);
  }
  if (!(await canAccessIntelligenceSchool(auth, input.schoolId))) {
    return jsonNoStore({ error: "School is outside your permitted scope" }, 403);
  }

  try {
    const role = operatingContract(auth.profile);
    const [summary, signals, recommendations, findings, rechecks, decisionMemory, proof] = await Promise.all([
      restAsUser(`intelligence_adaptive_os_summary?school_id=eq.${input.schoolId}&select=*&limit=1`, auth.token),
      restAsUser(`intelligence_signals?school_id=eq.${input.schoolId}&status=eq.active&select=id,signal_type,headline,summary,evidence_as_of,materiality_score,confidence,class_id,objective_key&order=materiality_score.desc&limit=12`, auth.token),
      restAsUser(`intelligence_recommendations?school_id=eq.${input.schoolId}&status=eq.proposed&select=id,headline,rationale,priority,status,finding:intelligence_findings(scope_type)&order=created_at.desc&limit=20`, auth.token),
      restAsUser(`intelligence_findings?school_id=eq.${input.schoolId}&status=in.(open,accepted)&select=id,scope_type,headline,summary,evidence_as_of,evidence_strength,actions:intelligence_actions(id,title,description,priority,status,due_at,requires_human_acceptance)&order=created_at.desc&limit=30`, auth.token),
      restAsUser(`intelligence_rechecks?finding.school_id=eq.${input.schoolId}&status=eq.scheduled&select=id,action_id,objective_key,status,due_at,finding:intelligence_findings!inner(school_id,headline)&order=due_at.asc&limit=20`, auth.token),
      restAsUser(`intelligence_response_policy_scores?school_id=eq.${input.schoolId}&select=finding_type,objective_key,response_type,sample_size,operational_score,confidence,limitations,evaluated_at&order=evaluated_at.desc,operational_score.desc&limit=12`, auth.token),
      restAsUser(`intelligence_proof_snapshots?school_id=eq.${input.schoolId}&select=*&order=created_at.desc&limit=1`, auth.token),
    ]);
    const recommendationRows = rows<any>(recommendations)
      .filter((row) => role.level !== "trust" || row.finding?.scope_type !== "pupil");
    const findingRows = rows<any>(findings)
      .filter((row) => role.level !== "trust" || row.scope_type !== "pupil");
    const queue = buildTodayQueue({
      findings: findingRows,
      recommendations: recommendationRows,
      rechecks: rows(rechecks),
      limit: role.queueLimit,
    });
    const signalRows = rows<any>(signals);
    const proofRow = rows<any>(proof)[0] || null;
    const evidence = {
      summary: rows(summary)[0] || null,
      signals: signalRows,
      queue,
      decisionMemory: rows(decisionMemory),
      proof: proofRow,
      generatedAt: new Date().toISOString(),
    };
    const flags = copilotSafetyFlags(input.message, role.level);
    const blocked = isBlockedCopilotRequest(flags);
    const intent = inferCopilotIntent(input.message);
    const evidenceRefs = [
      ...signalRows.slice(0, 12).map((row) => `signal:${row.id}`),
      ...queue.slice(0, 12).map((row) => row.id),
      ...(proofRow?.id ? [`proof:${proofRow.id}`] : []),
    ];
    const requestFingerprint = artifactFingerprint({
      schoolId: input.schoolId,
      userId: auth.userId,
      message: input.message,
      at: new Date().toISOString().slice(0, 13),
    });
    let answer = fallbackCopilotAnswer(evidence, blocked);
    let status: "completed" | "fallback" | "blocked" | "failed" = blocked ? "blocked" : "fallback";
    let model: string | null = null;

    if (!blocked && process.env.ANTHROPIC_API_KEY) {
      const budget = await enforceAiBudget({ userId: auth.userId, token: auth.token, model: MODEL });
      if (budget.ok) {
        const response = await callAnthropic({
          model: MODEL,
          max_tokens: 1200,
          temperature: 0,
          system: buildCopilotSystemPrompt(role),
          messages: [{
            role: "user",
            content: `Question: ${input.message}\n\nScoped evidence (cite only refs present here):\n${JSON.stringify(evidence)}`,
          }],
        }, { apiKey: process.env.ANTHROPIC_API_KEY, signal: request.signal });
        if (response.ok) {
          const data = await response.json();
          const parsed = parseCopilotAnswer(anthropicText(data));
          if (parsed) {
            const allowedRefs = new Set(evidenceRefs);
            const citations = parsed.citations.filter((citation) => allowedRefs.has(citation.ref));
            if (citations.length !== parsed.citations.length) flags.push("unsupported_citation_removed");
            answer = { ...parsed, citations };
            if (flags.includes("causal_claim_request")) {
              answer.answer = `The scoped evidence can show co-occurrence, not causation. ${answer.answer}`;
            }
            status = "completed";
            model = MODEL;
          } else {
            flags.push("invalid_model_contract");
          }
          await logTokenUsage(auth.userId, data.usage);
        } else {
          flags.push(`provider_${response.status}`);
        }
      } else {
        flags.push("budget_fallback");
      }
    } else if (!blocked) {
      flags.push("provider_not_configured");
    }

    await skAdmin("POST", "intelligence_copilot_runs", {
      school_id: input.schoolId,
      requested_by: auth.userId,
      scope_type: role.level === "teacher" ? "class" : role.level,
      scope_id: input.schoolId,
      request_fingerprint: requestFingerprint,
      intent,
      evidence_refs: evidenceRefs,
      tool_calls: ["read_scoped_operating_system"],
      output_contract: { answer: "string", citations: "array", suggestedActions: "array", readOnly: true },
      status,
      safety_flags: flags,
      model,
    });
    return jsonNoStore({ answer, status, safetyFlags: flags, generatedAt: evidence.generatedAt });
  } catch (error) {
    if (isMissingDatabaseObject(error, [
      "intelligence_adaptive_os_summary",
      "intelligence_signals",
      "intelligence_response_policy_scores",
      "intelligence_proof_snapshots",
      "intelligence_copilot_runs",
    ])) {
      return jsonNoStore({ error: "Apply the Stage 27-32 migration before using the education copilot" }, 503);
    }
    return jsonNoStore({ error: "The education copilot could not load its scoped evidence" }, 500);
  }
}
