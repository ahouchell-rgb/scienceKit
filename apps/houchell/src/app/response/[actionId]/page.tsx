"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { sk } from "@/lib/sk";
import { C } from "@/lib/theme";

interface LoopData {
  enabled: boolean;
  reason?: string;
  action?: any;
  contexts?: any[];
  artifacts?: any[];
  deliveries?: any[];
  rechecks?: any[];
  outcomes?: any[];
  feedback?: any[];
}

const toLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

function ResponseLoopContent() {
  const params = useParams<{ actionId: string }>();
  const actionId = params.actionId;
  const [data, setData] = useState<LoopData | null>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [unitId, setUnitId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(() => toLocalInput(new Date()));
  const [recheckDue, setRecheckDue] = useState(() =>
    toLocalInput(new Date(Date.now() + 7 * 86400000)),
  );
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [rating, setRating] = useState("4");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [timeSaved, setTimeSaved] = useState("");

  const load = async () => {
    setError("");
    try {
      const response = await fetch(
        `/api/intelligence/response?actionId=${encodeURIComponent(actionId)}`,
        {
          headers: { authorization: `Bearer ${sk.auth.getToken()}` },
          cache: "no-store",
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't load response");
      setData(body);
    } catch (reason: any) {
      setError(reason.message || "Couldn't load response");
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const [unitRows, lessonRows] = await Promise.all([
          sk.q("units", {
            params: {
              select: "id,title,year_group,discipline",
              order: "year_group.asc,sort_order.asc",
            },
          }),
          sk.q("lessons", {
            params: {
              select: "id,unit_id,title,lesson_number",
              order: "lesson_number.asc",
            },
          }),
        ]);
        setUnits(unitRows || []);
        setLessons(lessonRows || []);
      } catch {
        // The loop can still show existing artifacts when curriculum is unavailable.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId]);

  const selectedLessons = useMemo(
    () => lessons.filter((lesson) => lesson.unit_id === unitId),
    [lessonId, lessons, unitId],
  );

  const operate = async (operation: string, payload: Record<string, unknown>) => {
    setBusy(operation);
    setError("");
    try {
      const response = await fetch("/api/intelligence/response", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sk.auth.getToken()}`,
        },
        body: JSON.stringify({ operation, actionId, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Operation failed");
      await load();
      return body;
    } catch (reason: any) {
      setError(reason.message || "Operation failed");
      return null;
    } finally {
      setBusy("");
    }
  };

  if (!data && !error) {
    return (
      <div style={{ padding: 40, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
        Loading the response loop…
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div style={{ padding: "30px 0", maxWidth: 720 }}>
        <a href="/inbox" style={backStyle}>
          ← Action inbox
        </a>
        <h1 style={titleStyle}>Response loop</h1>
        <div style={emptyStyle}>
          <strong style={{ color: C.amb, display: "block", marginBottom: 7 }}>
            Stage 5 migration is gated
          </strong>
          Artifact lineage, delivery, recheck and outcome tables are implemented but are not
          exposed in this environment until the database branch/RLS gate is passed.
        </div>
      </div>
    );
  }

  const action = data.action;
  const finding = action.finding;
  const artifacts = data.artifacts || [];
  const contexts = data.contexts || [];
  const deliveries = data.deliveries || [];
  const rechecks = data.rechecks || [];
  const recordedOutcomes = data.outcomes || [];
  const feedback = data.feedback || [];
  const latestArtifact = artifacts[0];
  const canGenerate = action.status === "accepted" || action.status === "in_progress";

  return (
    <div>
      <a href="/inbox" style={backStyle}>
        ← Action inbox
      </a>
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 20,
          alignItems: "end",
          padding: "27px 0",
          borderBottom: `1px solid ${C.rule}`,
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              color: C.grn,
              fontFamily: C.mono,
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 9,
            }}
          >
            Finding → teaching → recheck → outcome
          </div>
          <h1 style={{ ...titleStyle, margin: "0 0 9px" }}>{action.title}</h1>
          <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.55, margin: 0 }}>
            Evidence: {finding.headline}
          </p>
        </div>
        <span
          style={{
            padding: "5px 9px",
            borderRadius: 999,
            color: action.status === "completed" ? C.grn : C.blu,
            background: action.status === "completed" ? C.grnS : C.bluS,
            fontFamily: C.mono,
            fontSize: 10,
            textTransform: "uppercase",
          }}
        >
          {action.status.replace("_", " ")}
        </span>
      </header>

      {error && (
        <div
          style={{
            padding: 12,
            color: C.red,
            background: C.redS,
            border: `1px solid ${C.red}55`,
            borderRadius: 10,
            marginBottom: 16,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {action.status === "proposed" && (
        <div style={{ ...emptyStyle, marginBottom: 24 }}>
          The action is still proposed. Return to the inbox and accept it before generating or
          delivering a response.
        </div>
      )}

      <section style={sectionStyle}>
        <div style={stepStyle}>1</div>
        <div style={{ flex: 1 }}>
          <h2 style={headingStyle}>Build the evidence-targeted lesson</h2>
          <p style={copyStyle}>
            The generator receives the reviewed finding, frozen baseline and teacher judgement.
            It must include a diagnostic hinge and a parallel delayed recheck.
          </p>
          {contexts[0] && (
            <div style={{ ...emptyStyle, marginBottom: 12 }}>
              Latest frozen context: {contexts[0].generation_spec?.objective || finding.objective_key}
              {" · "}evidence as of {new Date(contexts[0].evidence_as_of).toLocaleString("en-GB")}
              {" · "}spec v{contexts[0].generation_spec?.schemaVersion || "—"}
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) auto",
              gap: 10,
              alignItems: "end",
            }}
            className="response-form-grid"
          >
            <label style={labelStyle}>
              Curriculum unit
              <select
                value={unitId}
                onChange={(event) => {
                  setUnitId(event.target.value);
                  setLessonId("");
                }}
                style={inputStyle}
              >
                <option value="">Choose a unit…</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.year_group ? `Y${unit.year_group} · ` : ""}
                    {unit.title}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Lesson context (optional)
              <select
                value={lessonId}
                onChange={(event) => setLessonId(event.target.value)}
                style={inputStyle}
                disabled={!unitId}
              >
                <option value="">Whole unit / new reteach</option>
                {selectedLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.lesson_number ? `L${lesson.lesson_number} · ` : ""}
                    {lesson.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!canGenerate || !unitId || busy === "generate"}
              onClick={() =>
                operate("generate", {
                  unitId,
                  lessonId: lessonId || null,
                  objectiveLabel: finding.objective_key,
                })
              }
              style={primaryButton}
            >
              {busy === "generate" ? "Generating…" : "Generate lesson deck"}
            </button>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={stepStyle}>2</div>
        <div style={{ flex: 1 }}>
          <h2 style={headingStyle}>Review the exact artifact</h2>
          {artifacts.length === 0 ? (
            <p style={copyStyle}>No response artifact has been linked yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 11,
                    background: C.surface,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
                      {artifact.deck_snapshot?.title || "Linked lesson deck"}
                    </div>
                    <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 9, marginTop: 5 }}>
                      Version {artifact.artifact_version} · {artifact.deck_snapshot?.slideCount || "—"} slides · {artifact.status}
                    </div>
                  </div>
                  {artifact.deck_id && (
                    <a href={`/slides?deck=${artifact.deck_id}`} style={secondaryButton}>
                      Review / edit deck
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={stepStyle}>3</div>
        <div style={{ flex: 1 }}>
          <h2 style={headingStyle}>Record delivery and pre-specify the recheck</h2>
          <p style={copyStyle}>
            Delivery freezes the actual deck version and schedules the check before the result is
            known.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              gap: 10,
              alignItems: "end",
            }}
            className="response-form-grid"
          >
            <label style={labelStyle}>
              Delivered at
              <input
                type="datetime-local"
                value={deliveredAt}
                onChange={(event) => setDeliveredAt(event.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Recheck due
              <input
                type="datetime-local"
                value={recheckDue}
                onChange={(event) => setRecheckDue(event.target.value)}
                style={inputStyle}
              />
            </label>
            <button
              disabled={!latestArtifact || !canGenerate || busy === "deliver"}
              onClick={() =>
                operate("deliver", {
                  artifactId: latestArtifact?.id,
                  deliveredAt: new Date(deliveredAt).toISOString(),
                  recheckDueAt: new Date(recheckDue).toISOString(),
                })
              }
              style={primaryButton}
            >
              {busy === "deliver" ? "Recording…" : "Mark delivered + schedule"}
            </button>
          </div>
          {deliveries.length > 0 && (
            <div style={{ color: C.grn, fontFamily: C.mono, fontSize: 10, marginTop: 12 }}>
              {deliveries.length} delivery {deliveries.length === 1 ? "record" : "records"} · latest{" "}
              {new Date(deliveries[0].delivered_at).toLocaleString("en-GB")}
            </div>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={stepStyle}>3a</div>
        <div style={{ flex: 1 }}>
          <h2 style={headingStyle}>Record teacher judgement</h2>
          <p style={copyStyle}>
            Generation, acceptance, edits and impact are different measures. Record whether the
            artifact was useful before delivery; this never substitutes for the recheck.
          </p>
          <div className="response-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.6fr auto", gap: 8, alignItems: "end" }}>
            <label style={labelStyle}>
              Rating
              <select value={rating} onChange={(event) => setRating(event.target.value)} style={inputStyle}>
                {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Minutes saved
              <input type="number" min={0} max={600} value={timeSaved} onChange={(event) => setTimeSaved(event.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              What did you change / keep?
              <input value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} style={inputStyle} placeholder="Optional review note" />
            </label>
            <button
              disabled={!latestArtifact || busy === "feedback"}
              onClick={() => operate("feedback", {
                artifactId: latestArtifact?.id,
                feedbackType: feedbackNote.trim() ? "edited" : "rating",
                rating,
                timeSavedMinutes: timeSaved || null,
                reason: feedbackNote,
              })}
              style={primaryButton}
            >
              Record feedback
            </button>
          </div>
          {feedback.length > 0 && (
            <div style={{ color: C.grn, fontFamily: C.mono, fontSize: 10, marginTop: 10 }}>
              {feedback.length} teacher feedback {feedback.length === 1 ? "record" : "records"} · latest {feedback[0].rating ? `${feedback[0].rating}/5` : feedback[0].feedback_type}
            </div>
          )}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={stepStyle}>4</div>
        <div style={{ flex: 1 }}>
          <h2 style={headingStyle}>Complete the recheck</h2>
          {rechecks.length === 0 ? (
            <p style={copyStyle}>A recheck is scheduled automatically when delivery is recorded.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rechecks.map((recheck) => (
                <div
                  key={recheck.id}
                  style={{
                    padding: 14,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    background: C.surface,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 11,
                    }}
                  >
                    <div>
                      <strong style={{ color: C.text, fontSize: 13 }}>
                        {recheck.method} recheck
                      </strong>
                      <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 9, marginTop: 4 }}>
                        Due {new Date(recheck.due_at).toLocaleString("en-GB")} · baseline{" "}
                        {recheck.baseline_snapshot?.masteryPct}%
                      </div>
                    </div>
                    <span style={{ color: recheck.status === "completed" ? C.grn : C.amb, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" }}>
                      {recheck.status}
                    </span>
                  </div>
                  {recheck.status === "scheduled" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr auto",
                        gap: 8,
                        alignItems: "end",
                      }}
                      className="response-form-grid"
                    >
                      <label style={labelStyle}>
                        Recheck mastery %
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={outcomes[recheck.id] || ""}
                          onChange={(event) =>
                            setOutcomes((current) => ({
                              ...current,
                              [recheck.id]: event.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelStyle}>
                        Pupils / sample
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={samples[recheck.id] || ""}
                          onChange={(event) =>
                            setSamples((current) => ({
                              ...current,
                              [recheck.id]: event.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </label>
                      <button
                        disabled={!outcomes[recheck.id] || busy === "complete_recheck"}
                        onClick={() =>
                          operate("complete_recheck", {
                            recheckId: recheck.id,
                            outcomeMastery: outcomes[recheck.id],
                            sampleSize: samples[recheck.id],
                          })
                        }
                        style={primaryButton}
                      >
                        Record descriptive outcome
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ ...sectionStyle, borderBottom: "none" }}>
        <div style={stepStyle}>5</div>
        <div style={{ flex: 1 }}>
          <h2 style={headingStyle}>Outcome ledger</h2>
          {recordedOutcomes.length === 0 ? (
            <p style={copyStyle}>No valid completed outcome yet.</p>
          ) : (
            recordedOutcomes.map((outcome) => (
              <div
                key={outcome.id}
                style={{
                  padding: 16,
                  border: `1px solid ${C.grn}55`,
                  borderRadius: 12,
                  background: C.grnS,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: C.text, fontFamily: C.serif, fontSize: 30 }}>
                    {Number(outcome.delta) > 0 ? "+" : ""}
                    {Number(outcome.delta).toFixed(1)} pp
                  </span>
                  <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 10 }}>
                    {outcome.baseline_value}% → {outcome.outcome_value}% · n=
                    {outcome.sample_size ?? "not recorded"}
                  </span>
                </div>
                <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.55, margin: 0 }}>
                  {outcome.interpretation}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <style>{`
        @media (max-width: 760px) {
          .response-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  color: C.text,
  fontFamily: C.serif,
  fontSize: "clamp(34px, 5vw, 50px)",
  fontWeight: 400,
  lineHeight: 1,
  letterSpacing: "-0.03em",
};
const backStyle: React.CSSProperties = {
  color: C.dim,
  fontFamily: C.mono,
  fontSize: 10,
  textTransform: "uppercase",
  textDecoration: "none",
  letterSpacing: "0.12em",
};
const sectionStyle: React.CSSProperties = {
  display: "flex",
  gap: 17,
  padding: "24px 0",
  borderBottom: `1px solid ${C.rule}`,
};
const stepStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  color: C.accentFg,
  background: C.accent,
  borderRadius: "50%",
  fontFamily: C.mono,
  fontSize: 11,
  fontWeight: 700,
};
const headingStyle: React.CSSProperties = {
  color: C.text,
  fontSize: 18,
  margin: "2px 0 7px",
};
const copyStyle: React.CSSProperties = {
  color: C.muted,
  fontSize: 12,
  lineHeight: 1.55,
  margin: "0 0 14px",
};
const labelStyle: React.CSSProperties = {
  color: C.muted,
  fontSize: 10,
};
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  padding: "9px 10px",
  color: C.text,
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 9,
  fontFamily: C.sans,
  fontSize: 12,
};
const primaryButton: React.CSSProperties = {
  padding: "9px 13px",
  color: C.accentFg,
  background: C.accent,
  border: "none",
  borderRadius: 999,
  fontFamily: C.mono,
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const secondaryButton: React.CSSProperties = {
  padding: "8px 11px",
  color: C.muted,
  border: `1px solid ${C.border}`,
  borderRadius: 999,
  fontFamily: C.mono,
  fontSize: 10,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
const emptyStyle: React.CSSProperties = {
  padding: 17,
  color: C.dim,
  background: C.surface,
  border: `1px dashed ${C.borderStrong}`,
  borderRadius: 12,
  fontSize: 12,
  lineHeight: 1.55,
};

export default function ResponseLoopPage() {
  return (
    <AppShell>
      <ResponseLoopContent />
    </AppShell>
  );
}
