import {
  canManageSchool,
  restAsUser,
  type IntelligenceAuth,
} from "@/lib/intelligence/server";

const rows = <T = unknown>(value: unknown): T[] => Array.isArray(value) ? value : [];

export interface AvailableSchool {
  id: string;
  name: string;
  trust_id?: string | null;
}

export async function availableIntelligenceSchools(auth: IntelligenceAuth) {
  if (auth.profile.trust_role === "trust_lead" && auth.profile.trust_id) {
    return rows<AvailableSchool>(await restAsUser(
      `schools?trust_id=eq.${auth.profile.trust_id}&select=id,name,trust_id&order=name.asc`,
      auth.token,
    ));
  }
  if (!auth.profile.school_id) return [];
  return rows<AvailableSchool>(await restAsUser(
    `schools?id=eq.${auth.profile.school_id}&select=id,name,trust_id&limit=1`,
    auth.token,
  ));
}

export async function canAccessIntelligenceSchool(
  auth: IntelligenceAuth,
  schoolId: string,
) {
  if (auth.profile.school_id === schoolId) return true;
  return canManageSchool(auth, schoolId);
}
