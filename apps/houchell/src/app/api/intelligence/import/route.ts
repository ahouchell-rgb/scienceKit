import { artifactFingerprint } from "@/lib/artifactLineage";
import {
  type IntelligenceImportDomain,
  validateImportRow,
} from "@/lib/intelligenceImport";
import {
  authenticateIntelligence,
  canManageSchool,
  chunks,
  isMissingDatabaseObject,
  jsonNoStore,
  restAsUser,
  UUID_RE,
} from "@/lib/intelligence/server";
import { skAdmin } from "@/lib/serverHelpers";

export const runtime = "nodejs";
export const maxDuration = 120;

function identityKey(system: string, tenant: string, recordId: string) {
  return `${system}\u001f${tenant}\u001f${recordId}`;
}

async function loadSchoolIdentities(schoolId: string) {
  const identities: any[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const page = await skAdmin(
      "GET",
      `pupil_source_identities?school_id=eq.${schoolId}&link_status=eq.linked&select=id,pupil_id,source_system,source_tenant_key,source_record_id&order=id.asc&limit=1000&offset=${offset}`,
    );
    identities.push(...(page || []));
    if (!Array.isArray(page) || page.length < 1000) break;
  }
  return identities;
}

export async function GET(request: Request) {
  const auth = await authenticateIntelligence(request);
  if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);
  try {
    const schoolId = new URL(request.url).searchParams.get("schoolId") || auth.profile.school_id || "";
    if (!UUID_RE.test(schoolId) || !(await canManageSchool(auth, schoolId))) {
      return jsonNoStore({ error: "School intelligence management scope required" }, 403);
    }
    const [runs, state] = await Promise.all([
      restAsUser(
        `intelligence_ingest_runs?school_id=eq.${schoolId}&select=*&order=started_at.desc&limit=30`,
        auth.token,
      ),
      restAsUser(
        `class_cross_domain_state?school_id=eq.${schoolId}&select=*&order=class_name.asc`,
        auth.token,
      ),
    ]);
    return jsonNoStore({ enabled: true, schoolId, runs, state });
  } catch (error) {
    if (isMissingDatabaseObject(error, ["intelligence_ingest_runs", "class_cross_domain_state"])) {
      return jsonNoStore({ enabled: false, reason: "migration_pending", runs: [], state: [] });
    }
    return jsonNoStore({ error: "Couldn't load intelligence data operations" }, 500);
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

  const domain = String(body.domain || "") as IntelligenceImportDomain;
  const schoolId = String(body.schoolId || "");
  const sourceSystem = String(body.sourceSystem || "").trim().slice(0, 100);
  const sourceTenantKey = String(body.sourceTenantKey || "").trim().slice(0, 160);
  const rawRows = Array.isArray(body.rows) ? body.rows.slice(0, 10000) : [];
  if (!["attendance", "literacy"].includes(domain)) return jsonNoStore({ error: "Choose attendance or literacy" }, 400);
  if (!UUID_RE.test(schoolId) || !(await canManageSchool(auth, schoolId))) {
    return jsonNoStore({ error: "School intelligence management scope required" }, 403);
  }
  if (!sourceSystem) return jsonNoStore({ error: "sourceSystem is required" }, 400);
  if (!rawRows.length) return jsonNoStore({ error: "No import rows supplied" }, 400);

  let run: any;
  try {
    const fileFingerprint = artifactFingerprint(rawRows);
    const previous = (
      await skAdmin(
        "GET",
        `intelligence_ingest_runs?school_id=eq.${schoolId}&domain=eq.${domain}&source_system=eq.${encodeURIComponent(sourceSystem)}&source_tenant_key=eq.${encodeURIComponent(sourceTenantKey)}&file_fingerprint=eq.${fileFingerprint}&status=eq.completed&select=*&limit=1`,
      )
    )?.[0];
    if (previous) {
      return jsonNoStore({
        runId: previous.id,
        submitted: previous.submitted_rows,
        accepted: previous.accepted_rows,
        rejected: previous.rejected_rows,
        unresolved: previous.unresolved_rows,
        duplicates: previous.duplicate_rows,
        alreadyImported: true,
      });
    }
    run = (
      await skAdmin("POST", "intelligence_ingest_runs", {
        school_id: schoolId,
        domain,
        source_system: sourceSystem,
        source_tenant_key: sourceTenantKey,
        file_fingerprint: fileFingerprint,
        submitted_rows: rawRows.length,
        created_by: auth.userId,
      })
    )?.[0];
  } catch (error: any) {
    if (/intelligence_ingest_runs/.test(String(error?.message || ""))) {
      return jsonNoStore({ error: "Stage 12 cross-domain migration has not been applied" }, 503);
    }
    return jsonNoStore({ error: "Couldn't start the ingest run" }, 500);
  }

  const rejected: { row: number; errors: string[] }[] = [];
  const valid = rawRows.flatMap((raw: any, index: number) => {
    const result = validateImportRow(domain, raw);
    if (!result.row) {
      rejected.push({ row: index + 2, errors: result.errors });
      return [];
    }
    return [result.row];
  });

  try {
    const identities = await loadSchoolIdentities(schoolId);
    const identityMap = new Map(
      (identities || []).map((identity: any) => [
        identityKey(identity.source_system, identity.source_tenant_key || "", identity.source_record_id),
        identity,
      ]),
    );
    const unresolved: { sourceSystem: string; sourceRecordId: string }[] = [];
    const resolvedRows: any[] = [];
    for (const row of valid) {
      const identity: any = identityMap.get(
        identityKey(
          row.pupilSourceSystem,
          row.pupilSourceTenantKey,
          row.pupilSourceRecordId,
        ),
      );
      if (!identity) {
        unresolved.push({
          sourceSystem: row.pupilSourceSystem,
          sourceRecordId: row.pupilSourceRecordId,
        });
        continue;
      }
      const common = {
        school_id: schoolId,
        pupil_id: identity.pupil_id,
        source_system: sourceSystem,
        source_tenant_key: sourceTenantKey,
        source_record_id: row.sourceRecordId,
        ingest_run_id: run.id,
        provenance: {
          identityLinkId: identity.id,
          pupilSourceSystem: row.pupilSourceSystem,
          pupilSourceRecordId: row.pupilSourceRecordId,
        },
      };
      resolvedRows.push(
        domain === "attendance"
          ? {
              ...common,
              session_date: row.values.sessionDate,
              session_kind: row.values.sessionKind,
              attendance_code: row.values.attendanceCode,
              present: row.values.present,
              minutes_late: row.values.minutesLate,
            }
          : {
              ...common,
              assessed_at: row.values.assessedAt,
              measure: row.values.measure,
              value: row.values.value,
              scale: row.values.scale,
              assessment_name: row.values.assessmentName,
            },
      );
    }

    const table = domain === "attendance" ? "attendance_sessions" : "literacy_screens";
    const conflict = "school_id,source_system,source_tenant_key,source_record_id";
    let inserted = 0;
    for (const batch of chunks(resolvedRows, 500)) {
      const rows = await skAdmin(
        "POST",
        `${table}?on_conflict=${conflict}`,
        batch,
        "return=representation,resolution=ignore-duplicates",
      );
      inserted += Array.isArray(rows) ? rows.length : 0;
    }
    const duplicates = resolvedRows.length - inserted;
    await skAdmin("PATCH", `intelligence_ingest_runs?id=eq.${run.id}`, {
      status: "completed",
      accepted_rows: inserted,
      rejected_rows: rejected.length,
      unresolved_rows: unresolved.length,
      duplicate_rows: duplicates,
      summary: {
        validationErrors: rejected.slice(0, 50),
        unresolvedIdentities: unresolved.slice(0, 50),
      },
      finished_at: new Date().toISOString(),
    });
    return jsonNoStore({
      runId: run.id,
      submitted: rawRows.length,
      accepted: inserted,
      rejected: rejected.length,
      unresolved: unresolved.length,
      duplicates,
      validationErrors: rejected.slice(0, 20),
      unresolvedIdentities: unresolved.slice(0, 20),
    }, 201);
  } catch {
    await skAdmin("PATCH", `intelligence_ingest_runs?id=eq.${run.id}`, {
      status: "failed",
      rejected_rows: rejected.length,
      summary: { validationErrors: rejected.slice(0, 50) },
      finished_at: new Date().toISOString(),
    }).catch(() => null);
    return jsonNoStore({ error: "The ingest run failed before completion" }, 500);
  }
}
