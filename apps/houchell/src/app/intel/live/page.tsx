"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  IntelligenceGuardrails,
  IntelligenceNotice,
  IntelligencePageHeader,
} from "@/components/intelligence/IntelligencePage";
import { intelligenceFetch } from "@/lib/intelligence/client";
import type { LiveIntelligenceResponse } from "@/lib/intelligence/contracts";
import { C } from "@/lib/theme";

function band(row: any) {
  if (Number(row.evidence_count) < 8) return { label: "limited evidence", color: C.amb };
  if (Number(row.uncertainty_points) > 25) return { label: "developing evidence", color: C.blu };
  return { label: "established signal", color: C.grn };
}

function LiveIntelligence() {
  const [data, setData] = useState<LiveIntelligenceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      setData(
        await intelligenceFetch<LiveIntelligenceResponse>(
          "/api/intelligence/live",
        ),
      );
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : "";
      setError(message || "Couldn't load intelligence");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const backfill = async (schoolId: string) => {
    setBusy(true);
    setError("");
    try {
      await intelligenceFetch("/api/intelligence/live", {
        method: "POST",
        body: JSON.stringify({ operation: "backfill_retrieval", schoolId }),
      });
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Backfill failed");
    } finally {
      setBusy(false);
    }
  };

  const rows = data?.classState || [];

  if (!data && !error) {
    return <IntelligenceNotice>Loading the evidence spine…</IntelligenceNotice>;
  }

  return (
    <div>
      <IntelligencePageHeader
        eyebrow="Live intelligence · Stage 9"
        title="What the evidence supports now."
        intro="This surface reads the immutable event ledger. Every estimate carries its evidence count, recency, source mix, uncertainty and model version. It does not calculate a universal pupil risk score and it does not turn correlation into cause."
        links={[
          { href: "/intel", label: "← Intelligence evidence lab" },
          { href: "/intel/evaluation", label: "Evaluation →" },
          { href: "/intel/forecasts", label: "Shadow forecasts →", accent: true },
        ]}
      />

      {error && <IntelligenceNotice tone="error">{error}</IntelligenceNotice>}

      {!data?.enabled ? (
        <IntelligenceNotice>
          The live read model is implemented but not active in this environment. Reconcile pupil
          identities, then apply the Stage 9 migration on a database branch.
        </IntelligenceNotice>
      ) : (
        <>
          <IntelligenceGuardrails>
            <span>✓ bounded objective estimates</span>
            <span>✓ visible uncertainty</span>
            <span>✓ immutable provenance</span>
            <span>× no “at-risk child” label</span>
          </IntelligenceGuardrails>

          <section style={{ marginTop: 26 }}>
            <h2 style={sectionTitle}>Data coverage</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 }}>
              {(data.coverage || []).map((school: any) => (
                <article key={school.school_id} style={cardStyle}>
                  <strong style={{ color: C.text }}>{school.school_name}</strong>
                  <div style={statsStyle}>
                    <span>{school.canonical_pupils} canonical pupils</span>
                    <span>{school.linked_source_identities} source links</span>
                    <span>{school.unresolved_identities} unresolved</span>
                    <span>{school.learning_events} events</span>
                  </div>
                  {(data.profile?.school_role === "hod" || data.profile?.school_role === "slt" || data.profile?.trust_role === "trust_lead") && (
                    <button style={secondaryButton} disabled={busy} onClick={() => backfill(school.school_id)}>
                      {busy ? "Backfilling…" : "Backfill reconciled retrieval events"}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section style={{ marginTop: 28 }}>
            <h2 style={sectionTitle}>Lowest current objective states</h2>
            {rows.length === 0 ? (
              <IntelligenceNotice>
                No reconciled learning events yet. Resolve identities first; unlinked source rows
                are deliberately excluded.
              </IntelligenceNotice>
            ) : (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 13, overflow: "hidden", background: C.surface }}>
                {rows.slice(0, 80).map((row: any, index: number) => {
                  const evidenceBand = band(row);
                  return (
                    <div
                      key={`${row.class_id}:${row.objective_key}`}
                      style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, padding: 14, borderTop: index ? `1px solid ${C.rule}` : "none" }}
                    >
                      <div>
                        {row.objective_id ? (
                          <a
                            href={`/curriculum/graph?objective=${encodeURIComponent(row.objective_id)}`}
                            style={{ color: C.text, fontSize: 13, fontWeight: 700, textDecorationColor: C.grn }}
                          >
                            {row.objective_title || row.objective_key || "Unmapped objective"}
                          </a>
                        ) : (
                          <strong style={{ color: C.text, fontSize: 13 }}>
                            {row.objective_title || row.objective_key || "Unmapped objective"}
                          </strong>
                        )}
                        <div style={metaStyle}>
                          {row.class_name}{row.year_group ? ` · Y${row.year_group}` : ""} · {row.evidence_count} responses · {row.pupil_count} pupils · model v{row.model_version}
                        </div>
                        <div style={{ ...metaStyle, color: evidenceBand.color }}>
                          {evidenceBand.label} · ±{row.uncertainty_points} points · {Array.isArray(row.source_mix) ? row.source_mix.join(", ") : "source recorded"}
                        </div>
                      </div>
                      <div style={{ color: Number(row.mastery_estimate) < 50 ? C.red : C.grn, fontFamily: C.serif, fontSize: 25 }}>
                        {Math.round(Number(row.mastery_estimate))}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{ marginTop: 28 }}>
            <h2 style={sectionTitle}>Cross-domain binding-constraint checks</h2>
            {(data.crossDomain || []).length === 0 ? (
              <IntelligenceNotice>
                Attendance and literacy evidence are not connected yet. Use the governed import
                workflow after identity reconciliation.
                <a href="/manage/intelligence-data" style={{ color: C.grn, marginLeft: 8 }}>Open data operations →</a>
              </IntelligenceNotice>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {data.crossDomain.map((row: any) => (
                  <article key={row.class_id} style={cardStyle}>
                    <strong style={{ color: C.text }}>{row.class_name}</strong>
                    <div style={metaStyle}>
                      learning {row.learning_mastery ?? "—"}% · attendance {row.attendance_rate ?? "—"}% · literacy {row.literacy_value ?? "—"}
                    </div>
                    {(row.hypotheses || []).filter((hypothesis: any) => hypothesis.status !== "not_supported").map((hypothesis: any) => (
                      <div key={hypothesis.key} style={{ color: hypothesis.status === "plausible" ? C.amb : C.dim, fontSize: 11, marginTop: 8 }}>
                        {hypothesis.status.replaceAll("_", " ")}: {hypothesis.summary}
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function LiveIntelPage() {
  return <AppShell><LiveIntelligence /></AppShell>;
}

const sectionTitle = { fontFamily: C.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: C.dim, margin: "0 0 12px" };
const cardStyle = { border: `1px solid ${C.border}`, borderRadius: 13, background: C.surface, padding: 16 } as const;
const statsStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, color: C.dim, fontFamily: C.mono, fontSize: 9, margin: "12px 0" } as const;
const secondaryButton = { padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 10, cursor: "pointer" } as const;
const metaStyle = { color: C.dim, fontFamily: C.mono, fontSize: 9, marginTop: 5 } as const;
