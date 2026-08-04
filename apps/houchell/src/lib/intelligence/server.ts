import {
  bearerToken,
  requireUserId,
  SK_ANON,
  SK_URL,
  skAdmin,
} from "@/lib/serverHelpers";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface IntelligenceProfile {
  id: string;
  school_id: string | null;
  school_role: string | null;
  trust_id: string | null;
  trust_role: string | null;
  role: string | null;
  is_lead: boolean | null;
}

export interface IntelligenceAuth {
  token: string;
  userId: string;
  profile: IntelligenceProfile;
}

export type IntelligenceCaller = Pick<IntelligenceAuth, "token" | "userId">;

interface RestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  prefer?: string;
}

export class IntelligenceRestError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly detail: string;

  constructor(status: number, rawBody: string) {
    let code: string | null = null;
    let detail = rawBody;
    try {
      const parsed = JSON.parse(rawBody);
      code = typeof parsed?.code === "string" ? parsed.code : null;
      detail =
        [parsed?.message, parsed?.details, parsed?.hint]
          .filter((value) => typeof value === "string" && value.length)
          .join(" · ") || rawBody;
    } catch {
      // Non-JSON responses still retain their status and body for classification.
    }
    super(`${status}:${code ? `${code}:` : ""}${detail}`);
    this.name = "IntelligenceRestError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export async function restAsUser<T = unknown>(
  path: string,
  token: string,
  options: RestOptions = {},
): Promise<T> {
  const method = options.method || "GET";
  const response = await fetch(`${SK_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SK_ANON,
      Authorization: `Bearer ${token}`,
      ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new IntelligenceRestError(
      response.status,
      await response.text().catch(() => ""),
    );
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export function rpcAsUser<T = unknown>(
  functionName: string,
  token: string,
  body: Record<string, unknown>,
): Promise<T> {
  return restAsUser<T>(`rpc/${functionName}`, token, {
    method: "POST",
    body,
  });
}

export async function authenticateIntelligenceCaller(
  request: Request,
): Promise<IntelligenceCaller | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const userId = await requireUserId(token);
  if (!userId) return null;
  return { token, userId };
}

export async function authenticateIntelligence(
  request: Request,
): Promise<IntelligenceAuth | null> {
  const caller = await authenticateIntelligenceCaller(request);
  if (!caller) return null;
  const { token, userId } = caller;
  const profiles = await restAsUser<IntelligenceProfile[]>(
    `profiles?id=eq.${userId}&select=id,school_id,school_role,trust_id,trust_role,role,is_lead&limit=1`,
    token,
  );
  return profiles[0] ? { token, userId, profile: profiles[0] } : null;
}

export async function canManageSchool(
  auth: IntelligenceAuth,
  schoolId: string,
): Promise<boolean> {
  if (
    auth.profile.school_id === schoolId &&
    (auth.profile.school_role === "hod" || auth.profile.school_role === "slt")
  ) {
    return true;
  }
  if (auth.profile.trust_role !== "trust_lead" || !auth.profile.trust_id) {
    return false;
  }
  const schools = await restAsUser<Array<{ id: string }>>(
    `schools?id=eq.${schoolId}&trust_id=eq.${auth.profile.trust_id}&select=id&limit=1`,
    auth.token,
  );
  return Boolean(schools[0]);
}

export async function canControlIntelligenceWork(
  auth: IntelligenceAuth,
  work: {
    owner_id?: string | null;
    created_by?: string | null;
    raised_by?: string | null;
    finding?: {
      school_id?: string | null;
      trust_id?: string | null;
      class_id?: string | null;
      raised_by?: string | null;
    } | null;
    school_id?: string | null;
    trust_id?: string | null;
    class_id?: string | null;
  },
): Promise<boolean> {
  const finding = work.finding || work;
  if (
    work.owner_id === auth.userId ||
    work.created_by === auth.userId ||
    work.raised_by === auth.userId ||
    finding.raised_by === auth.userId
  ) {
    return true;
  }
  if (
    finding.school_id &&
    auth.profile.school_id === finding.school_id &&
    (auth.profile.school_role === "hod" || auth.profile.school_role === "slt")
  ) {
    return true;
  }
  if (
    finding.trust_id &&
    auth.profile.trust_role === "trust_lead" &&
    auth.profile.trust_id === finding.trust_id
  ) {
    return true;
  }
  if (
    finding.school_id &&
    auth.profile.trust_role === "trust_lead" &&
    auth.profile.trust_id
  ) {
    return canManageSchool(auth, finding.school_id);
  }
  if (finding.class_id) {
    const classes = await restAsUser<Array<{ id: string }>>(
      `classes?id=eq.${finding.class_id}&teacher_id=eq.${auth.userId}&select=id&limit=1`,
      auth.token,
    ).catch(() => []);
    if (classes[0]) return true;
  }
  return false;
}

export function canManageGlobalCurriculum(auth: IntelligenceAuth): boolean {
  return auth.profile.role === "admin";
}

export function jsonNoStore(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function isMissingDatabaseObject(
  error: unknown,
  objectNames: readonly string[] = [],
): boolean {
  const code =
    error instanceof IntelligenceRestError ? error.code : null;
  const message = String(
    error instanceof Error ? error.message : error || "",
  ).toLowerCase();
  const matchesObject =
    objectNames.length === 0 ||
    objectNames.some((name) => message.includes(name.toLowerCase()));
  if (
    code &&
    ["42P01", "42883", "PGRST202", "PGRST205"].includes(code) &&
    matchesObject
  ) {
    return true;
  }
  return (
    (message.includes("does not exist") ||
      message.includes("schema cache") ||
      /(^|:\s|\s)404(?:\s|:|$)/.test(message)) &&
    matchesObject
  );
}

export function chunks<T>(values: readonly T[], size = 400): T[][] {
  const safeSize = Math.max(1, Math.floor(size));
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += safeSize) {
    result.push(values.slice(index, index + safeSize));
  }
  return result;
}

export async function adminInsertBatches<T>(
  table: string,
  rows: readonly T[],
  size = 400,
): Promise<any[]> {
  const inserted: any[] = [];
  for (const batch of chunks(rows, size)) {
    inserted.push(...((await skAdmin("POST", table, batch)) || []));
  }
  return inserted;
}
