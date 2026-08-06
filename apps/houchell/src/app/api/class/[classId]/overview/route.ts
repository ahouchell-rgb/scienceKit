import { rollupRetrieval, crosswalkMap } from "@/lib/mastery";
import { SK_ANON, SK_URL } from "@/lib/serverHelpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function rest(path: string, bearer: string) {
  const response = await fetch(`${SK_URL}/rest/v1/${path}`, {
    headers: { apikey: SK_ANON, Authorization: `Bearer ${bearer}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

async function rpc(name: string, body: unknown, bearer: string) {
  const response = await fetch(`${SK_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SK_ANON,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return response.ok ? response.json() : [];
}

function normaliseClass(row: any, access: "teacher" | "school" | "trust") {
  return {
    class_id: row.class_id || row.id,
    name: row.name,
    year_group: row.year_group,
    discipline: row.discipline || null,
    tier: row.tier || null,
    teacher_id: row.teacher_id || null,
    teacher_name: row.teacher_name || null,
    school_id: row.school_id || null,
    school_name: row.school_name || null,
    retrieval_class_ids: row.retrieval_class_ids || [],
    access,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const { classId } = await params;
  if (!UUID.test(classId)) return json({ error: "Invalid class id" }, 400);

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);
  const token = authorization.slice(7);

  let uid = "";
  try {
    const response = await fetch(`${SK_URL}/auth/v1/user`, {
      headers: { apikey: SK_ANON, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return json({ error: "Invalid auth" }, 401);
    uid = (await response.json()).id;
  } catch {
    return json({ error: "Auth check failed" }, 401);
  }

  let profile: any = {};
  try {
    profile = (
      await rest(
        `profiles?id=eq.${uid}&select=school_role,trust_role&limit=1`,
        token,
      )
    )?.[0] || {};
  } catch {
    return json({ error: "Couldn't load your access scope" }, 500);
  }

  let target: ReturnType<typeof normaliseClass> | null = null;

  // Owner-scoped RLS is the first and narrowest path.
  try {
    const owned = await rest(
      `classes?id=eq.${classId}&select=id,name,year_group,discipline,tier,teacher_id,school_id,retrieval_class_ids&limit=1`,
      token,
    );
    if (owned?.[0]) target = normaliseClass(owned[0], "teacher");
  } catch {
    // Leadership reads use the existing role-gated RPCs below.
  }

  if (!target && (profile.school_role === "hod" || profile.school_role === "slt")) {
    const schoolClasses = await rpc("school_classes", {}, token);
    const row = Array.isArray(schoolClasses)
      ? schoolClasses.find((candidate: any) => candidate.class_id === classId)
      : null;
    if (row) target = normaliseClass(row, "school");
  }

  if (!target && profile.trust_role === "trust_lead") {
    const trustClasses = await rpc("trust_classes", {}, token);
    const row = Array.isArray(trustClasses)
      ? trustClasses.find((candidate: any) => candidate.class_id === classId)
      : null;
    if (row) target = normaliseClass(row, "trust");
  }

  if (!target) return json({ error: "Class not found in your permitted scope" }, 404);

  let crosswalk = new Map<string, string>();
  try {
    crosswalk = crosswalkMap(
      await rest("topic_objective_map?select=topic_id,objective_id", token),
    );
  } catch {
    // The page can still show retrieval topics without a mapped objective.
  }

  const retrievalClassId = target.retrieval_class_ids[0] || null;
  let weak: any[] = [];
  if (retrievalClassId) {
    const rows = await rpc(
      "class_weak_topics",
      { p_class_id: retrievalClassId, p_limit: 20, p_min_marked: 5 },
      token,
    );
    weak = (Array.isArray(rows) ? rows : []).map((row: any) => ({
      topic_id: row.topic_id,
      topic_name: row.topic_name,
      objective_id: crosswalk.get(row.topic_id) || null,
      pct_correct: Math.round(Number(row.pct_correct)),
      marked: Number(row.marked) || 0,
      students: Number(row.students) || 0,
    }));
  }

  const rolled = rollupRetrieval([weak]);
  const objectiveIds = [
    ...new Set(rolled.map((row) => row.objective_id).filter((id): id is string => Boolean(id && UUID.test(id)))),
  ];
  const objectiveDetails = new Map<string, any>();
  if (objectiveIds.length > 0) {
    try {
      const rows = await rest(
        `objectives?id=in.(${objectiveIds.join(",")})&select=id,title,code,key_stage,subject:subjects(name,slug),strand:strands(name)`,
        token,
      );
      for (const row of rows || []) objectiveDetails.set(row.id, row);
    } catch {
      // Objective taxonomy detail is optional; topic labels remain usable.
    }
  }

  const objectives = rolled.map((row) => {
    const detail = row.objective_id ? objectiveDetails.get(row.objective_id) : null;
    return {
      key: row.key,
      objective_id: row.objective_id || null,
      topic_id: weak.find((topic) => topic.objective_id === row.objective_id)?.topic_id || null,
      title: detail?.title || row.label,
      code: detail?.code || null,
      key_stage: detail?.key_stage || null,
      subject: detail?.subject || null,
      strand: detail?.strand?.name || null,
      mastery_pct: row.pct,
      marked: row.marked,
      students: Math.max(
        0,
        ...weak
          .filter((topic) =>
            row.objective_id
              ? topic.objective_id === row.objective_id
              : topic.topic_name === row.label,
          )
          .map((topic) => topic.students),
      ),
      sources: ["retrieval"],
      evidence_strength: row.marked >= 20 ? "developing" : "limited",
    };
  });

  let canonicalRosterAvailable = false;
  let canonicalRosterLinked = false;
  try {
    const rows = await rest(
      `pupil_class_memberships?class_id=eq.${classId}&valid_to=is.null&select=id&limit=1`,
      token,
    );
    canonicalRosterAvailable = true;
    canonicalRosterLinked = Array.isArray(rows) && rows.length > 0;
  } catch {
    // Stage 2 migration is intentionally gated; show this honestly in coverage.
  }

  const weakAreaAverage =
    objectives.length > 0
      ? Math.round(
          objectives.reduce((sum, objective) => sum + objective.mastery_pct, 0) /
            objectives.length,
        )
      : null;

  return json({
    class: {
      ...target,
      retrieval_class_ids: undefined,
      retrievalLinked: Boolean(retrievalClassId),
    },
    summary: {
      weakAreaAverage,
      objectivesObserved: objectives.length,
      lowestObjective: objectives[0] || null,
    },
    objectives,
    coverage: {
      mastery: {
        status: retrievalClassId ? (objectives.length ? "available" : "empty") : "not_connected",
        label: "Retrieval mastery",
        detail: retrievalClassId
          ? objectives.length
            ? "Live class-level retrieval evidence"
            : "Connected, but no objective has the minimum evidence yet"
          : "Link this class to retrieval practice",
      },
      assessment: {
        status: "not_available",
        label: "Assessment QLA",
        detail: "A class-scoped assessment objective RPC is not available yet",
      },
      attendance: {
        status: "not_connected",
        label: "Attendance",
        detail: "No attendance event feed is connected",
      },
      behaviour: {
        status: "not_connected",
        label: "Behaviour",
        detail: "No behaviour event feed is connected",
      },
      identity: {
        status: canonicalRosterLinked
          ? "available"
          : canonicalRosterAvailable
            ? "empty"
            : "migration_pending",
        label: "Canonical pupil roster",
        detail: canonicalRosterLinked
          ? "Current canonical class memberships found"
          : canonicalRosterAvailable
            ? "Identity layer exists; this class has not been reconciled"
            : "Stage 2 migration has not been promoted to this environment",
      },
    },
    meta: {
      source: "live",
      scope: target.access,
      assessmentIncluded: false,
      generatedAt: new Date().toISOString(),
    },
  });
}
