import {
  authenticateIntelligence,
  isMissingDatabaseObject,
  jsonNoStore,
  UUID_RE,
} from "@/lib/intelligence/server";
import { skAdmin } from "@/lib/serverHelpers";

export const runtime = "nodejs";

async function permittedSchools(profile: any) {
  if (profile.trust_role === "trust_lead" && profile.trust_id) {
    return skAdmin(
      "GET",
      `schools?trust_id=eq.${profile.trust_id}&select=id,name&order=name.asc`,
    );
  }
  if (
    profile.school_id &&
    (profile.school_role === "hod" || profile.school_role === "slt")
  ) {
    return skAdmin(
      "GET",
      `schools?id=eq.${profile.school_id}&select=id,name&limit=1`,
    );
  }
  return [];
}

function selectedSchoolId(request: Request, schools: any[], body?: any) {
  const requested =
    String(body?.schoolId || new URL(request.url).searchParams.get("schoolId") || "");
  if (requested && schools.some((school) => school.id === requested)) return requested;
  return schools.length === 1 ? schools[0].id : "";
}

const inFilter = (values: string[]) => encodeURIComponent(`(${values.join(",")})`);

async function seedRetrievalProfiles(schoolId: string, actorId: string) {
  const classes = await skAdmin(
    "GET",
    `classes?school_id=eq.${schoolId}&archived=eq.false&select=id,name,year_group,academic_year`,
  );
  const classIds = (classes || []).map((row: any) => row.id).filter((id: string) => UUID_RE.test(id));
  if (!classIds.length) return { seeded: 0, alreadyKnown: 0, scanned: 0 };

  const members = await skAdmin(
    "GET",
    `class_members?class_id=in.${inFilter(classIds)}&select=student_id,class_id,joined_at`,
  );
  const studentIds = [
    ...new Set((members || []).map((row: any) => row.student_id).filter((id: string) => UUID_RE.test(id))),
  ] as string[];
  if (!studentIds.length) return { seeded: 0, alreadyKnown: 0, scanned: 0 };

  const [profiles, identities, reviews] = await Promise.all([
    skAdmin(
      "GET",
      `profiles?id=in.${inFilter(studentIds)}&select=id,display_name,full_name`,
    ),
    skAdmin(
      "GET",
      `pupil_source_identities?school_id=eq.${schoolId}&source_system=eq.retrieval_profile&source_tenant_key=eq.${schoolId}&source_record_id=in.${inFilter(studentIds)}&select=source_record_id`,
    ),
    skAdmin(
      "GET",
      `pupil_identity_review_queue?school_id=eq.${schoolId}&source_system=eq.retrieval_profile&source_tenant_key=eq.${schoolId}&source_record_id=in.${inFilter(studentIds)}&select=source_record_id`,
    ),
  ]);

  const known = new Set([
    ...(identities || []).map((row: any) => row.source_record_id),
    ...(reviews || []).map((row: any) => row.source_record_id),
  ]);
  const profileById = new Map((profiles || []).map((row: any) => [row.id, row]));
  const classById = new Map((classes || []).map((row: any) => [row.id, row]));
  const membershipsByStudent = new Map<string, any[]>();
  for (const member of members || []) {
    const list = membershipsByStudent.get(member.student_id) || [];
    list.push(member);
    membershipsByStudent.set(member.student_id, list);
  }

  const rows = studentIds
    .filter((studentId) => !known.has(studentId))
    .map((studentId) => {
      const profile: any = profileById.get(studentId);
      const studentMemberships = membershipsByStudent.get(studentId) || [];
      const linkedClasses = studentMemberships
        .map((member) => classById.get(member.class_id))
        .filter(Boolean);
      const years = linkedClasses
        .map((row: any) => Number(row.year_group))
        .filter((year: number) => Number.isInteger(year));
      return {
        school_id: schoolId,
        source_system: "retrieval_profile",
        source_tenant_key: schoolId,
        source_record_id: studentId,
        source_display_name: profile?.display_name || profile?.full_name || "Pupil",
        source_snapshot: {
          classIds: linkedClasses.map((row: any) => row.id),
          classNames: linkedClasses.map((row: any) => row.name),
          yearGroup: years[0] || null,
          academicYears: [...new Set(linkedClasses.map((row: any) => row.academic_year).filter(Boolean))],
        },
        reason_codes: ["retrieval_profile_requires_canonical_review"],
      };
    });

  if (rows.length) {
    const inserted = await skAdmin("POST", "pupil_identity_review_queue", rows);
    const events = (inserted || []).map((row: any) => ({
      review_id: row.id,
      school_id: schoolId,
      actor_id: actorId,
      event_type: "seeded",
      evidence: { sourceSystem: "retrieval_profile", sourceRecordId: row.source_record_id },
    }));
    if (events.length) await skAdmin("POST", "pupil_identity_review_events", events);
  }

  return {
    seeded: rows.length,
    alreadyKnown: studentIds.length - rows.length,
    scanned: studentIds.length,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateIntelligence(request);
    if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);
    const schools = await permittedSchools(auth.profile);
    if (!schools.length) return jsonNoStore({ enabled: false, reason: "leadership_only", schools: [] });
    const schoolId = selectedSchoolId(request, schools);
    if (!schoolId) return jsonNoStore({ enabled: true, schools, schoolId: null, queue: [], pupils: [] });

    const [queue, pupils, identities] = await Promise.all([
      skAdmin(
        "GET",
        `pupil_identity_review_queue?school_id=eq.${schoolId}&select=*&order=status.asc,created_at.asc`,
      ),
      skAdmin(
        "GET",
        `pupils?school_id=eq.${schoolId}&status=eq.active&select=id,display_name,year_group,form_group&order=display_name.asc`,
      ),
      skAdmin(
        "GET",
        `pupil_source_identities?school_id=eq.${schoolId}&link_status=eq.linked&select=id,pupil_id,source_system,source_record_id,match_method,reviewed_at`,
      ),
    ]);
    return jsonNoStore({ enabled: true, schools, schoolId, queue, pupils, identities });
  } catch (error) {
    if (isMissingDatabaseObject(error, ["pupil_identity_review_events", "pupil_identity_review_queue", "pupil_source_identities", "pupils"])) {
      return jsonNoStore({ enabled: false, reason: "migration_pending", schools: [], queue: [], pupils: [] });
    }
    return jsonNoStore({ error: "Couldn't load identity reconciliation" }, 500);
  }
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, 400);
  }

  try {
    const auth = await authenticateIntelligence(request);
    if (!auth) return jsonNoStore({ error: "Unauthorised" }, 401);
    const schools = await permittedSchools(auth.profile);
    const schoolId = selectedSchoolId(request, schools, body);
    if (!schoolId) return jsonNoStore({ error: "Choose a school in your permitted scope" }, 403);

    if (body.operation === "seed_retrieval") {
      return jsonNoStore(await seedRetrievalProfiles(schoolId, auth.userId), 201);
    }

    const reviewId = String(body.reviewId || "");
    if (!UUID_RE.test(reviewId)) return jsonNoStore({ error: "Invalid review id" }, 400);
    const review = (
      await skAdmin(
        "GET",
        `pupil_identity_review_queue?id=eq.${reviewId}&school_id=eq.${schoolId}&status=eq.open&select=*&limit=1`,
      )
    )?.[0];
    if (!review) return jsonNoStore({ error: "Open review not found in your scope" }, 404);

    const note = String(body.note || "").trim().slice(0, 1000);
    if (body.operation === "dismiss") {
      if (note.length < 3) return jsonNoStore({ error: "Record why this source row was dismissed" }, 400);
      await skAdmin("PATCH", `pupil_identity_review_queue?id=eq.${reviewId}`, {
        status: "dismissed",
        resolution_note: note,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await skAdmin("POST", "pupil_identity_review_events", {
        review_id: reviewId,
        school_id: schoolId,
        actor_id: auth.userId,
        event_type: "dismissed",
        rationale: note,
      });
      return jsonNoStore({ resolved: true });
    }

    let pupil: any;
    let eventType: "linked" | "created";
    if (body.operation === "create") {
      const displayName = String(review.source_display_name || "").trim().slice(0, 240);
      if (displayName.length < 2) return jsonNoStore({ error: "A pupil name is required" }, 400);
      pupil = (
        await skAdmin("POST", "pupils", {
          school_id: schoolId,
          display_name: displayName,
          year_group: Number.isInteger(Number(review.source_snapshot?.yearGroup))
            ? Number(review.source_snapshot.yearGroup)
            : null,
          status: "active",
        })
      )?.[0];
      eventType = "created";
    } else if (body.operation === "link") {
      const pupilId = String(body.pupilId || "");
      if (!UUID_RE.test(pupilId)) return jsonNoStore({ error: "Choose a canonical pupil" }, 400);
      pupil = (
        await skAdmin(
          "GET",
          `pupils?id=eq.${pupilId}&school_id=eq.${schoolId}&select=id,display_name&limit=1`,
        )
      )?.[0];
      eventType = "linked";
    } else {
      return jsonNoStore({ error: "Unsupported identity operation" }, 400);
    }
    if (!pupil?.id) return jsonNoStore({ error: "Canonical pupil not found" }, 404);

    const sourceIdentity = (
      await skAdmin("POST", "pupil_source_identities", {
        school_id: schoolId,
        pupil_id: pupil.id,
        source_system: review.source_system,
        source_tenant_key: review.source_tenant_key || "",
        source_record_id: review.source_record_id,
        source_display_name: review.source_display_name,
        match_method: eventType === "created" ? "manual_create" : "manual_review",
        match_confidence: 1,
        link_status: "linked",
        evidence: { reviewId, rationale: note || "Human-reviewed reconciliation" },
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
      })
    )?.[0];

    const classIds = Array.isArray(review.source_snapshot?.classIds)
      ? review.source_snapshot.classIds.filter((id: unknown) => typeof id === "string" && UUID_RE.test(id))
      : [];
    if (classIds.length) {
      const existing = await skAdmin(
        "GET",
        `pupil_class_memberships?pupil_id=eq.${pupil.id}&class_id=in.${inFilter(classIds)}&valid_to=is.null&select=class_id`,
      );
      const existingClassIds = new Set((existing || []).map((row: any) => row.class_id));
      const membershipRows = classIds
        .filter((classId: string) => !existingClassIds.has(classId))
        .map((classId: string) => ({
          school_id: schoolId,
          pupil_id: pupil.id,
          class_id: classId,
          source_identity_id: sourceIdentity.id,
        }));
      if (membershipRows.length) {
        await skAdmin("POST", "pupil_class_memberships", membershipRows);
      }
    }

    await skAdmin("PATCH", `pupil_identity_review_queue?id=eq.${reviewId}`, {
      status: "resolved",
      resolved_pupil_id: pupil.id,
      resolution_note: note || "Human-reviewed reconciliation",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await skAdmin("POST", "pupil_identity_review_events", {
      review_id: reviewId,
      school_id: schoolId,
      actor_id: auth.userId,
      event_type: eventType,
      pupil_id: pupil.id,
      rationale: note || "Human-reviewed reconciliation",
      evidence: { sourceIdentityId: sourceIdentity.id, classIds },
    });
    return jsonNoStore({ resolved: true, pupil, sourceIdentity }, 201);
  } catch (error: any) {
    const message = String(error?.message || "");
    if (message.includes("duplicate key")) {
      return jsonNoStore({ error: "This source row was reconciled by another request; refresh the queue" }, 409);
    }
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return jsonNoStore({ error: "Identity reconciliation service is not configured" }, 503);
    }
    if (/pupil_(identity|source)|pupils/.test(message)) {
      return jsonNoStore({ error: "Stage 8 identity migration has not been applied" }, 503);
    }
    return jsonNoStore({ error: "Couldn't reconcile this identity" }, 500);
  }
}
