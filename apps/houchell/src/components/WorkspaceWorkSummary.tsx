"use client";

import { useEffect, useMemo, useState } from "react";
import { sk } from "@/lib/sk";
import { workUrgency } from "@/lib/intelligenceWork";
import { C } from "@/lib/theme";

export function WorkspaceWorkSummary({ label = "Owned work" }: { label?: string }) {
  const [findings, setFindings] = useState<any[] | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/intelligence/work", {
      headers: { authorization: `Bearer ${sk.auth.getToken()}` },
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((body) => {
        if (!active) return;
        setEnabled(Boolean(body.enabled));
        setFindings(body.findings || []);
      })
      .catch(() => {
        if (active) {
          setEnabled(false);
          setFindings([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    const actions = (findings || []).flatMap((finding) => finding.actions || []);
    return {
      findings: (findings || []).filter((finding) => finding.status === "open").length,
      open: actions.filter(
        (action) => action.status !== "completed" && action.status !== "cancelled",
      ).length,
      overdue: actions.filter(
        (action) => workUrgency(action.due_at, action.status) === "overdue",
      ).length,
      completed: actions.filter((action) => action.status === "completed").length,
    };
  }, [findings]);

  if (findings === null) return null;

  return (
    <a
      href="/inbox"
      style={{
        display: "block",
        padding: 15,
        marginBottom: 26,
        color: C.text,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 13,
        textDecoration: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 11,
        }}
      >
        <span
          style={{
            color: C.dim,
            fontFamily: C.mono,
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span style={{ color: C.grn, fontFamily: C.mono, fontSize: 9 }}>
          Open inbox →
        </span>
      </div>
      {!enabled ? (
        <div style={{ color: C.amb, fontSize: 11 }}>
          Persistent work migration is gated in this environment.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {[
            ["Open findings", summary.findings, C.blu],
            ["Actions", summary.open, C.text],
            ["Overdue", summary.overdue, summary.overdue ? C.red : C.dim],
            ["Outcomes", summary.completed, C.grn],
          ].map(([name, value, color]) => (
            <div key={String(name)} style={{ minWidth: 0 }}>
              <div style={{ color: String(color), fontFamily: C.serif, fontSize: 25 }}>
                {String(value)}
              </div>
              <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 8 }}>
                {String(name)}
              </div>
            </div>
          ))}
        </div>
      )}
    </a>
  );
}
