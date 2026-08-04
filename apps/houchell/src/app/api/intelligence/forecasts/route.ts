import { forecastDistribution } from "@/lib/forecasting";
import {
  latestCompletedRun,
  objectiveAggregate,
  runShadowForecast,
  scoreForecastOutcomes,
} from "@/lib/intelligence/forecastService";
import {
  authenticateIntelligence,
  canManageSchool,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
  UUID_RE,
  type IntelligenceAuth,
} from "@/lib/intelligence/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const migrationPending = (error: unknown) =>
  isMissingDatabaseObject(
    error,
    [
      "intelligence_model_versions",
      "intelligence_forecast_runs",
      "intelligence_feature_snapshots",
      "intelligence_forecasts",
      "intelligence_forecast_outcomes",
      "intelligence_model_evaluations",
    ],
  );

function schoolFromRequest(auth: IntelligenceAuth, request: Request) {
  const requested = new URL(request.url).searchParams.get("schoolId");
  return requested || auth.profile.school_id || "";
}

export async function GET(request: Request) {
  let auth: IntelligenceAuth | null;
  try {
    auth = await authenticateIntelligence(request);
  } catch {
    return jsonNoStore({ error: "Couldn't resolve your forecasting scope" }, 500);
  }
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);
  const schoolId = schoolFromRequest(auth, request);
  if (!UUID_RE.test(schoolId) || !(await canManageSchool(auth, schoolId))) {
    return jsonNoStore({ error: "School intelligence leadership scope required" }, 403);
  }

  try {
    const [schools, models, runs, evaluations] = await Promise.all([
      restAsUser<any[]>(
        "schools?select=id,name,trust_id&order=name.asc&limit=100",
        auth.token,
      ),
      restAsUser<any[]>(
        "intelligence_model_versions?select=*&order=model_key.asc,version.desc&limit=100",
        auth.token,
      ),
      restAsUser<any[]>(
        `intelligence_forecast_runs?school_id=eq.${schoolId}&select=*&order=as_of.desc&limit=30`,
        auth.token,
      ),
      restAsUser<any[]>(
        `intelligence_model_evaluations?school_id=eq.${schoolId}&select=*&order=evaluated_at.desc&limit=50`,
        auth.token,
      ),
    ]);
    const latestAttempt = runs[0] || null;
    const latestRun = latestCompletedRun(runs);
    let forecasts: any[] = [];
    let outcomes: any[] = [];
    if (latestRun) {
      [forecasts, outcomes] = await Promise.all([
        restAsUser<any[]>(
          `intelligence_forecasts?run_id=eq.${latestRun.id}&select=id,objective_id,objective_key,prediction,lower_bound,upper_bound,baseline_prediction,confidence_band,evidence_count,release_status,as_of,expires_at,objective:objectives(id,code,title)&limit=5000`,
          auth.token,
        ),
        restAsUser<any[]>(
          `intelligence_forecast_outcomes?run_id=eq.${latestRun.id}&select=forecast_id,actual_value,brier_score,baseline_brier_score,observed_at&limit=5000`,
          auth.token,
        ),
      ]);
    }
    const objectives = [
      ...new Map(
        forecasts
          .map((row) => row.objective)
          .filter(Boolean)
          .map((objective) => [objective.id, objective]),
      ).values(),
    ];
    return jsonNoStore({
      enabled: true,
      profile: auth.profile,
      schools,
      selectedSchoolId: schoolId,
      models,
      runs,
      evaluations,
      latestRun,
      latestAttempt,
      latestEvaluation:
        evaluations.find((row) => row.run_id === latestRun?.id) || null,
      distribution: forecastDistribution(forecasts),
      objectiveAggregates: objectiveAggregate(forecasts, objectives),
      outcomeCount: outcomes.length,
      guardrails: {
        mode: "shadow_only",
        pupilRowsReturned: false,
        automatedDecisions: false,
        universalRiskScore: false,
        protectedCharacteristicsUsed: false,
        autoPromotion: false,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (migrationPending(error)) {
      return jsonNoStore({
        enabled: false,
        reason: "stage14_migration_pending",
        runs: [],
        evaluations: [],
      });
    }
    return jsonNoStore({ error: "Couldn't load the shadow forecast lab" }, 500);
  }
}

export async function POST(request: Request) {
  let auth: IntelligenceAuth | null;
  try {
    auth = await authenticateIntelligence(request);
  } catch {
    return jsonNoStore({ error: "Couldn't resolve your forecasting scope" }, 500);
  }
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, 400);
  }
  const schoolId = String(body.schoolId || auth.profile.school_id || "");
  if (!UUID_RE.test(schoolId) || !(await canManageSchool(auth, schoolId))) {
    return jsonNoStore({ error: "School intelligence leadership scope required" }, 403);
  }

  try {
    if (body.operation === "run_shadow") {
      const requestedMax = Math.round(Number(body.maxItems) || 2000);
      const maxItems = Math.max(1, Math.min(2000, requestedMax));
      const result = await runShadowForecast(auth, schoolId, maxItems);
      return jsonNoStore(result, result.reused ? 200 : 201);
    }
    if (body.operation === "score_outcomes") {
      return jsonNoStore(await scoreForecastOutcomes(auth, schoolId), 201);
    }
    return jsonNoStore({ error: "Unsupported forecasting operation" }, 400);
  } catch (error: any) {
    if (migrationPending(error)) {
      return jsonNoStore(
        { error: "Apply the Stage 14 migration before running forecasts" },
        503,
      );
    }
    console.error(
      JSON.stringify({
        level: "error",
        at: new Date().toISOString(),
        message: "Stage 14 forecast operation failed",
        operation: body.operation,
        schoolId,
        detail: String(error?.message || "").slice(0, 500),
      }),
    );
    return jsonNoStore(
      {
        error:
          "Forecast operation failed; no model was promoted or pupil action created",
      },
      500,
    );
  }
}
