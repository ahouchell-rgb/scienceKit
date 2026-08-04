"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  IntelligenceGuardrails,
  IntelligenceNotice,
  IntelligencePageHeader,
} from "@/components/intelligence/IntelligencePage";
import { intelligenceFetch } from "@/lib/intelligence/client";
import type {
  ForecastLabResponse,
  ForecastRun,
  SchoolOption,
} from "@/lib/intelligence/contracts";
import { C } from "@/lib/theme";

function ForecastLabContent() {
  const [data, setData] = useState<ForecastLabResponse | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async (schoolId?: string) => {
    setError("");
    const query = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
    try {
      setData(
        await intelligenceFetch<ForecastLabResponse>(
          `/api/intelligence/forecasts${query}`,
        ),
      );
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "Couldn't load forecast lab",
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const operate = async (operation: "run_shadow" | "score_outcomes") => {
    setBusy(operation);
    setError("");
    try {
      await intelligenceFetch("/api/intelligence/forecasts", {
        method: "POST",
        body: JSON.stringify({
          operation,
          schoolId: data?.selectedSchoolId,
          maxItems: 2000,
        }),
      });
      await load(data?.selectedSchoolId);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "Forecast operation failed",
      );
    } finally {
      setBusy("");
    }
  };

  const model = (data?.models || []).find(
    (row: any) => row.model_key === "next_attempt_beta_bernoulli" && row.version === 1,
  );
  const evaluation = data?.latestEvaluation;
  const latestRun = data?.latestRun;

  return (
    <div>
      <IntelligencePageHeader
        eyebrow="Governed forecasting · Stage 14"
        title="Earn the right to predict."
        intro="This lab tests one narrow question: how likely is success on the next comparable attempt for this objective? Forecasts expire, remain invisible at pupil level, trigger no decision, and are compared with the simple school-objective baseline before any release is considered."
        links={[
          { href: "/intel/live", label: "← Live intelligence" },
          { href: "/intel/evaluation", label: "Response evaluation" },
        ]}
      />

      {error && <IntelligenceNotice tone="error">{error}</IntelligenceNotice>}
      {!data ? (
        !error && (
          <IntelligenceNotice>Loading the shadow model registry…</IntelligenceNotice>
        )
      ) : !data.enabled ? (
        <IntelligenceNotice>
          Stage 14 is built but its migration has not been applied in this environment.
          Production forecasting remains off.
        </IntelligenceNotice>
      ) : (
        <>
          <IntelligenceGuardrails tone="caution">
            <span>SHADOW ONLY</span>
            <span>× no pupil risk score</span>
            <span>× no automated grouping or intervention</span>
            <span>× no protected-characteristic features</span>
            <span>× no automatic model promotion</span>
          </IntelligenceGuardrails>

          <div className="forecast-toolbar">
            <label style={labelStyle}>
              School scope
              <select
                style={selectStyle}
                value={data.selectedSchoolId || ""}
                onChange={(event) => load(event.target.value)}
              >
                {(data.schools || []).map((school: SchoolOption) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </label>
            <button
              style={primaryButton}
              disabled={Boolean(busy)}
              onClick={() => operate("run_shadow")}
            >
              {busy === "run_shadow" ? "Freezing feature snapshots…" : "Run shadow forecast"}
            </button>
            <button
              style={secondaryButton}
              disabled={Boolean(busy)}
              onClick={() => operate("score_outcomes")}
            >
              {busy === "score_outcomes" ? "Scoring future attempts…" : "Score available outcomes"}
            </button>
          </div>

          <section className="metric-grid">
            <Metric label="Model state" value={(model?.status || "missing").toUpperCase()} color={C.amb} />
            <Metric label="Latest forecasts" value={latestRun?.forecast_count ?? 0} />
            <Metric label="Outcomes scored" value={evaluation?.sample_size ?? 0} />
            <Metric
              label="Evaluation"
              value={(evaluation?.evaluation_status || "not ready").replaceAll("_", " ")}
              color={evaluation?.evaluation_status === "candidate_better" ? C.grn : C.amb}
            />
          </section>

          <section className="two-column">
            <article style={cardStyle}>
              <div style={sectionLabel}>Model contract</div>
              <h2 style={cardTitle}>{model?.model_key || "Model migration pending"} · v{model?.version || "—"}</h2>
              <div style={metaStyle}>{model?.method}</div>
              <dl style={definitionGrid}>
                <dt>Target</dt><dd>Next comparable objective attempt correct</dd>
                <dt>Horizon</dt><dd>Next attempt or 42 days</dd>
                <dt>Baseline</dt><dd>{model?.baseline_model_key || "school objective peer rate"}</dd>
                <dt>Review due</dt><dd>{model?.review_due_at ? new Date(model.review_due_at).toLocaleDateString("en-GB") : "—"}</dd>
              </dl>
              <div style={sectionLabel}>Known limitations</div>
              <ul style={{ color: C.muted, fontSize: 11, lineHeight: 1.55, paddingLeft: 18, marginBottom: 0 }}>
                {(model?.known_limitations || []).map((limitation: string) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </article>

            <article style={cardStyle}>
              <div style={sectionLabel}>Temporal evaluation</div>
              {!evaluation ? (
                <div style={emptyInner}>
                  No future labels yet. Run a forecast, collect comparable attempts, then score outcomes.
                </div>
              ) : (
                <>
                  <div className="score-grid">
                    <Score label="Candidate Brier" value={formatMetric(evaluation.brier_score)} />
                    <Score label="Baseline Brier" value={formatMetric(evaluation.baseline_brier_score)} />
                    <Score label="Skill vs baseline" value={evaluation.brier_skill_score == null ? "—" : `${Math.round(Number(evaluation.brier_skill_score) * 100)}%`} />
                    <Score label="Calibration error" value={formatMetric(evaluation.expected_calibration_error)} />
                  </div>
                  <p style={cautionStyle}>
                    Lower Brier and calibration error are better. At least 30 labelled
                    forecasts are required even for a provisional comparison; passing this
                    screen still does not release the model.
                  </p>
                  <div style={sectionLabel}>Calibration bins</div>
                  {(evaluation.calibration_bins || []).map((bin: any) => (
                    <div key={`${bin.lower}:${bin.upper}`} style={binRow}>
                      <span>{Math.round(bin.lower * 100)}–{Math.round(bin.upper * 100)}%</span>
                      <div style={track}>
                        <span style={{ ...bar, width: `${Math.max(0, Math.min(100, Number(bin.observedRate || 0) * 100))}%` }} />
                      </div>
                      <span>{bin.count ? `${Math.round(Number(bin.observedRate) * 100)}% actual · n=${bin.count}` : "no labels"}</span>
                    </div>
                  ))}
                </>
              )}
            </article>
          </section>

          <section className="two-column" style={{ marginTop: 14 }}>
            <article style={cardStyle}>
              <div style={sectionLabel}>Latest probability distribution · aggregate only</div>
              {(data.distribution?.buckets || []).map((bucket: any) => {
                const total = Math.max(1, Number(data.distribution?.total) || 1);
                return (
                  <div key={bucket.key} style={distributionRow}>
                    <span>{bucket.label}</span>
                    <div style={track}>
                      <span style={{ ...bar, width: `${Math.round(100 * bucket.count / total)}%` }} />
                    </div>
                    <strong>{bucket.count}</strong>
                  </div>
                );
              })}
              <div style={{ ...metaStyle, marginTop: 12 }}>
                Evidence confidence: {data.distribution?.confidence?.established || 0} established · {data.distribution?.confidence?.developing || 0} developing · {data.distribution?.confidence?.limited || 0} limited.
              </div>
            </article>

            <article style={cardStyle}>
              <div style={sectionLabel}>Run history</div>
              {(data.runs || []).length === 0 ? (
                <div style={emptyInner}>No shadow runs yet.</div>
              ) : (data.runs || []).slice(0, 8).map((run: ForecastRun) => (
                <div key={run.id} style={runRow}>
                  <div>
                    <strong style={{ color: C.text, fontSize: 11 }}>
                      {new Date(run.as_of).toLocaleString("en-GB")}
                    </strong>
                    <div style={metaStyle}>
                      {run.forecast_count} forecasts · {run.outcome_count} outcomes
                      {run.truncated ? " · capped" : ""}
                    </div>
                  </div>
                  <span style={{ color: run.status === "completed" ? C.grn : run.status === "failed" ? C.red : C.amb, fontFamily: C.mono, fontSize: 9 }}>
                    {run.status}
                  </span>
                </div>
              ))}
            </article>
          </section>

          <section style={{ marginTop: 18 }}>
            <div style={sectionLabel}>Objective-level shadow summaries</div>
            {(data.objectiveAggregates || []).length === 0 ? (
              <IntelligenceNotice>
                No objective aggregate has at least three forecasts yet.
              </IntelligenceNotice>
            ) : (
              <div style={tableShell}>
                {(data.objectiveAggregates || []).slice(0, 50).map((row: any, index: number) => (
                  <div key={row.objectiveKey} style={{ ...objectiveRow, borderTop: index ? `1px solid ${C.rule}` : "none" }}>
                    <div>
                      <strong style={{ color: C.text, fontSize: 12 }}>{row.title}</strong>
                      <div style={metaStyle}>
                        {row.code ? `${row.code} · ` : ""}{row.forecastCount} forecasts · {row.established} established evidence
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ color: C.grn, fontFamily: C.serif, fontSize: 22 }}>{row.meanPrediction}%</strong>
                      <div style={metaStyle}>baseline {row.meanBaseline}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div style={legalStyle}>
            This screen deliberately returns no pupil forecast rows or identities. It
            evaluates model behaviour, not children. A future release would require a
            documented purpose, DPIA/best-interests assessment, independently governed
            fairness audit, human-contestation pathway and explicit model approval.
          </div>
        </>
      )}

      <style>{`
        .forecast-toolbar { display:grid; grid-template-columns:minmax(220px,1fr) auto auto; gap:10px; align-items:end; margin:22px 0; }
        .metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:14px; }
        .two-column { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }
        .score-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        @media (max-width: 820px) {
          .forecast-toolbar, .metric-grid, .two-column { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}

function Metric({ label, value, color = C.grn }: any) {
  return (
    <div style={cardStyle}>
      <div style={sectionLabel}>{label}</div>
      <div style={{ color, fontFamily: C.serif, fontSize: 28, textTransform: "capitalize" }}>{String(value)}</div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div style={scoreCard}>
      <strong style={{ color: C.text, fontFamily: C.serif, fontSize: 23 }}>{value}</strong>
      <div style={metaStyle}>{label}</div>
    </div>
  );
}

function formatMetric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : "—";
}

export default function ForecastLabPage() {
  return <AppShell><ForecastLabContent /></AppShell>;
}

const cardStyle = { border: `1px solid ${C.border}`, borderRadius: 13, background: C.surface, padding: 17 } as const;
const cardTitle = { color: C.text, fontSize: 17, margin: "0 0 6px" } as const;
const sectionLabel = { color: C.dim, fontFamily: C.mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 10 };
const metaStyle = { color: C.dim, fontFamily: C.mono, fontSize: 9, lineHeight: 1.45 } as const;
const emptyInner = { padding: 14, border: `1px dashed ${C.border}`, borderRadius: 10, color: C.dim, fontSize: 11, lineHeight: 1.5 } as const;
const labelStyle = { display: "grid", gap: 5, color: C.dim, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" as const };
const selectStyle = { minWidth: 220, padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgSoft, color: C.text, fontSize: 11 } as const;
const primaryButton = { padding: "10px 13px", border: "none", borderRadius: 999, background: C.accent, color: C.accentFg, fontFamily: C.mono, fontSize: 9, fontWeight: 700, cursor: "pointer" } as const;
const secondaryButton = { ...primaryButton, background: C.surface, color: C.text, border: `1px solid ${C.border}` } as const;
const definitionGrid = { display: "grid", gridTemplateColumns: "110px 1fr", gap: "6px 10px", color: C.muted, fontSize: 10, margin: "15px 0", lineHeight: 1.45 } as const;
const scoreCard = { border: `1px solid ${C.border}`, background: C.bgSoft, borderRadius: 9, padding: 11 } as const;
const cautionStyle = { color: C.amb, background: C.ambS, border: `1px solid ${C.amb}44`, borderRadius: 9, padding: 10, fontSize: 10, lineHeight: 1.5 } as const;
const track = { height: 7, borderRadius: 999, background: C.rule, overflow: "hidden" } as const;
const bar = { display: "block", height: "100%", borderRadius: 999, background: C.accentGrad } as const;
const binRow = { display: "grid", gridTemplateColumns: "56px 1fr 118px", gap: 8, alignItems: "center", color: C.dim, fontFamily: C.mono, fontSize: 8, marginTop: 7 } as const;
const distributionRow = { display: "grid", gridTemplateColumns: "60px 1fr 30px", gap: 9, alignItems: "center", color: C.muted, fontFamily: C.mono, fontSize: 9, marginTop: 10 } as const;
const runRow = { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.rule}` } as const;
const tableShell = { border: `1px solid ${C.border}`, borderRadius: 12, background: C.surface, overflow: "hidden" } as const;
const objectiveRow = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: 13 } as const;
const legalStyle = { marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.rule}`, color: C.dim, fontSize: 10, lineHeight: 1.55 } as const;
