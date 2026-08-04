import {
  authenticateIntelligence,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
  UUID_RE,
  type IntelligenceAuth,
} from "@/lib/intelligence/server";
import { skAdmin } from "@/lib/serverHelpers";
import { buildResponseSpec, descriptiveOutcome } from "@/lib/responseLoop";
import {
  artifactBytes,
  artifactChanged,
  artifactFingerprint,
} from "@/lib/artifactLineage";
import { buildCurriculumGraphPrompt } from "@/lib/curriculumGraph";
import { loadApprovedCurriculumContext } from "@/lib/curriculumGraphServer";

export const runtime = "nodejs";
export const maxDuration = 300;

async function loadAction(actionId: string, token: string) {
  return (
    await restAsUser<any[]>(
      `intelligence_actions?id=eq.${actionId}&select=id,action_type,title,description,purpose,priority,status,owner_id,created_by,accepted_by,due_at,started_at,completed_at,outcome_summary,finding:intelligence_findings(id,trust_id,school_id,class_id,objective_id,objective_key,headline,summary,evidence_snapshot,evidence_as_of,evidence_strength)&limit=1`,
      token,
    )
  )?.[0];
}

async function canControl(action: any, auth: IntelligenceAuth) {
  if (action.owner_id === auth.userId || action.created_by === auth.userId) return true;
  const profile = auth.profile;
  const finding = action.finding;
  if (
    finding?.school_id &&
    profile?.school_id === finding.school_id &&
    (profile.school_role === "hod" || profile.school_role === "slt")
  ) {
    return true;
  }
  if (profile?.trust_role === "trust_lead") {
    if (finding?.trust_id && profile.trust_id === finding.trust_id) return true;
    if (finding?.school_id) {
      const school = (
        await restAsUser<any[]>(
          `schools?id=eq.${finding.school_id}&select=trust_id&limit=1`,
          auth.token,
        )
      )?.[0];
      if (school?.trust_id && school.trust_id === profile.trust_id) return true;
    }
  }
  return false;
}

export async function GET(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);
  const actionId = new URL(request.url).searchParams.get("actionId") || "";
  if (!UUID_RE.test(actionId)) return jsonNoStore({ error: "Invalid action id" }, 400);

  try {
    const action = await loadAction(actionId, auth.token);
    if (!action) return jsonNoStore({ error: "Action not found in your scope" }, 404);
    const [contexts, artifacts, deliveries, rechecks, outcomes, feedback] = await Promise.all([
      restAsUser(
        `intelligence_context_snapshots?action_id=eq.${actionId}&select=*&order=captured_at.desc`,
        auth.token,
      ),
      restAsUser(
        `intelligence_artifacts?action_id=eq.${actionId}&select=*&order=created_at.desc`,
        auth.token,
      ),
      restAsUser(
        `intelligence_deliveries?action_id=eq.${actionId}&select=*&order=delivered_at.desc`,
        auth.token,
      ),
      restAsUser(
        `intelligence_rechecks?action_id=eq.${actionId}&select=*&order=created_at.desc`,
        auth.token,
      ),
      restAsUser(
        `intelligence_outcomes?action_id=eq.${actionId}&select=*&order=evaluated_at.desc`,
        auth.token,
      ),
      restAsUser(
        `intelligence_feedback?action_id=eq.${actionId}&select=*&order=created_at.desc`,
        auth.token,
      ),
    ]);
    return jsonNoStore({
      enabled: true,
      action,
      contexts,
      artifacts,
      deliveries,
      rechecks,
      outcomes,
      feedback,
    });
  } catch (error) {
    if (
      isMissingDatabaseObject(error, [
        "intelligence_context_snapshots",
        "intelligence_artifacts",
        "intelligence_deliveries",
        "intelligence_rechecks",
        "intelligence_outcomes",
        "intelligence_feedback",
      ])
    ) {
      return jsonNoStore({ enabled: false, reason: "migration_pending" });
    }
    return jsonNoStore({ error: "Couldn't load the response loop" }, 500);
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
  const actionId = String(body.actionId || "");
  if (!UUID_RE.test(actionId)) return jsonNoStore({ error: "Invalid action id" }, 400);

  let action: any;
  try {
    action = await loadAction(actionId, auth.token);
  } catch {
    return jsonNoStore({ error: "Couldn't load the action" }, 500);
  }
  if (!action) return jsonNoStore({ error: "Action not found in your scope" }, 404);
  if (!(await canControl(action, auth))) {
    return jsonNoStore({ error: "You cannot operate this response loop" }, 403);
  }

  const operation = String(body.operation || "");
  if (operation === "generate") {
    if (action.status !== "accepted" && action.status !== "in_progress") {
      return jsonNoStore({ error: "Accept the action before generating a response" }, 409);
    }
    const unitId = String(body.unitId || "").trim().slice(0, 160);
    const lessonId = String(body.lessonId || "").trim().slice(0, 160) || null;
    if (!unitId) return jsonNoStore({ error: "Choose a curriculum unit" }, 400);
    const baseline = Number(action.finding?.evidence_snapshot?.masteryPct);
    const responseSpec = buildResponseSpec({
      headline: action.finding.headline,
      summary: action.finding.summary,
      objectiveLabel: String(body.objectiveLabel || action.finding.objective_key || ""),
      baselineMastery: Number.isFinite(baseline) ? baseline : null,
      marked: Number(action.finding?.evidence_snapshot?.marked) || null,
      students: Number(action.finding?.evidence_snapshot?.students) || null,
    });
    let liveState: any = null;
    try {
      const objectiveKey = encodeURIComponent(String(action.finding.objective_key || ""));
      liveState = (
        await restAsUser<any[]>(
          `class_learning_state?class_id=eq.${action.finding.class_id}&objective_key=eq.${objectiveKey}&select=mastery_estimate,uncertainty_points,evidence_count,pupil_count,last_evidence_at,source_mix,model_version&limit=1`,
          auth.token,
        )
      )?.[0] || null;
    } catch {
      // Stage 9 may not be active yet; the reviewed finding remains the baseline.
    }

    let curriculumGraph: any = null;
    let curriculumGraphPrompt = "";
    if (UUID_RE.test(String(action.finding.objective_id || ""))) {
      try {
        curriculumGraph = await loadApprovedCurriculumContext({
          token: auth.token,
          objectiveId: action.finding.objective_id,
          schoolId: action.finding.school_id || null,
        });
        curriculumGraphPrompt = buildCurriculumGraphPrompt(curriculumGraph);
      } catch {
        // Stage 13 can be rolled out independently. Generation remains available,
        // but no unreviewed or partially loaded graph content is used.
        curriculumGraph = null;
        curriculumGraphPrompt = "";
      }
    }
    const generationPrompt = [responseSpec.prompt, curriculumGraphPrompt]
      .filter(Boolean)
      .join("\n\n");

    let contextSnapshot: any;
    try {
      contextSnapshot = (
        await skAdmin("POST", "intelligence_context_snapshots", {
          action_id: actionId,
          finding_id: action.finding.id,
          school_id: action.finding.school_id,
          class_id: action.finding.class_id,
          objective_id: action.finding.objective_id,
          objective_key: action.finding.objective_key,
          evidence_as_of: action.finding.evidence_as_of,
          curriculum_context: {
            unitId,
            lessonId,
            reviewedGraph: curriculumGraph,
          },
          evidence_context: {
            reviewedFinding: action.finding.evidence_snapshot,
            liveAggregateAtGeneration: liveState,
          },
          generation_spec: {
            ...responseSpec,
            curriculumGraph: curriculumGraph
              ? {
                  schemaVersion: curriculumGraph.schemaVersion,
                  approvedOnly: true,
                  graphVersion: curriculumGraph.provenance?.graphVersion,
                }
              : null,
          },
          source_model_versions: {
            learnerState: liveState?.model_version || null,
            responseSpec: responseSpec.schemaVersion,
            curriculumGraph:
              curriculumGraph?.provenance?.graphVersion || null,
          },
          created_by: auth.userId,
        })
      )?.[0];
    } catch {
      return jsonNoStore({ error: "Couldn't freeze the generation context; no deck was generated" }, 500);
    }

    const origin = new URL(request.url).origin;
    const generated = await fetch(`${origin}/api/lesson-generator`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        unitId,
        lessonId,
        focus: generationPrompt,
        lessonType: "misconception",
      }),
    });
    const generatedBody = await generated.json();
    if (!generated.ok) {
      return jsonNoStore({ error: generatedBody.error || "Lesson generation failed" }, generated.status);
    }

    let deck: any = {};
    try {
      deck = (
        await restAsUser<any[]>(
          `decks?id=eq.${generatedBody.deckId}&select=id,title,updated_at,slides&limit=1`,
          auth.token,
        )
      )?.[0] || {};
      const artifacts = await skAdmin("POST", "intelligence_artifacts", {
        action_id: actionId,
        finding_id: action.finding.id,
        deck_id: generatedBody.deckId,
        artifact_type: "lesson_deck",
        artifact_version: 1,
        status: "draft",
        generated_by_kind: "lesson_generator",
        context_snapshot_id: contextSnapshot.id,
        generation_context: {
          unitId,
          lessonId,
          contextSnapshotId: contextSnapshot.id,
          responseSpec,
          curriculumGraph: curriculumGraph
            ? {
                objectiveId: curriculumGraph.objective?.id || null,
                graphVersion: curriculumGraph.provenance?.graphVersion,
                approvedOnly: true,
              }
            : null,
          evidenceAsOf: action.finding.evidence_as_of,
        },
        deck_snapshot: {
          deckId: deck.id,
          title: deck.title || generatedBody.title,
          slideCount: Array.isArray(deck.slides)
            ? deck.slides.length
            : generatedBody.slideCount,
          updatedAt: deck.updated_at || null,
          contentFingerprint: artifactFingerprint(deck.slides || []),
        },
        content_fingerprint: artifactFingerprint(deck.slides || []),
        content_bytes: artifactBytes(deck.slides || []),
        created_by: auth.userId,
        updated_by: auth.userId,
      });
      return jsonNoStore({ contextSnapshot, artifact: artifacts?.[0], deck: generatedBody }, 201);
    } catch (error: any) {
      return jsonNoStore(
        {
          error: "The deck was generated but its intelligence lineage could not be saved",
          deckId: generatedBody.deckId,
        },
        500,
      );
    }
  }

  if (operation === "deliver") {
    if (action.status !== "accepted" && action.status !== "in_progress") {
      return jsonNoStore({ error: "The action must be accepted before delivery" }, 409);
    }
    const artifactId = String(body.artifactId || "");
    if (!UUID_RE.test(artifactId)) return jsonNoStore({ error: "Invalid artifact id" }, 400);
    const deliveredAt = body.deliveredAt
      ? new Date(body.deliveredAt)
      : new Date();
    if (!Number.isFinite(deliveredAt.getTime())) {
      return jsonNoStore({ error: "Invalid delivery time" }, 400);
    }
    const recheckDue = body.recheckDueAt
      ? new Date(body.recheckDueAt)
      : new Date(deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(recheckDue.getTime()) || recheckDue <= deliveredAt) {
      return jsonNoStore({ error: "The recheck must be scheduled after delivery" }, 400);
    }
    const baseline = Number(action.finding?.evidence_snapshot?.masteryPct);
    if (!Number.isFinite(baseline) || baseline < 0 || baseline > 100) {
      return jsonNoStore({ error: "A valid frozen baseline is required before delivery" }, 409);
    }

    let artifact: any;
    try {
      artifact = (
        await restAsUser<any[]>(
          `intelligence_artifacts?id=eq.${artifactId}&action_id=eq.${actionId}&select=*&limit=1`,
          auth.token,
        )
      )?.[0];
    } catch {
      return jsonNoStore({ error: "Couldn't load the response artifact" }, 500);
    }
    if (!artifact) return jsonNoStore({ error: "Artifact not found on this action" }, 404);

    let currentDeck: any = artifact.deck_snapshot || {};
    let deliveredFingerprint = artifact.content_fingerprint || null;
    if (artifact.deck_id) {
      try {
        const deck = (
          await restAsUser<any[]>(
            `decks?id=eq.${artifact.deck_id}&select=id,title,updated_at,slides&limit=1`,
            auth.token,
          )
        )?.[0];
        if (deck) {
          deliveredFingerprint = artifactFingerprint(deck.slides || []);
          currentDeck = {
            deckId: deck.id,
            title: deck.title,
            slideCount: Array.isArray(deck.slides) ? deck.slides.length : null,
            updatedAt: deck.updated_at,
            contentFingerprint: deliveredFingerprint,
            changedSinceGeneration: artifactChanged(
              artifact.content_fingerprint,
              deliveredFingerprint,
            ),
          };
        }
      } catch {
        // Preserve the artifact's creation snapshot when the deck is unavailable.
      }
    }

    try {
      const idempotencyKey = artifactFingerprint({
        actionId,
        artifactId,
        deliveredAt: deliveredAt.toISOString(),
        recheckDueAt: recheckDue.toISOString(),
      });
      const transition = await skAdmin(
        "POST",
        "rpc/record_intelligence_delivery",
        {
          p_action_id: actionId,
          p_artifact_id: artifactId,
          p_class_id: action.finding.class_id,
          p_delivered_by: auth.userId,
          p_delivered_at: deliveredAt.toISOString(),
          p_delivery_mode: "class_lesson",
          p_artifact_snapshot: currentDeck,
          p_delivered_fingerprint: deliveredFingerprint,
          p_notes: String(body.notes || "").trim().slice(0, 3000) || null,
          p_idempotency_key: idempotencyKey,
          p_finding_id: action.finding.id,
          p_objective_id: action.finding.objective_id,
          p_objective_key: action.finding.objective_key,
          p_recheck_method: "retrieval",
          p_recheck_due_at: recheckDue.toISOString(),
          p_baseline_snapshot: {
            masteryPct: baseline,
            marked: Number(action.finding.evidence_snapshot?.marked) || 0,
            students: Number(action.finding.evidence_snapshot?.students) || 0,
            evidenceAsOf: action.finding.evidence_as_of,
          },
        },
      );
      return jsonNoStore(transition, transition?.reused ? 200 : 201);
    } catch (error) {
      if (
        isMissingDatabaseObject(error, ["record_intelligence_delivery"])
      ) {
        return jsonNoStore(
          { error: "Apply the Stage 11 atomic response-loop migration before delivery" },
          503,
        );
      }
      return jsonNoStore({ error: "Couldn't record delivery and recheck" }, 500);
    }
  }

  if (operation === "complete_recheck") {
    if (!["in_progress", "completed"].includes(action.status)) {
      return jsonNoStore({ error: "The action must be in progress to record an outcome" }, 409);
    }
    const recheckId = String(body.recheckId || "");
    if (!UUID_RE.test(recheckId)) return jsonNoStore({ error: "Invalid recheck id" }, 400);
    let recheck: any;
    try {
      recheck = (
        await restAsUser<any[]>(
          `intelligence_rechecks?id=eq.${recheckId}&action_id=eq.${actionId}&select=*,delivery:intelligence_deliveries(delivered_at)&limit=1`,
          auth.token,
        )
      )?.[0];
    } catch {
      return jsonNoStore({ error: "Couldn't load the recheck" }, 500);
    }
    if (!recheck) return jsonNoStore({ error: "Recheck not found on this action" }, 404);
    if (recheck.status === "invalid") return jsonNoStore({ error: "This recheck was invalidated" }, 409);

    let outcome;
    try {
      outcome = descriptiveOutcome({
        baseline: recheck.baseline_snapshot?.masteryPct,
        outcome: body.outcomeMastery,
        sampleSize: body.sampleSize,
      });
    } catch (error: any) {
      return jsonNoStore({ error: error.message }, 400);
    }
    const completedAt = new Date();
    const deliveredAt = Date.parse(recheck.delivery?.delivered_at || "");
    const outcomeWindowDays = Number.isFinite(deliveredAt)
      ? Math.max(0, Math.floor((completedAt.getTime() - deliveredAt) / 86400000))
      : 0;

    try {
      const transition = await skAdmin(
        "POST",
        "rpc/complete_intelligence_recheck",
        {
          p_action_id: actionId,
          p_recheck_id: recheckId,
          p_completed_at: completedAt.toISOString(),
          p_result_snapshot: {
            masteryPct: outcome.outcome,
            sampleSize: outcome.sampleSize,
            enteredBy: auth.userId,
          },
          p_metric: "mastery_pct",
          p_baseline_value: outcome.baseline,
          p_outcome_value: outcome.outcome,
          p_sample_size: outcome.sampleSize,
          p_outcome_window_days: outcomeWindowDays,
          p_attribution_strength: "descriptive",
          p_interpretation: outcome.interpretation,
          p_evaluated_by: auth.userId,
        },
      );
      return jsonNoStore(transition);
    } catch (error) {
      if (
        isMissingDatabaseObject(error, ["complete_intelligence_recheck"])
      ) {
        return jsonNoStore(
          { error: "Apply the Stage 11 atomic response-loop migration before recording outcomes" },
          503,
        );
      }
      return jsonNoStore({ error: "Couldn't complete the recheck outcome" }, 500);
    }
  }

  if (operation === "feedback") {
    const artifactId = String(body.artifactId || "");
    if (!UUID_RE.test(artifactId)) return jsonNoStore({ error: "Invalid artifact id" }, 400);
    const feedbackType = String(body.feedbackType || "");
    if (!["accepted", "edited", "rejected", "rating", "comment"].includes(feedbackType)) {
      return jsonNoStore({ error: "Invalid feedback type" }, 400);
    }
    const rating = body.rating == null || body.rating === "" ? null : Number(body.rating);
    if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return jsonNoStore({ error: "Rating must be from 1 to 5" }, 400);
    }
    const reason = String(body.reason || "").trim().slice(0, 2000);
    if (["rejected", "comment"].includes(feedbackType) && reason.length < 3) {
      return jsonNoStore({ error: "Add a short reason for this feedback" }, 400);
    }
    const timeSaved =
      body.timeSavedMinutes == null || body.timeSavedMinutes === ""
        ? null
        : Math.max(0, Math.min(600, Math.round(Number(body.timeSavedMinutes))));
    const artifact = (
      await restAsUser<any[]>(
        `intelligence_artifacts?id=eq.${artifactId}&action_id=eq.${actionId}&select=id,content_fingerprint&limit=1`,
        auth.token,
      )
    )?.[0];
    if (!artifact) return jsonNoStore({ error: "Artifact not found on this action" }, 404);

    try {
      const rows = await skAdmin("POST", "intelligence_feedback", {
        action_id: actionId,
        finding_id: action.finding.id,
        artifact_id: artifactId,
        feedback_type: feedbackType,
        rating,
        reason: reason || null,
        time_saved_minutes: Number.isFinite(timeSaved) ? timeSaved : null,
        metadata: {
          generatedFingerprint: artifact.content_fingerprint,
          source: "response_loop",
        },
        created_by: auth.userId,
      });
      if (feedbackType === "accepted") {
        await skAdmin("PATCH", `intelligence_artifacts?id=eq.${artifactId}`, {
          status: "approved",
          updated_by: auth.userId,
        });
      } else if (feedbackType === "edited" || feedbackType === "rating") {
        await skAdmin("PATCH", `intelligence_artifacts?id=eq.${artifactId}`, {
          status: "reviewed",
          updated_by: auth.userId,
        });
      }
      return jsonNoStore({ feedback: rows?.[0] }, 201);
    } catch {
      return jsonNoStore({ error: "Couldn't record artifact feedback" }, 500);
    }
  }

  return jsonNoStore({ error: "Unknown response operation" }, 400);
}
