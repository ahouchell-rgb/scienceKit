"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  IntelligenceNotice,
  IntelligencePageHeader,
} from "@/components/intelligence/IntelligencePage";
import { intelligenceFetch } from "@/lib/intelligence/client";
import type {
  EvaluationSummary,
  IntelligenceEvaluationResponse,
} from "@/lib/intelligence/contracts";
import { C } from "@/lib/theme";

function EvaluationContent() {
  const [data, setData] = useState<IntelligenceEvaluationResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    intelligenceFetch<IntelligenceEvaluationResponse>(
      "/api/intelligence/evaluation",
    )
      .then(setData)
      .catch((reason: Error) =>
        setError(reason.message || "Couldn't load evaluation"),
      );
  }, []);

  return (
    <div>
      <IntelligencePageHeader
        eyebrow="Evaluation · Stage 11"
        title="Is the system useful—and is learning changing?"
        intro="These are separate questions. The funnel measures use and completion; teacher ratings measure perceived quality; rechecks show descriptive before/after change. None alone is a causal impact estimate."
        links={[
          { href: "/intel/live", label: "← Live intelligence" },
          { href: "/intel/forecasts", label: "Shadow forecasts →", accent: true },
        ]}
      />
      {error && <IntelligenceNotice tone="error">{error}</IntelligenceNotice>}
      {!data ? (
        !error && <IntelligenceNotice>Loading evaluation…</IntelligenceNotice>
      ) : !data.enabled ? (
        <IntelligenceNotice>
          Apply the Stage 11 migration to activate evaluation measures.
        </IntelligenceNotice>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {(data.summaries || []).map((row: EvaluationSummary) => {
            const generated = Number(row.artifacts_generated) || 0;
            const delivered = Number(row.deliveries_recorded) || 0;
            const rechecked = Number(row.rechecks_completed) || 0;
            return (
              <article key={row.school_id} style={cardStyle}>
                <h2 style={{ color: C.text, fontSize: 18, margin: "0 0 14px" }}>{row.school_name}</h2>
                <div style={funnelStyle}>
                  <Metric label="Findings" value={row.findings} />
                  <Arrow />
                  <Metric label="Accepted" value={row.accepted_actions} />
                  <Arrow />
                  <Metric label="Generated" value={generated} />
                  <Arrow />
                  <Metric label="Delivered" value={delivered} hint={generated ? `${Math.round(100 * delivered / generated)}% of generated` : "—"} />
                  <Arrow />
                  <Metric label="Rechecked" value={rechecked} hint={delivered ? `${Math.round(100 * rechecked / delivered)}% of delivered` : "—"} />
                  <Arrow />
                  <Metric label="Outcomes" value={row.outcomes_recorded} />
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <Chip label="Mean teacher rating" value={row.mean_teacher_rating ? `${row.mean_teacher_rating}/5` : "not recorded"} />
                  <Chip label="Reported time saved" value={row.mean_reported_minutes_saved ? `${row.mean_reported_minutes_saved} min` : "not recorded"} />
                  <Chip label="Edited" value={row.edited_artifacts} />
                  <Chip label="Rejected" value={row.rejected_artifacts} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: unknown; hint?: string }) {
  return <div><div style={{ color: C.text, fontFamily: C.serif, fontSize: 26 }}>{String(value ?? 0)}</div><div style={metaStyle}>{label}</div>{hint && <div style={{ ...metaStyle, color: C.grn }}>{hint}</div>}</div>;
}
function Arrow() { return <span style={{ color: C.dim }}>→</span>; }
function Chip({ label, value }: { label: string; value: unknown }) {
  return <span style={{ padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 999, color: C.muted, fontSize: 10 }}>{label}: <strong style={{ color: C.text }}>{String(value)}</strong></span>;
}

export default function EvaluationPage() {
  return <AppShell><EvaluationContent /></AppShell>;
}

const cardStyle = { border: `1px solid ${C.border}`, borderRadius: 13, background: C.surface, padding: 18 } as const;
const funnelStyle = { display: "grid", gridTemplateColumns: "repeat(11, auto)", gap: 11, alignItems: "center", overflowX: "auto" as const, paddingBottom: 6 };
const metaStyle = { color: C.dim, fontFamily: C.mono, fontSize: 9, marginTop: 3 } as const;
