import {
  authenticateIntelligence,
  authenticateIntelligenceCaller,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
  rpcAsUser,
  UUID_RE,
  type IntelligenceProfile,
} from "@/lib/intelligence/server";
import { skAdmin } from "@/lib/serverHelpers";
import {
  ACTION_STATUSES,
  canTransitionAction,
  normaliseDueAt,
  type IntelligenceActionStatus,
} from "@/lib/intelligenceWork";

export const runtime = "nodejs";

async function resolveClassScope(
  classId: string,
  token: string,
  userId: string,
  profile: IntelligenceProfile,
) {
  try {
    const rows = await restAsUser<any[]>(
      `classes?id=eq.${classId}&select=id,school_id,teacher_id&limit=1`,
      token,
    );
    if (rows?.[0]?.teacher_id === userId) {
      return { classId, schoolId: rows[0].school_id || profile.school_id, trustId: profile.trust_id };
    }
  } catch {
    // Continue through the leadership scope gates.
  }

  if (profile.school_role === "hod" || profile.school_role === "slt") {
    const rows = await rpcAsUser<any[]>("school_classes", token, {}).catch(() => []);
    if (Array.isArray(rows) && rows.some((row: any) => row.class_id === classId)) {
      return { classId, schoolId: profile.school_id, trustId: profile.trust_id };
    }
  }

  if (profile.trust_role === "trust_lead") {
    const rows = await rpcAsUser<any[]>("trust_classes", token, {}).catch(() => []);
    const target = Array.isArray(rows)
      ? rows.find((row: any) => row.class_id === classId)
      : null;
    if (target) {
      return { classId, schoolId: target.school_id, trustId: profile.trust_id };
    }
  }

  return null;
}

export async function GET(request: Request) {
  const auth = await authenticateIntelligenceCaller(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  try {
    const rows = await restAsUser<any[]>(
      "intelligence_findings?select=id,trust_id,school_id,department_id,class_id,pupil_id,objective_id,objective_key,scope_type,finding_type,headline,summary,source_kind,evidence_snapshot,evidence_as_of,evidence_strength,status,raised_by,reviewed_by,reviewed_at,dismissed_reason,created_at,updated_at,actions:intelligence_actions(id,action_type,title,description,purpose,priority,status,owner_id,created_by,proposed_by_kind,requires_human_acceptance,accepted_by,accepted_at,due_at,started_at,completed_at,outcome_summary,created_at,updated_at)&order=created_at.desc",
      auth.token,
    );
    return jsonNoStore({ enabled: true, findings: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    if (isMissingDatabaseObject(error, ["intelligence_findings", "intelligence_actions"])) {
      return jsonNoStore({
        enabled: false,
        reason: "migration_pending",
        findings: [],
      });
    }
    return jsonNoStore({ error: "Couldn't load persistent work" }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, 400);
  }

  const classId = String(body.classId || "");
  const headline = String(body.headline || "").trim().slice(0, 240);
  const summary = String(body.summary || "").trim().slice(0, 3000);
  const requestedObjective = String(body.objectiveId || body.objectiveKey || "").trim().slice(0, 240);
  if (!UUID_RE.test(classId)) return jsonNoStore({ error: "A valid class is required" }, 400);
  if (headline.length < 3) return jsonNoStore({ error: "A finding headline is required" }, 400);
  if (!requestedObjective) return jsonNoStore({ error: "An objective key is required" }, 400);

  const scope = await resolveClassScope(classId, auth.token, auth.userId, auth.profile);
  if (!scope?.schoolId) return jsonNoStore({ error: "Class is outside your permitted scope" }, 403);
  const dueAt = body.dueAt ? normaliseDueAt(body.dueAt) : null;
  if (body.dueAt && !dueAt) return jsonNoStore({ error: "Invalid due date" }, 400);

  const marked = Math.max(0, Number(body.evidence?.marked) || 0);
  const masteryPct = Number(body.evidence?.masteryPct);
  const evidenceStrength = marked >= 100 ? "strong" : marked >= 20 ? "developing" : "limited";
  const evidenceSnapshot = {
    masteryPct: Number.isFinite(masteryPct) ? Math.max(0, Math.min(100, masteryPct)) : null,
    marked,
    students: Math.max(0, Number(body.evidence?.students) || 0),
    sources: Array.isArray(body.evidence?.sources)
      ? body.evidence.sources.filter((source: unknown) => source === "retrieval" || source === "assessment")
      : [],
    contextLabel: String(body.evidence?.contextLabel || "").slice(0, 240),
    capturedBy: "objective_360",
  };

  try {
    const findings = await skAdmin("POST", "intelligence_findings", {
      trust_id: scope.trustId || null,
      school_id: scope.schoolId,
      class_id: classId,
      objective_id: UUID_RE.test(requestedObjective) ? requestedObjective : null,
      objective_key: requestedObjective,
      scope_type: "objective",
      finding_type: "learning_gap",
      headline,
      summary,
      source_kind: "human",
      evidence_snapshot: evidenceSnapshot,
      evidence_as_of: new Date().toISOString(),
      evidence_strength: evidenceStrength,
      status: "open",
      raised_by: auth.userId,
      updated_by: auth.userId,
    });
    const finding = findings?.[0];
    if (!finding) throw new Error("Finding insert returned no row");

    let action = null;
    if (body.createAction !== false) {
      const actions = await skAdmin("POST", "intelligence_actions", {
        finding_id: finding.id,
        action_type: body.actionType === "review_evidence" ? "review_evidence" : "reteach",
        title: String(body.actionTitle || `Respond to: ${headline}`).trim().slice(0, 240),
        description: String(body.actionDescription || "").trim().slice(0, 3000),
        purpose: String(body.purpose || "plan_next_lesson").slice(0, 80),
        priority: ["low", "normal", "high", "urgent"].includes(body.priority)
          ? body.priority
          : "normal",
        status: "proposed",
        owner_id: auth.userId,
        created_by: auth.userId,
        proposed_by_kind: "human",
        requires_human_acceptance: true,
        due_at: dueAt,
        updated_by: auth.userId,
      });
      action = actions?.[0] || null;
    }

    return jsonNoStore({ finding, action }, 201);
  } catch (error: any) {
    if (String(error?.message || "").includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return jsonNoStore({ error: "Persistent work service is not configured" }, 503);
    }
    if (isMissingDatabaseObject(error, ["intelligence_findings", "intelligence_actions"])) {
      return jsonNoStore({ error: "Stage 4 migration has not been applied" }, 503);
    }
    return jsonNoStore({ error: "Couldn't persist the finding" }, 500);
  }
}

export async function PATCH(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, 400);
  }

  const actionId = String(body.actionId || "");
  if (!UUID_RE.test(actionId)) return jsonNoStore({ error: "Invalid action id" }, 400);

  let action: any;
  try {
    action = (
      await restAsUser<any[]>(
        `intelligence_actions?id=eq.${actionId}&select=id,finding_id,status,owner_id,created_by,requires_human_acceptance,finding:intelligence_findings(school_id,trust_id,class_id)&limit=1`,
        auth.token,
      )
    )?.[0];
  } catch {
    return jsonNoStore({ error: "Couldn't resolve this action" }, 500);
  }
  if (!action) return jsonNoStore({ error: "Action not found in your scope" }, 404);

  const finding = action.finding;
  const profile = auth.profile;
  let canManageScope =
    Boolean(
      finding?.school_id &&
        profile?.school_id === finding.school_id &&
        (profile.school_role === "hod" || profile.school_role === "slt"),
    ) ||
    Boolean(
      finding?.trust_id &&
        profile?.trust_id === finding.trust_id &&
        profile.trust_role === "trust_lead",
    );

  if (!canManageScope && finding?.school_id && profile?.trust_role === "trust_lead") {
    try {
      const school = (
        await restAsUser<any[]>(
          `schools?id=eq.${finding.school_id}&select=trust_id&limit=1`,
          auth.token,
        )
      )?.[0];
      canManageScope = Boolean(school?.trust_id && school.trust_id === profile.trust_id);
    } catch {
      // No escalation of scope when the relationship cannot be proven.
    }
  }

  const patch: Record<string, unknown> = { updated_by: auth.userId };
  if (body.status != null) {
    const next = String(body.status) as IntelligenceActionStatus;
    if (!ACTION_STATUSES.includes(next)) return jsonNoStore({ error: "Invalid action status" }, 400);
    const verdict = canTransitionAction({
      current: action.status,
      next,
      actorId: auth.userId,
      ownerId: action.owner_id,
      createdBy: action.created_by,
      canManageScope,
      requiresHumanAcceptance: action.requires_human_acceptance,
      outcomeSummary: body.outcomeSummary,
    });
    if (!verdict.allowed) return jsonNoStore({ error: verdict.reason }, 409);
    patch.status = next;
    if (next === "accepted") {
      patch.accepted_by = auth.userId;
      patch.accepted_at = new Date().toISOString();
    }
    if (next === "in_progress") patch.started_at = new Date().toISOString();
    if (next === "completed") {
      patch.completed_at = new Date().toISOString();
      patch.outcome_summary = String(body.outcomeSummary || "").trim().slice(0, 3000);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "dueAt")) {
    if (
      auth.userId !== action.owner_id &&
      auth.userId !== action.created_by &&
      !canManageScope
    ) {
      return jsonNoStore({ error: "You cannot change this due date" }, 403);
    }
    const dueAt = body.dueAt ? normaliseDueAt(body.dueAt) : null;
    if (body.dueAt && !dueAt) return jsonNoStore({ error: "Invalid due date" }, 400);
    patch.due_at = dueAt;
  }

  if (body.ownerId != null && body.ownerId !== action.owner_id) {
    if (auth.userId !== action.created_by && !canManageScope) {
      return jsonNoStore({ error: "Only the creator or a scoped leader can reassign this action" }, 403);
    }
    const ownerId = String(body.ownerId);
    if (!UUID_RE.test(ownerId)) return jsonNoStore({ error: "Invalid owner" }, 400);
    try {
      const owner = (
        await skAdmin(
          "GET",
          `profiles?id=eq.${ownerId}&school_id=eq.${finding.school_id}&select=id&limit=1`,
        )
      )?.[0];
      if (!owner) return jsonNoStore({ error: "Owner is outside the finding's school" }, 400);
    } catch {
      return jsonNoStore({ error: "Couldn't verify the new owner" }, 500);
    }
    patch.owner_id = ownerId;
  }

  if (Object.keys(patch).length === 1 && !String(body.note || "").trim()) {
    return jsonNoStore({ error: "No supported change supplied" }, 400);
  }

  try {
    let updated = action;
    if (Object.keys(patch).length > 1) {
      updated = (await skAdmin("PATCH", `intelligence_actions?id=eq.${actionId}`, patch))?.[0];
    }
    const note = String(body.note || "").trim().slice(0, 3000);
    if (note) {
      await skAdmin("POST", "intelligence_work_events", {
        finding_id: action.finding_id,
        action_id: actionId,
        actor_id: auth.userId,
        event_type: "action.note_added",
        note,
        detail: {},
      });
    }
    return jsonNoStore({ action: updated });
  } catch {
    return jsonNoStore({ error: "Couldn't update the action" }, 500);
  }
}
