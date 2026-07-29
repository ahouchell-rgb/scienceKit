"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/sk";
import {
  academicYearLabel,
  routeContext,
  scopeName,
  isStaffRoute,
  WORKSPACE_LABEL,
  WORKSPACE_PURPOSE,
  workspaceHome,
  workspaceLevelFor,
} from "@/lib/navigation";
import { C } from "@/lib/theme";

const pill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  minHeight: 28,
  padding: "5px 10px",
  border: `1px solid ${C.border}`,
  borderRadius: 999,
  fontFamily: C.mono,
  fontSize: 10.5,
  color: C.muted,
  textDecoration: "none",
  whiteSpace: "nowrap",
} as const;

export function WorkspaceBar() {
  const { profile } = useAuth();
  const pathname = usePathname();
  if (!isStaffRoute(pathname)) return null;
  const level = workspaceLevelFor(profile);
  const label = WORKSPACE_LABEL[level];

  return (
    <div style={{ borderBottom: `1px solid ${C.rule}`, background: "rgba(4,11,22,0.44)" }}>
      <div
        aria-label="Current workspace scope"
        style={{
          width: "min(1180px, calc(100% - 36px))",
          margin: "0 auto",
          minHeight: 44,
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        <Link
          href={workspaceHome(level)}
          title={WORKSPACE_PURPOSE[level]}
          style={{ ...pill, color: C.accent, borderColor: "rgba(88,224,194,0.28)", background: C.grnS }}
        >
          <span aria-hidden>◈</span>
          <strong style={{ fontWeight: 600 }}>{label}</strong>
        </Link>
        <span aria-hidden style={{ color: C.dim, fontSize: 10 }}>›</span>
        <span style={{ ...pill, color: C.text }}>{scopeName(profile)}</span>
        <span aria-hidden style={{ color: C.dim, fontSize: 10 }}>›</span>
        <span style={pill}>{routeContext(pathname)}</span>
        <span style={{ flex: 1 }} />
        <span title="Current academic year" style={pill}>{academicYearLabel()}</span>
        <Link href="/school/integrations" title="Open source and sync status" style={pill}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: C.amb }} />
          Data status
        </Link>
        <Link
          href="/inbox"
          aria-current={pathname === "/inbox" ? "page" : undefined}
          style={{
            ...pill,
            color: pathname === "/inbox" ? C.accentFg : C.text,
            background: pathname === "/inbox" ? C.accent : "rgba(255,255,255,0.04)",
            borderColor: pathname === "/inbox" ? "transparent" : C.border,
          }}
        >
          Inbox
        </Link>
      </div>
    </div>
  );
}
