import { bindingConstraintHypotheses } from "@/lib/crossDomain";
import {
  authenticateIntelligence,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
  rpcAsUser,
  UUID_RE,
} from "@/lib/intelligence/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  try {
    const [classState, coverage] = await Promise.all([
      restAsUser(
        "class_learning_state?select=school_id,class_id,class_name,year_group,objective_id,objective_key,objective_title,mastery_estimate,uncertainty_points,evidence_count,pupil_count,last_evidence_at,source_mix,model_version&order=mastery_estimate.asc,evidence_count.desc&limit=250",
        auth.token,
      ),
      restAsUser(
        "school_intelligence_coverage?select=*&order=school_name.asc&limit=100",
        auth.token,
      ),
    ]);
    let crossDomain: any[] = [];
    try {
      const rows = await restAsUser(
        "class_cross_domain_state?select=*&order=learning_mastery.asc.nullslast&limit=100",
        auth.token,
      );
      crossDomain = (Array.isArray(rows) ? rows : []).map((row: any) => ({
        ...row,
        hypotheses: bindingConstraintHypotheses(row),
      }));
    } catch {
      // Stage 12 is optional to the Stage 9 live evidence surface.
    }
    return jsonNoStore({
      enabled: true,
      profile: auth.profile,
      classState: Array.isArray(classState) ? classState : [],
      coverage: Array.isArray(coverage) ? coverage : [],
      crossDomain,
      guardrails: {
        universalRiskScore: false,
        causalClaims: false,
        model: "beta_smoothed_retrieval_v1",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (
      isMissingDatabaseObject(error, [
        "class_learning_state",
        "school_intelligence_coverage",
      ])
    ) {
      return jsonNoStore({
        enabled: false,
        reason: "migration_pending",
        classState: [],
        coverage: [],
      });
    }
    return jsonNoStore({ error: "Couldn't load live intelligence" }, 500);
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
  if (body.operation !== "backfill_retrieval") {
    return jsonNoStore({ error: "Unsupported intelligence operation" }, 400);
  }
  const schoolId = String(body.schoolId || "");
  if (!UUID_RE.test(schoolId)) {
    return jsonNoStore({ error: "A valid school is required" }, 400);
  }

  try {
    const result = await rpcAsUser(
      "backfill_retrieval_education_events",
      auth.token,
      { p_school_id: schoolId },
    );
    return jsonNoStore({ result }, 201);
  } catch (error) {
    if (
      isMissingDatabaseObject(error, [
        "backfill_retrieval_education_events",
      ])
    ) {
      return jsonNoStore(
        { error: "Stage 9 event ledger migration has not been applied" },
        503,
      );
    }
    if (
      error instanceof Error &&
      /401:|403:|permission denied|management scope/i.test(error.message)
    ) {
      return jsonNoStore(
        { error: "School intelligence management scope required" },
        403,
      );
    }
    return jsonNoStore({ error: "Couldn't backfill retrieval events" }, 500);
  }
}
