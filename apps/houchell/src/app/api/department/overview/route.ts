import { blendObjectiveMastery, rollupRetrieval } from "@/lib/mastery";
import { bearerToken, requireUserId, SK_ANON, SK_URL } from "@/lib/serverHelpers";

export const runtime = "nodejs";
export const maxDuration = 90;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

async function rest(path: string, token: string) {
  const response = await fetch(`${SK_URL}/rest/v1/${path}`, {
    headers: { apikey: SK_ANON, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return json({ error: "Missing bearer token" }, 401);
  const userId = await requireUserId(token);
  if (!userId) return json({ error: "Invalid auth" }, 401);

  let profile: any;
  try {
    profile = (
      await rest(
        `profiles?id=eq.${userId}&select=id,full_name,school_id,school_role,role,is_lead&limit=1`,
        token,
      )
    )?.[0];
  } catch {
    return json({ error: "Couldn't load your department role" }, 500);
  }
  const isDepartmentLead =
    profile?.school_role === "hod" || profile?.role === "hod" || profile?.is_lead;
  if (!profile?.school_id || !isDepartmentLead) {
    return json({ enabled: false, reason: "not_department_lead" });
  }

  const origin = new URL(request.url).origin;
  const schoolResponse = await fetch(`${origin}/api/school/overview?live=1`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const school = await schoolResponse.json();
  if (!schoolResponse.ok) {
    return json({ error: school.error || "Couldn't load school evidence" }, schoolResponse.status);
  }
  if (!school.enabled) return json({ enabled: false, reason: "school_scope_unavailable" });

  let mappingMode:
    | "canonical_department"
    | "legacy_hod_pointer"
    | "school_role_fallback" = "school_role_fallback";
  let department: any = null;
  let permittedClassIds = new Set<string>();

  // Preferred path: Stage 2 temporal department memberships.
  try {
    const memberships = await rest(
      `department_staff_memberships?profile_id=eq.${userId}&valid_to=is.null&select=department_id,membership_role,department:departments(id,name,subject:subjects(name,slug))&order=created_at.asc`,
      token,
    );
    const lead =
      (memberships || []).find((row: any) => row.membership_role === "lead") ||
      memberships?.[0];
    if (lead?.department_id) {
      department = lead.department;
      const classMemberships = await rest(
        `department_class_memberships?department_id=eq.${lead.department_id}&valid_to=is.null&select=class_id`,
        token,
      );
      permittedClassIds = new Set((classMemberships || []).map((row: any) => row.class_id));
      mappingMode = "canonical_department";
    }
  } catch {
    // The Stage 2 migration may still be gated.
  }

  // Compatibility path: the live role model still carries teacher → hod_id.
  if (mappingMode !== "canonical_department") {
    try {
      const reports = await rest(
        `profiles?hod_id=eq.${userId}&school_id=eq.${profile.school_id}&select=id`,
        token,
      );
      const teacherIds = new Set((reports || []).map((row: any) => row.id));
      teacherIds.add(userId);
      const matched = (school.classes || []).filter((row: any) =>
        teacherIds.has(row.teacher_id),
      );
      if (matched.length > 0) {
        permittedClassIds = new Set(matched.map((row: any) => row.class_id));
        mappingMode = "legacy_hod_pointer";
      }
    } catch {
      // Fall through to the explicit school-role fallback.
    }
  }

  // Until canonical membership is backfilled, never invent a department:
  // show the authorised school scope and label it as provisional.
  const classes =
    mappingMode === "school_role_fallback"
      ? school.classes || []
      : (school.classes || []).filter((row: any) => permittedClassIds.has(row.class_id));
  const objectiveMastery = blendObjectiveMastery(
    rollupRetrieval(classes.map((row: any) => row.weak || [])),
    [],
  );

  return json({
    enabled: true,
    department: {
      id: department?.id || null,
      name:
        department?.name ||
        (mappingMode === "legacy_hod_pointer"
          ? "My department"
          : "Department mapping pending"),
      subject: department?.subject || null,
    },
    school: school.school,
    mappingMode,
    mappingDetail:
      mappingMode === "canonical_department"
        ? "Temporal department staff and class memberships"
        : mappingMode === "legacy_hod_pointer"
          ? "Compatibility scope from the existing teacher-to-HoD relationship"
          : "Canonical membership is not available; showing authorised school classes without claiming they form one department",
    classes,
    years: [...new Set(classes.map((row: any) => row.year_group).filter(Boolean))].sort(
      (left: any, right: any) => left - right,
    ),
    objectiveMastery,
    assessmentIncluded: false,
    generatedAt: new Date().toISOString(),
  });
}
