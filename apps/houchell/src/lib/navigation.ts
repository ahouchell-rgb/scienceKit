/**
 * One navigation contract for the staff Education OS.
 *
 * TopNav and Sidebar intentionally consume the same definitions. Role changes
 * alter the user's altitude, not the underlying product or object graph.
 */

export type WorkspaceLevel = "trust" | "school" | "department" | "teacher";

export interface NavigationProfile {
  role?: string | null;
  school_role?: string | null;
  trust_role?: string | null;
  is_lead?: boolean | null;
  full_name?: string | null;
  school_name?: string | null;
  trust_name?: string | null;
  department_name?: string | null;
}

export interface NavigationItem {
  href: string;
  label: string;
  hint?: string;
  hard?: boolean;
  exact?: boolean;
  /** Extra route roots owned by this item, such as /unit under Curriculum. */
  aliases?: string[];
}

export const STANDALONE_ROOTS = ["/learn", "/revise", "/retrieve", "/tools"] as const;

export const CHANNEL_NAVIGATION: NavigationItem[] = [
  { href: "/", label: "Staff", hint: "Education OS", exact: true },
  { href: "/learn", label: "Learn", hint: "Springboard", hard: true },
  { href: "/revise", label: "Revise", hint: "Revision" },
  { href: "/retrieve", label: "Practice", hint: "Retrieval" },
  { href: "/tools", label: "Library", hint: "Interactive" },
];

const TEACHER_NAV: NavigationItem[] = [
  { href: "/", label: "Today", exact: true },
  { href: "/teacher", label: "Classes" },
  { href: "/curriculum", label: "Curriculum", aliases: ["/unit"] },
  { href: "/slides", label: "Create" },
  { href: "/assessments", label: "Assess" },
  { href: "/intel", label: "Intelligence" },
  { href: "/inbox", label: "Inbox" },
  { href: "/parents", label: "Families", aliases: ["/home-course"] },
  { href: "/manage", label: "Operations", aliases: ["/setup", "/school/integrations"] },
];

const DEPARTMENT_NAV: NavigationItem[] = [
  { href: "/department", label: "Department", exact: true },
  { href: "/teacher", label: "Classes" },
  { href: "/curriculum", label: "Curriculum", aliases: ["/unit"] },
  { href: "/assessments", label: "Assess" },
  { href: "/intel", label: "Intelligence" },
  { href: "/slides", label: "Resources" },
  { href: "/inbox", label: "Inbox" },
  { href: "/manage", label: "Operations", aliases: ["/setup", "/school/integrations"] },
];

const SCHOOL_NAV: NavigationItem[] = [
  { href: "/school", label: "School", exact: true },
  { href: "/curriculum", label: "Curriculum", aliases: ["/unit"] },
  { href: "/assessments", label: "Assess" },
  { href: "/intel", label: "Intelligence" },
  { href: "/school/intervention", label: "Interventions" },
  { href: "/parents", label: "Families", aliases: ["/home-course"] },
  { href: "/inbox", label: "Inbox" },
  { href: "/manage", label: "Operations", aliases: ["/setup", "/school/integrations"] },
];

const TRUST_NAV: NavigationItem[] = [
  { href: "/trust", label: "Trust", exact: true },
  { href: "/curriculum", label: "Curriculum", aliases: ["/unit"] },
  { href: "/intel", label: "Intelligence" },
  { href: "/slides", label: "Resources" },
  { href: "/inbox", label: "Inbox" },
  { href: "/trust-centre", label: "Governance" },
];

export const isStaffRoute = (pathname: string | null | undefined): boolean => {
  const path = pathname || "/";
  return !STANDALONE_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
};

export function workspaceLevelFor(profile?: NavigationProfile | null): WorkspaceLevel {
  if (profile?.trust_role === "trust_lead") return "trust";
  if (profile?.school_role === "slt") return "school";
  if (profile?.school_role === "hod" || profile?.role === "hod" || profile?.is_lead) return "department";
  return "teacher";
}

export function workspaceNavigation(profile?: NavigationProfile | null): NavigationItem[] {
  const level = workspaceLevelFor(profile);
  const base =
    level === "trust" ? TRUST_NAV :
    level === "school" ? SCHOOL_NAV :
    level === "department" ? DEPARTMENT_NAV :
    TEACHER_NAV;

  if (profile?.role !== "admin" && !profile?.is_lead) return base;
  const content: NavigationItem = { href: "/content", label: "Content" };
  const insertAt = Math.max(1, base.findIndex((item) => item.href === "/inbox"));
  return [...base.slice(0, insertAt), content, ...base.slice(insertAt)];
}

export const workspaceHome = (level: WorkspaceLevel): string =>
  level === "trust" ? "/trust" :
  level === "school" ? "/school" :
  level === "department" ? "/department" :
  "/";

export function isNavigationActive(item: NavigationItem, pathname: string | null | undefined): boolean {
  const path = pathname || "/";
  if (item.exact) return path === item.href;
  if (path === item.href || path.startsWith(`${item.href}/`)) return true;
  return Boolean(item.aliases?.some((alias) => path === alias || path.startsWith(`${alias}/`)));
}

export const WORKSPACE_LABEL: Record<WorkspaceLevel, string> = {
  trust: "Trust",
  school: "School",
  department: "Department",
  teacher: "Teacher",
};

export const WORKSPACE_PURPOSE: Record<WorkspaceLevel, string> = {
  trust: "Allocate support and assure trust-wide impact",
  school: "Find structural barriers and coordinate the response",
  department: "Know whether the curriculum is landing",
  teacher: "Prepare the next lesson and support your pupils",
};

export function scopeName(profile?: NavigationProfile | null): string {
  const level = workspaceLevelFor(profile);
  if (level === "trust") return profile?.trust_name || "Trust scope";
  if (level === "school") return profile?.school_name || "School scope";
  if (level === "department") return profile?.department_name || "Department scope";
  return "My classes";
}

export function routeContext(pathname: string | null | undefined): string {
  const path = pathname || "/";
  if (path.startsWith("/class/")) return "Class 360";
  if (path.startsWith("/objective/")) return "Objective 360";
  if (path.startsWith("/response/")) return "Response loop";
  if (path.startsWith("/unit/")) return path.includes("/lesson/") ? "Lesson" : "Unit";
  if (path.startsWith("/slides/")) return "Deck";
  if (path === "/slides") return "Resource library";
  if (path.startsWith("/school/intervention")) return "Interventions";
  if (path.startsWith("/department")) return "Department";
  if (path.startsWith("/school")) return "School";
  if (path.startsWith("/trust")) return "Trust";
  if (path.startsWith("/curriculum")) return "Curriculum";
  if (path.startsWith("/assessments")) return "Assessment";
  if (path.startsWith("/teacher")) return "Classes";
  if (path.startsWith("/intel")) return "Intelligence";
  if (path.startsWith("/inbox")) return "Action Inbox";
  if (path.startsWith("/parents") || path.startsWith("/home-course")) return "Families";
  if (path.startsWith("/manage") || path.startsWith("/setup")) return "Operations";
  return "Today";
}

export function academicYearLabel(now = new Date()): string {
  const year = now.getFullYear();
  const start = now.getMonth() >= 7 ? year : year - 1;
  return `${start}–${String(start + 1).slice(-2)}`;
}
