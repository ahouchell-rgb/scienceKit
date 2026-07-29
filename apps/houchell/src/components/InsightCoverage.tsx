import type { CSSProperties } from "react";
import { C } from "@/lib/theme";

export type CoverageStatus =
  | "available"
  | "empty"
  | "not_available"
  | "not_connected"
  | "migration_pending";

export interface CoverageSignal {
  status: CoverageStatus;
  label: string;
  detail: string;
}

const STATUS: Record<CoverageStatus, { label: string; color: string; background: string }> = {
  available: { label: "Available", color: C.grn, background: C.grnS },
  empty: { label: "Awaiting data", color: C.amb, background: C.ambS },
  not_available: { label: "Not available", color: C.dim, background: C.surface },
  not_connected: { label: "Not connected", color: C.dim, background: C.surface },
  migration_pending: { label: "Migration gated", color: C.amb, background: C.ambS },
};

const card: CSSProperties = {
  padding: 14,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  background: C.surface,
  minWidth: 0,
};

export function InsightCoverage({
  coverage,
  compact = false,
}: {
  coverage: Record<string, CoverageSignal>;
  compact?: boolean;
}) {
  return (
    <div
      className="insight-coverage"
      style={{
        display: "grid",
        gridTemplateColumns: compact
          ? "repeat(auto-fit, minmax(150px, 1fr))"
          : "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 10,
      }}
    >
      {Object.entries(coverage).map(([key, signal]) => {
        const status = STATUS[signal.status];
        return (
          <div key={key} style={card}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 7 }}>
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: status.color,
                  boxShadow: signal.status === "available" ? `0 0 12px ${status.color}` : "none",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{signal.label}</span>
            </div>
            <div
              style={{
                display: "inline-block",
                padding: "2px 6px",
                borderRadius: 4,
                background: status.background,
                color: status.color,
                fontFamily: C.mono,
                fontSize: 9,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: 7,
              }}
            >
              {status.label}
            </div>
            {!compact && (
              <p style={{ color: C.dim, fontSize: 11, lineHeight: 1.45, margin: 0 }}>
                {signal.detail}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
