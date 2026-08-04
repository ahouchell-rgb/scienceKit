import {
  authenticateIntelligenceCaller,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
} from "@/lib/intelligence/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateIntelligenceCaller(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);

  try {
    const summaries = await restAsUser(
      "intelligence_evaluation_summary?select=*&order=school_name.asc",
      auth.token,
    );
    return jsonNoStore({
      enabled: true,
      summaries,
      interpretation:
        "Adoption, quality and descriptive learner outcomes are reported separately.",
    });
  } catch (error) {
    if (
      isMissingDatabaseObject(error, ["intelligence_evaluation_summary"])
    ) {
      return jsonNoStore({
        enabled: false,
        reason: "migration_pending",
        summaries: [],
      });
    }
    return jsonNoStore(
      { error: "Couldn't load intelligence evaluation" },
      500,
    );
  }
}
