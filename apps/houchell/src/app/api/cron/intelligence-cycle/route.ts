import { runSchoolIntelligenceCycle } from "@/lib/intelligence/orchestrator";
import { reportError } from "@/lib/observe";
import { cronAuthorized, recordCronRun, skAdmin } from "@/lib/serverHelpers";

const JOB = "intelligence-cycle";

export const runtime = "nodejs";
export const maxDuration = 300;

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return json({ error: "unauthorized" }, 401);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" }, 500);
  }
  const startedAt = new Date().toISOString();
  try {
    const schools = await skAdmin("GET", "schools?select=id,name&order=created_at.asc&limit=1000");
    const results: any[] = [];
    for (const school of Array.isArray(schools) ? schools : []) {
      try {
        const result = await runSchoolIntelligenceCycle(school.id);
        results.push({ schoolId: school.id, schoolName: school.name, ...result });
      } catch (error: any) {
        await reportError(error, { route: JOB, school_id: school.id });
        results.push({ schoolId: school.id, schoolName: school.name, error: error?.message || "cycle failed" });
      }
    }
    const failed = results.filter((result) => result.error || result.run?.status === "failed").length;
    const issues = results.filter((result) => result.run?.status === "completed_with_issues").length;
    await recordCronRun(JOB, {
      startedAt,
      ok: failed === 0,
      processed: results.length - failed,
      failed,
      notes: `${results.length - failed} completed; ${issues} with step issues; ${failed} failed`,
    });
    return json({ processed: results.length - failed, failed, issues, results });
  } catch (error: any) {
    await reportError(error, { route: JOB, phase: "load schools" });
    await recordCronRun(JOB, { startedAt, ok: false, processed: 0, failed: 1, notes: error?.message });
    return json({ error: "Couldn't run the intelligence cycle" }, 500);
  }
}
