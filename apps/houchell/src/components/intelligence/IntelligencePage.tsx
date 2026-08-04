import type { ReactNode } from "react";
import { C } from "@/lib/theme";

export function IntelligencePageHeader({
  eyebrow,
  title,
  intro,
  links,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  links?: Array<{ href: string; label: string; accent?: boolean }>;
}) {
  return (
    <>
      {links?.map((link, index) => (
        <a
          key={link.href}
          href={link.href}
          style={{
            ...backStyle,
            ...(index ? { marginLeft: 14 } : {}),
            ...(link.accent ? { color: C.amb } : {}),
          }}
        >
          {link.label}
        </a>
      ))}
      <div style={eyebrowStyle}>{eyebrow}</div>
      <h1 style={titleStyle}>{title}</h1>
      <p style={introStyle}>{intro}</p>
    </>
  );
}

export function IntelligenceNotice({
  children,
  tone = "empty",
}: {
  children: ReactNode;
  tone?: "empty" | "error";
}) {
  return (
    <div
      style={
        tone === "error"
          ? {
              ...noticeStyle,
              color: C.red,
              border: `1px solid ${C.red}55`,
              background: C.redS,
              marginBottom: 16,
            }
          : noticeStyle
      }
    >
      {children}
    </div>
  );
}

export function IntelligenceGuardrails({
  children,
  tone = "safe",
}: {
  children: ReactNode;
  tone?: "safe" | "caution";
}) {
  const color = tone === "caution" ? C.amb : C.grn;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        color,
        fontFamily: C.mono,
        fontSize: 9,
        padding: 12,
        border: `1px solid ${color}55`,
        borderRadius: 11,
        background: tone === "caution" ? C.ambS : C.grnS,
      }}
    >
      {children}
    </div>
  );
}

const backStyle = {
  color: C.dim,
  fontFamily: C.mono,
  fontSize: 10,
  textDecoration: "none",
} as const;
const eyebrowStyle = {
  color: C.grn,
  fontFamily: C.mono,
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  marginTop: 16,
} as const;
const titleStyle = {
  fontFamily: C.serif,
  fontWeight: 400,
  fontSize: 42,
  lineHeight: 1.04,
  margin: "8px 0 12px",
  color: C.text,
} as const;
const introStyle = {
  maxWidth: 850,
  color: C.muted,
  fontSize: 14,
  lineHeight: 1.6,
  margin: "0 0 24px",
} as const;
const noticeStyle = {
  border: `1px dashed ${C.border}`,
  borderRadius: 12,
  padding: 18,
  color: C.muted,
  fontSize: 12,
  lineHeight: 1.55,
} as const;
