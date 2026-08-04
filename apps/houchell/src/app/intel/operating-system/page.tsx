"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  IntelligenceGuardrails,
  IntelligenceNotice,
  IntelligencePageHeader,
} from "@/components/intelligence/IntelligencePage";
import { intelligenceFetch } from "@/lib/intelligence/client";
import type {
  OperatingSystemQueueItem,
  OperatingSystemResponse,
} from "@/lib/intelligence/contracts";
import { C } from "@/lib/theme";

const STAGES = [
  ["15", "Brain health"],
  ["16", "Golden loop"],
  ["17", "Learning policy"],
  ["18", "Lesson studio"],
  ["19", "Role OS"],
  ["20", "Production"],
] as const;

const STATUS_COLOUR: Record<string, string> = {
  healthy: C.grn,
  candidate: C.grn,
  completed: C.grn,
  degraded: C.amb,
  stale: C.amb,
  hold: C.amb,
  unknown: C.dim,
  insufficient_data: C.dim,
  blocked: C.red,
  critical: C.red,
  retire_review: C.red,
};

const formatStatus = (value: unknown) => String(value || "unknown").replaceAll("_", " ");
const percent = (value: unknown) => value == null ? "—" : `${Math.round(Number(value) * 100)}%`;

function StatusPill({ value }: { value: unknown }) {
  const status = String(value || "unknown");
  const color = STATUS_COLOUR[status] || C.dim;
  return (
    <span style={{ ...pillStyle, color, borderColor: `${color}66`, background: `${color}12` }}>
      {formatStatus(status)}
    </span>
  );
}

function Metric({ label, value, note }: { label: string; value: unknown; note?: string }) {
  return (
    <div style={metricStyle}>
      <strong style={{ color: C.text, fontFamily: C.serif, fontSize: 26, fontWeight: 400 }}>
        {String(value ?? 0)}
      </strong>
      <span style={metaStyle}>{label}</span>
      {note && <span style={{ ...metaStyle, color: C.dim }}>{note}</span>}
    </div>
  );
}

function StageRail() {
  return (
    <div className="os-stage-rail" aria-label="Stages 15 to 20">
      {STAGES.map(([number, label]) => (
        <div key={number} style={stageStyle}>
          <span style={{ color: C.grn, fontFamily: C.mono, fontSize: 9 }}>STAGE {number}</span>
          <strong style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>{label}</strong>
        </div>
      ))}
    </div>
  );
}

function QueueCard({
  item,
  busy,
  note,
  onNote,
  onOperate,
}: {
  item: OperatingSystemQueueItem;
  busy: string;
  note: string;
  onNote: (value: string) => void;
  onOperate: (operation: string, payload: Record<string, unknown>) => void;
}) {
  const itemBusy = Boolean(busy);
  return (
    <article style={queueCardStyle}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={kindStyle}>{item.kind}</span>
        <span style={{ ...metaStyle, color: item.lane === "now" ? C.amb : C.dim }}>{item.lane}</span>
        <span style={{ ...metaStyle, marginLeft: "auto" }}>{item.priority}</span>
      </div>
      <h3 style={{ color: C.text, fontSize: 15, margin: "10px 0 6px" }}>{item.title}</h3>
      <p style={copyStyle}>{item.why}</p>
      {item.dueAt && (
        <div style={{ ...metaStyle, marginTop: 8 }}>
          Due {new Date(item.dueAt).toLocaleString("en-GB")}
        </div>
      )}
      {item.recommendationId ? (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <button
            style={primaryButton}
            disabled={itemBusy}
            onClick={() => onOperate("decide_recommendation", {
              recommendationId: item.recommendationId,
              decision: "accepted",
            })}
          >
            Accept and create my action
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              aria-label={`Reason for rejecting ${item.title}`}
              value={note}
              onChange={(event) => onNote(event.target.value)}
              placeholder="Reason if rejecting"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              style={secondaryButton}
              disabled={itemBusy || note.trim().length < 3}
              onClick={() => onOperate("decide_recommendation", {
                recommendationId: item.recommendationId,
                decision: "rejected",
                note,
              })}
            >
              Reject
            </button>
          </div>
        </div>
      ) : item.kind === "finding" ? (
        <button
          style={{ ...secondaryButton, marginTop: 12 }}
          disabled={itemBusy}
          onClick={() => onOperate("prepare_recommendation", {
            findingId: item.id.replace("finding:", ""),
          })}
        >
          Prepare governed response
        </button>
      ) : item.href ? (
        <a href={item.href} style={{ ...linkButton, marginTop: 12 }}>
          Open response loop →
        </a>
      ) : (
        <a href="/intel" style={{ ...linkButton, marginTop: 12 }}>
          Review in intelligence →
        </a>
      )}
    </article>
  );
}

function OperatingSystemContent() {
  const [data, setData] = useState<OperatingSystemResponse | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  const load = useCallback(async (schoolId?: string) => {
    setError("");
    const query = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
    try {
      const next = await intelligenceFetch<OperatingSystemResponse>(
        `/api/intelligence/operating-system${query}`,
      );
      setData(next);
      setSelectedSchoolId(next.selectedSchoolId || schoolId || "");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Couldn't load the operating system");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const operate = async (operation: string, payload: Record<string, unknown> = {}) => {
    const operationKey = `${operation}:${String(payload.recommendationId || payload.findingId || selectedSchoolId)}`;
    setBusy(operationKey);
    setError("");
    try {
      await intelligenceFetch("/api/intelligence/operating-system", {
        method: "POST",
        body: JSON.stringify({ operation, schoolId: selectedSchoolId, ...payload }),
      });
      setDecisionNotes({});
      await load(selectedSchoolId);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "The operating-system action failed");
    } finally {
      setBusy("");
    }
  };

  const summary = data?.summary || {};
  const policy = data?.policyEvaluations?.[0];
  const evaluation = data?.evaluation;

  return (
    <div>
      <IntelligencePageHeader
        eyebrow="Teacher operating system · Stages 15–20"
        title={data?.role?.headline || "One brain. Every role. Better decisions."}
        intro={data?.role
          ? `${data.role.label} mode · ${data.role.job}. The system joins evidence, curriculum, governed recommendations, lesson creation and delayed rechecks into one daily loop.`
          : "The operating system joins evidence, curriculum, governed recommendations, lesson creation and delayed rechecks into one daily loop."}
        links={[
          { href: "/intel", label: "Evidence console" },
          { href: "/intel/live", label: "Live evidence" },
          { href: "/intel/forecasts", label: "Shadow lab", accent: true },
        ]}
      />

      <StageRail />
      {error && <IntelligenceNotice tone="error">{error}</IntelligenceNotice>}
      {!data ? (
        !error && <IntelligenceNotice>Loading your role-scoped operating system…</IntelligenceNotice>
      ) : !data.enabled ? (
        <IntelligenceNotice>
          Stages 15–20 are built in code. Apply the additive Stage 15–20 database migration to activate this command centre; no live database change has been made automatically.
        </IntelligenceNotice>
      ) : data.reason === "no_school_scope" ? (
        <IntelligenceNotice>
          Assign this account to a school or trust before the operating system can establish a safe data scope.
        </IntelligenceNotice>
      ) : (
        <>
          <IntelligenceGuardrails tone="caution">
            <span>HUMAN DECISION REQUIRED</span>
            <span>× no universal pupil risk score</span>
            <span>× no automatic intervention</span>
            <span>× no automatic policy promotion</span>
            <span>× no causal claims from before/after data</span>
          </IntelligenceGuardrails>

          <div style={toolbarStyle}>
            {(data.schools || []).length > 1 && (
              <label style={labelStyle}>
                School scope
                <select
                  value={selectedSchoolId}
                  onChange={(event) => void load(event.target.value)}
                  style={inputStyle}
                >
                  {(data.schools || []).map((school) => (
                    <option key={school.id} value={school.id}>{school.name}</option>
                  ))}
                </select>
              </label>
            )}
            <span style={{ ...metaStyle, marginLeft: "auto" }}>
              Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleTimeString("en-GB") : "—"}
            </span>
          </div>

          <section className="os-two-column">
            <article style={cardStyle}>
              <div style={sectionHeadStyle}>
                <div>
                  <div style={sectionLabel}>Stage 15 · Brain health</div>
                  <h2 style={cardTitle}>Can the brain be trusted right now?</h2>
                </div>
                <StatusPill value={data.brain?.status} />
              </div>
              <div style={metricGridStyle}>
                <Metric label="healthy sources" value={data.brain?.healthy || 0} />
                <Metric label="need attention" value={data.brain?.attention || 0} />
                <Metric label="last check" value={data.brain?.checkedAt ? new Date(data.brain.checkedAt).toLocaleDateString("en-GB") : "never"} />
              </div>
              <div style={{ display: "grid", gap: 7, marginTop: 14 }}>
                {(data.brain?.sources || []).map((source: any) => (
                  <div key={source.source_key} style={sourceRowStyle}>
                    <div>
                      <strong style={{ color: C.text, fontSize: 11 }}>{source.source_key.replaceAll("_", " ")}</strong>
                      <div style={metaStyle}>
                        {source.accepted_records || 0} records · {source.unresolved_records || 0} unresolved
                      </div>
                    </div>
                    <StatusPill value={source.status} />
                  </div>
                ))}
              </div>
              {data.permissions?.canManageSchool && (
                <button
                  style={{ ...secondaryButton, marginTop: 14 }}
                  disabled={Boolean(busy)}
                  onClick={() => void operate("refresh_health")}
                >
                  {busy.startsWith("refresh_health") ? "Checking sources…" : "Run activation health check"}
                </button>
              )}
            </article>

            <article style={cardStyle}>
              <div style={sectionLabel}>Stage 19 · Role operating system</div>
              <h2 style={cardTitle}>{data.role?.label} command centre</h2>
              <p style={copyStyle}>
                The same evidence graph changes altitude—not truth. Teachers see owned classes and actions; departments see curriculum response; schools see coordination; trusts see variation and support needs.
              </p>
              <div style={metricGridStyle}>
                <Metric label="open findings" value={summary.open_findings} />
                <Metric label="visible actions" value={summary.visible_actions} />
                <Metric label="decisions waiting" value={summary.recommendations_waiting} />
                <Metric label="rechecks due" value={summary.rechecks_due} />
              </div>
            </article>
          </section>

          <section style={{ marginTop: 16 }}>
            <div style={sectionLabel}>Stage 16 · The teacher golden loop</div>
            <h2 style={largeTitle}>Notice → decide → teach → recheck → learn</h2>
            {(data.queue || []).length === 0 ? (
              <IntelligenceNotice>
                Nothing is demanding action in this scope. Open a reviewed finding in the evidence console to prepare a governed response.
              </IntelligenceNotice>
            ) : (
              <div className="os-queue-grid">
                {(data.queue || []).map((item) => (
                  <QueueCard
                    key={item.id}
                    item={item}
                    busy={busy}
                    note={decisionNotes[item.recommendationId || item.id] || ""}
                    onNote={(value) => setDecisionNotes((current) => ({
                      ...current,
                      [item.recommendationId || item.id]: value,
                    }))}
                    onOperate={(operation, payload) => void operate(operation, payload)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="os-two-column" style={{ marginTop: 16 }}>
            <article style={cardStyle}>
              <div style={sectionHeadStyle}>
                <div>
                  <div style={sectionLabel}>Stage 17 · Governed learning flywheel</div>
                  <h2 style={cardTitle}>Does the response policy deserve confidence?</h2>
                </div>
                <StatusPill value={policy?.evaluation_status || "insufficient_data"} />
              </div>
              <div style={metricGridStyle}>
                <Metric label="recommendations" value={policy?.recommendation_count || 0} />
                <Metric label="acceptance" value={percent(policy?.acceptance_rate)} />
                <Metric label="delivery" value={percent(policy?.delivery_rate)} />
                <Metric label="recheck" value={percent(policy?.recheck_rate)} />
                <Metric label="outcomes" value={policy?.outcome_count || 0} />
                <Metric label="mean descriptive Δ" value={policy?.mean_descriptive_delta == null ? "—" : `${policy.mean_descriptive_delta} pp`} />
              </div>
              <p style={{ ...copyStyle, marginTop: 12 }}>
                Candidate means “bring to human review”, never “turn on automation”. A minimum sample and completed rechecks are required, and teacher edits remain a first-class signal.
              </p>
              {data.permissions?.canManageSchool && (
                <button
                  style={secondaryButton}
                  disabled={Boolean(busy)}
                  onClick={() => void operate("evaluate_policy")}
                >
                  {busy.startsWith("evaluate_policy") ? "Evaluating…" : "Evaluate current policy"}
                </button>
              )}
            </article>

            <article style={cardStyle}>
              <div style={sectionLabel}>Stage 18 · Advanced lesson studio</div>
              <h2 style={cardTitle}>Every generated lesson has a frozen teaching contract</h2>
              <p style={copyStyle}>
                The contract joins the reviewed finding, live uncertainty, approved prerequisites, misconceptions, vocabulary, adaptive hinge branches, teacher notes, student task and delayed recheck.
              </p>
              <div style={metricGridStyle}>
                <Metric label="specs frozen" value={summary.lesson_specs_frozen || data.lessonSpecs?.length || 0} />
                <Metric label="schema" value="v2" />
                <Metric label="teacher review" value="required" />
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {(data.lessonSpecs || []).slice(0, 4).map((spec: any) => (
                  <a key={spec.id} href={`/response/${spec.action_id}`} style={specRowStyle}>
                    <span>{spec.unit_id}{spec.lesson_id ? ` · ${spec.lesson_id}` : ""}</span>
                    <span style={metaStyle}>schema v{spec.schema_version} →</span>
                  </a>
                ))}
                {(data.lessonSpecs || []).length === 0 && (
                  <div style={emptyInner}>Accepted response actions will freeze a specification before generation.</div>
                )}
              </div>
            </article>
          </section>

          <section style={{ ...cardStyle, marginTop: 16 }}>
            <div style={sectionHeadStyle}>
              <div>
                <div style={sectionLabel}>Stage 20 · Production intelligence platform</div>
                <h2 style={cardTitle}>Health, lineage, policy and impact remain separate signals</h2>
              </div>
              <StatusPill value={(data.monitoringEvents || []).some((event: any) => event.severity === "critical") ? "critical" : "healthy"} />
            </div>
            <div style={metricGridStyle}>
              <Metric label="generated" value={evaluation?.artifacts_generated || 0} />
              <Metric label="delivered" value={evaluation?.deliveries_recorded || 0} />
              <Metric label="rechecked" value={evaluation?.rechecks_completed || 0} />
              <Metric label="outcomes" value={evaluation?.outcomes_recorded || 0} />
              <Metric label="teacher rating" value={evaluation?.mean_teacher_rating ? `${evaluation.mean_teacher_rating}/5` : "—"} />
              <Metric label="reported time saved" value={evaluation?.mean_reported_minutes_saved ? `${evaluation.mean_reported_minutes_saved} min` : "—"} />
            </div>
            {data.permissions?.canManageSchool && (data.monitoringEvents || []).length > 0 && (
              <div style={{ display: "grid", gap: 7, marginTop: 14 }}>
                {(data.monitoringEvents || []).slice(0, 6).map((event: any) => (
                  <div key={event.id} style={sourceRowStyle}>
                    <div>
                      <strong style={{ color: C.text, fontSize: 11 }}>{event.event_type}</strong>
                      <div style={metaStyle}>{event.subsystem} · {new Date(event.observed_at).toLocaleString("en-GB")}</div>
                    </div>
                    <StatusPill value={event.severity} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style>{`
        .os-stage-rail { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 0 0 18px; }
        .os-two-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
        .os-queue-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
        @media (max-width: 820px) {
          .os-stage-rail { grid-template-columns: repeat(3, 1fr); }
          .os-two-column { grid-template-columns: 1fr; }
        }
        @media (max-width: 520px) {
          .os-stage-rail { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}

export default function OperatingSystemPage() {
  return <AppShell><OperatingSystemContent /></AppShell>;
}

const cardStyle: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface, padding: 18 };
const queueCardStyle: React.CSSProperties = { ...cardStyle, display: "flex", flexDirection: "column", minHeight: 210 };
const stageStyle: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, padding: 10, display: "grid", gap: 4 };
const sectionHeadStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 };
const sectionLabel: React.CSSProperties = { color: C.grn, fontFamily: C.mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" };
const cardTitle: React.CSSProperties = { color: C.text, fontFamily: C.serif, fontSize: 22, fontWeight: 400, margin: "6px 0 10px" };
const largeTitle: React.CSSProperties = { ...cardTitle, fontSize: 28, marginBottom: 14 };
const copyStyle: React.CSSProperties = { color: C.muted, fontSize: 11.5, lineHeight: 1.55, margin: 0 };
const metaStyle: React.CSSProperties = { color: C.dim, fontFamily: C.mono, fontSize: 9, lineHeight: 1.45 };
const metricGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 8, marginTop: 12 };
const metricStyle: React.CSSProperties = { border: `1px solid ${C.rule}`, borderRadius: 10, padding: 10, display: "grid", gap: 3 };
const sourceRowStyle: React.CSSProperties = { border: `1px solid ${C.rule}`, borderRadius: 9, padding: "9px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const specRowStyle: React.CSSProperties = { ...sourceRowStyle, color: C.text, textDecoration: "none", fontSize: 11 };
const emptyInner: React.CSSProperties = { color: C.dim, fontSize: 11, padding: 12, border: `1px dashed ${C.border}`, borderRadius: 9 };
const toolbarStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "end", margin: "14px 0 0", flexWrap: "wrap" };
const labelStyle: React.CSSProperties = { display: "grid", gap: 5, color: C.dim, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 8, padding: "8px 10px", fontSize: 11 };
const primaryButton: React.CSSProperties = { border: `1px solid ${C.grn}`, background: C.grn, color: C.bg, borderRadius: 8, padding: "9px 11px", fontSize: 10, fontWeight: 700, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { border: `1px solid ${C.border}`, background: C.surface, color: C.text, borderRadius: 8, padding: "8px 10px", fontSize: 10, cursor: "pointer" };
const linkButton: React.CSSProperties = { color: C.grn, fontSize: 10, textDecoration: "none", display: "inline-block" };
const kindStyle: React.CSSProperties = { color: C.grn, fontFamily: C.mono, fontSize: 8, textTransform: "uppercase", padding: "3px 6px", border: `1px solid ${C.grn}55`, borderRadius: 999 };
const pillStyle: React.CSSProperties = { fontFamily: C.mono, fontSize: 8, textTransform: "uppercase", padding: "4px 7px", border: "1px solid", borderRadius: 999, whiteSpace: "nowrap" };
