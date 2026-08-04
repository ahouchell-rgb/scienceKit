"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { bindingConstraintHypotheses } from "@/lib/crossDomain";
import { parseIntelligenceCsv } from "@/lib/intelligenceImport";
import { sk } from "@/lib/sk";
import { C } from "@/lib/theme";

const REQUIRED = {
  attendance: "source_record_id,pupil_source_system,pupil_source_tenant_key,pupil_source_record_id,date,session,attendance_code,present,minutes_late",
  literacy: "source_record_id,pupil_source_system,pupil_source_tenant_key,pupil_source_record_id,assessed_at,measure,value,scale,assessment_name",
} as const;

function IntelligenceDataContent() {
  const [domain, setDomain] = useState<"attendance" | "literacy">("attendance");
  const [sourceSystem, setSourceSystem] = useState("school_csv");
  const [sourceTenantKey, setSourceTenantKey] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async (id = schoolId) => {
    if (!id) return;
    try {
      const response = await fetch(`/api/intelligence/import?schoolId=${encodeURIComponent(id)}`, {
        headers: { authorization: `Bearer ${sk.auth.getToken()}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't load imports");
      setData(body);
    } catch (reason: any) {
      setError(reason.message || "Couldn't load imports");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const user = sk.auth.user();
        const profile = (
          await sk.q("profiles", {
            params: {
              id: `eq.${user?.id}`,
              select: "school_id",
              limit: "1",
            },
          })
        )?.[0];
        if (profile?.school_id) {
          setSchoolId(profile.school_id);
          await load(profile.school_id);
        }
      } catch {
        setError("Couldn't resolve your school. Trust leaders can provide a school id below.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hypotheses = useMemo(
    () => (data?.state || []).map((state: any) => ({
      state,
      hypotheses: bindingConstraintHypotheses(state),
    })),
    [data],
  );

  const upload = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/intelligence/import", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sk.auth.getToken()}`,
        },
        body: JSON.stringify({ domain, schoolId, sourceSystem, sourceTenantKey, rows }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Import failed");
      setMessage(`${body.accepted} accepted · ${body.unresolved} unresolved identities · ${body.rejected} invalid · ${body.duplicates} already present`);
      await load(schoolId);
    } catch (reason: any) {
      setError(reason.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <a href="/manage" style={backStyle}>← Operations</a>
      <div style={eyebrowStyle}>Cross-domain evidence · Stage 12</div>
      <h1 style={titleStyle}>Bring attendance and literacy into the same evidence graph.</h1>
      <p style={introStyle}>
        Imports resolve through reviewed source identities. Unresolved pupils are quarantined,
        not name-matched. Class views then propose testable binding-constraint hypotheses—not
        behaviour predictions, risk labels or automated sanctions.
      </p>
      {error && <div style={errorStyle}>{error}</div>}
      {message && <div style={successStyle}>{message}</div>}

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Import a governed CSV</h2>
        <div className="data-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <label style={labelStyle}>
            School id
            <input value={schoolId} onChange={(event) => setSchoolId(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Domain
            <select value={domain} onChange={(event) => { setDomain(event.target.value as any); setRows([]); setFileName(""); }} style={inputStyle}>
              <option value="attendance">Attendance sessions</option>
              <option value="literacy">Literacy screens</option>
            </select>
          </label>
          <label style={labelStyle}>
            Source system
            <input value={sourceSystem} onChange={(event) => setSourceSystem(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Source tenant key
            <input value={sourceTenantKey} onChange={(event) => setSourceTenantKey(event.target.value)} style={inputStyle} placeholder="Optional school/source tenant id" />
          </label>
          <label style={labelStyle}>
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              style={inputStyle}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                setRows(parseIntelligenceCsv(await file.text()).rows);
              }}
            />
          </label>
          <div style={{ alignSelf: "end" }}>
            <button style={primaryButton} disabled={!schoolId || !rows.length || busy} onClick={upload}>
              {busy ? "Importing…" : `Import ${rows.length || 0} rows`}
            </button>
          </div>
        </div>
        <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 9, marginTop: 12, overflowWrap: "anywhere" }}>
          Required headers: {REQUIRED[domain]}
          {fileName ? ` · loaded ${fileName}` : ""}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={sectionTitle}>Constraint hypotheses by class</h2>
        {!data?.enabled ? (
          <div style={emptyStyle}>Apply the Stage 12 migration to activate imports and cross-domain views.</div>
        ) : hypotheses.length === 0 ? (
          <div style={emptyStyle}>No canonical class membership is available yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {hypotheses.map(({ state, hypotheses: rowsForClass }) => (
              <article key={state.class_id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong style={{ color: C.text }}>{state.class_name}{state.year_group ? ` · Y${state.year_group}` : ""}</strong>
                  <span style={metaStyle}>{state.pupil_count} canonical pupils</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
                  <Chip label="Learning" value={state.learning_mastery == null ? "no evidence" : `${state.learning_mastery}% · n=${state.learning_evidence}`} />
                  <Chip label="Attendance (28d)" value={state.attendance_rate == null ? "no evidence" : `${state.attendance_rate}% · ${state.attendance_sessions} sessions`} />
                  <Chip label="Literacy" value={state.literacy_value == null ? "no evidence" : `${state.literacy_value} ${state.literacy_measure} · n=${state.literacy_pupils}`} />
                </div>
                <div style={{ display: "grid", gap: 7 }}>
                  {rowsForClass.map((hypothesis) => (
                    <div key={hypothesis.key} style={{ padding: 10, borderRadius: 9, border: `1px solid ${hypothesis.status === "plausible" ? C.amb : C.border}`, background: hypothesis.status === "plausible" ? C.ambS : C.bg }}>
                      <div style={{ color: hypothesis.status === "plausible" ? C.amb : C.muted, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" }}>
                        {hypothesis.status.replaceAll("_", " ")} · {hypothesis.key.replaceAll("_", " ")}
                      </div>
                      <div style={{ color: C.text, fontSize: 12, marginTop: 5 }}>{hypothesis.summary}</div>
                      <div style={{ color: C.dim, fontSize: 10, marginTop: 4 }}>Next check: {hypothesis.nextCheck}</div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {(data?.runs || []).length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={sectionTitle}>Ingest audit</h2>
          <div style={cardStyle}>
            {data.runs.map((run: any, index: number) => (
              <div key={run.id} style={{ padding: "9px 0", borderTop: index ? `1px solid ${C.rule}` : "none", color: C.muted, fontSize: 11 }}>
                <strong style={{ color: C.text }}>{run.domain}</strong> · {run.status} · {run.accepted_rows}/{run.submitted_rows} accepted · {run.unresolved_rows} unresolved · {new Date(run.started_at).toLocaleString("en-GB")}
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`@media(max-width:760px){.data-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: unknown }) {
  return <span style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 999, color: C.dim, fontFamily: C.mono, fontSize: 9 }}>{label}: <strong style={{ color: C.text }}>{String(value)}</strong></span>;
}

export default function IntelligenceDataPage() {
  return <AppShell><IntelligenceDataContent /></AppShell>;
}

const titleStyle = { fontFamily: C.serif, fontWeight: 400, fontSize: 42, lineHeight: 1.04, margin: "8px 0 12px", color: C.text } as const;
const introStyle = { maxWidth: 820, color: C.muted, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" } as const;
const eyebrowStyle = { color: C.grn, fontFamily: C.mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginTop: 16 };
const backStyle = { color: C.dim, fontFamily: C.mono, fontSize: 10, textDecoration: "none" } as const;
const cardStyle = { border: `1px solid ${C.border}`, borderRadius: 13, background: C.surface, padding: 17 } as const;
const sectionTitle = { fontFamily: C.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: C.dim, margin: "0 0 12px" };
const emptyStyle = { border: `1px dashed ${C.border}`, borderRadius: 12, padding: 18, color: C.muted, fontSize: 12, lineHeight: 1.55 } as const;
const errorStyle = { ...emptyStyle, color: C.red, border: `1px solid ${C.red}55`, background: C.redS, marginBottom: 16 } as const;
const successStyle = { ...emptyStyle, color: C.grn, border: `1px solid ${C.grn}55`, background: C.grnS, marginBottom: 16 } as const;
const labelStyle = { display: "grid", gap: 5, color: C.muted, fontSize: 10, fontFamily: C.mono } as const;
const inputStyle = { minHeight: 36, padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg, color: C.text, fontSize: 11 } as const;
const primaryButton = { padding: "9px 13px", border: 0, borderRadius: 8, background: C.grn, color: "#fff", fontSize: 11, cursor: "pointer" } as const;
const metaStyle = { color: C.dim, fontFamily: C.mono, fontSize: 9 } as const;
