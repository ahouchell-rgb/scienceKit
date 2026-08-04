"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { sk } from "@/lib/sk";
import { C } from "@/lib/theme";

function IdentityManager() {
  const [data, setData] = useState<any>(null);
  const [schoolId, setSchoolId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async (requestedSchoolId = schoolId) => {
    setError("");
    try {
      const suffix = requestedSchoolId ? `?schoolId=${encodeURIComponent(requestedSchoolId)}` : "";
      const response = await fetch(`/api/intelligence/identity${suffix}`, {
        headers: { authorization: `Bearer ${sk.auth.getToken()}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't load identities");
      setData(body);
      if (body.schoolId) setSchoolId(body.schoolId);
    } catch (reason: any) {
      setError(reason.message || "Couldn't load identities");
    }
  };

  useEffect(() => {
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const operate = async (operation: string, payload: Record<string, unknown> = {}) => {
    setBusy(`${operation}:${payload.reviewId || ""}`);
    setError("");
    try {
      const response = await fetch("/api/intelligence/identity", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sk.auth.getToken()}`,
        },
        body: JSON.stringify({ operation, schoolId, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Identity operation failed");
      await load(schoolId);
    } catch (reason: any) {
      setError(reason.message || "Identity operation failed");
    } finally {
      setBusy("");
    }
  };

  const open = useMemo(
    () => (data?.queue || []).filter((row: any) => row.status === "open"),
    [data],
  );
  const resolved = useMemo(
    () => (data?.queue || []).filter((row: any) => row.status !== "open"),
    [data],
  );

  if (!data && !error) {
    return <div style={emptyStyle}>Loading identity spine…</div>;
  }

  return (
    <div>
      <a href="/manage" style={backStyle}>← Operations</a>
      <div style={eyebrowStyle}>Canonical identity · Stage 8</div>
      <h1 style={titleStyle}>One pupil, every source, no silent merges.</h1>
      <p style={introStyle}>
        Retrieval profiles are staged for a human decision. A name is supporting context,
        never an identifier. Linking or creating a pupil preserves the source record and class
        membership provenance.
      </p>

      {error && <div style={errorStyle}>{error}</div>}

      {data?.reason === "migration_pending" ? (
        <div style={emptyStyle}>The identity workflow is built; apply the Stage 2 and 8 migrations on a database branch to activate it.</div>
      ) : data?.reason === "leadership_only" ? (
        <div style={emptyStyle}>Identity reconciliation is limited to HoD, SLT and trust leadership.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", marginBottom: 24 }}>
            {(data?.schools || []).length > 1 && (
              <label style={labelStyle}>
                School
                <select
                  style={inputStyle}
                  value={schoolId}
                  onChange={(event) => {
                    setSchoolId(event.target.value);
                    load(event.target.value);
                  }}
                >
                  <option value="">Choose a school…</option>
                  {data.schools.map((school: any) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
              </label>
            )}
            <button
              style={primaryButton}
              disabled={!schoolId || busy.startsWith("seed_retrieval")}
              onClick={() => operate("seed_retrieval")}
            >
              {busy.startsWith("seed_retrieval") ? "Scanning…" : "Scan retrieval pupils"}
            </button>
            <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 10 }}>
              {open.length} open · {data?.pupils?.length || 0} canonical · {data?.identities?.length || 0} links
            </span>
          </div>

          <section>
            <h2 style={sectionTitle}>Open review queue</h2>
            {!schoolId ? (
              <div style={emptyStyle}>Choose a school to load its queue.</div>
            ) : open.length === 0 ? (
              <div style={emptyStyle}>No unresolved source identities. Run the retrieval scan after new classes or MIS imports.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {open.map((row: any) => (
                  <article key={row.id} style={cardStyle}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 14 }}>
                      <div>
                        <strong style={{ color: C.text, fontSize: 15 }}>{row.source_display_name || "Unnamed source row"}</strong>
                        <div style={metaStyle}>
                          {row.source_system.replaceAll("_", " ")} · {row.source_snapshot?.classNames?.join(", ") || "no class context"}
                          {row.source_snapshot?.yearGroup ? ` · Year ${row.source_snapshot.yearGroup}` : ""}
                        </div>
                        <div style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
                          Reason: {(row.reason_codes || []).join(", ").replaceAll("_", " ")}
                        </div>
                      </div>
                      <code style={{ color: C.dim, fontSize: 9 }}>{row.source_record_id.slice(0, 8)}…</code>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(210px, 1fr) minmax(210px, 1fr)", gap: 10, marginTop: 14 }}>
                      <label style={labelStyle}>
                        Link to an existing canonical pupil
                        <select
                          style={inputStyle}
                          value={choices[row.id] || ""}
                          onChange={(event) => setChoices((current) => ({ ...current, [row.id]: event.target.value }))}
                        >
                          <option value="">Choose pupil…</option>
                          {(data?.pupils || []).map((pupil: any) => (
                            <option key={pupil.id} value={pupil.id}>
                              {pupil.display_name}{pupil.year_group != null ? ` · Y${pupil.year_group}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={labelStyle}>
                        Decision note
                        <input
                          style={inputStyle}
                          value={notes[row.id] || ""}
                          onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                          placeholder="Identifier checked / reason for decision"
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        style={primaryButton}
                        disabled={!choices[row.id] || busy.endsWith(row.id)}
                        onClick={() => operate("link", { reviewId: row.id, pupilId: choices[row.id], note: notes[row.id] })}
                      >
                        Link reviewed identity
                      </button>
                      <button
                        style={secondaryButton}
                        disabled={busy.endsWith(row.id)}
                        onClick={() => operate("create", { reviewId: row.id, note: notes[row.id] })}
                      >
                        Create new canonical pupil
                      </button>
                      <button
                        style={{ ...secondaryButton, color: C.red }}
                        disabled={(notes[row.id] || "").trim().length < 3 || busy.endsWith(row.id)}
                        onClick={() => operate("dismiss", { reviewId: row.id, note: notes[row.id] })}
                      >
                        Dismiss with reason
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {resolved.length > 0 && (
            <section style={{ marginTop: 30 }}>
              <h2 style={sectionTitle}>Recent decisions</h2>
              <div style={cardStyle}>
                {resolved.slice(0, 20).map((row: any, index: number) => (
                  <div key={row.id} style={{ padding: "10px 0", borderTop: index ? `1px solid ${C.rule}` : "none" }}>
                    <strong style={{ color: C.text, fontSize: 12 }}>{row.source_display_name || row.source_record_id}</strong>
                    <span style={metaStyle}> · {row.status} · {row.resolution_note || "No note"}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function IdentityPage() {
  return <AppShell><IdentityManager /></AppShell>;
}

const titleStyle = { fontFamily: C.serif, fontWeight: 400, fontSize: 42, lineHeight: 1.04, margin: "8px 0 12px", color: C.text } as const;
const introStyle = { maxWidth: 760, color: C.muted, fontSize: 14, lineHeight: 1.6, margin: "0 0 26px" } as const;
const eyebrowStyle = { color: C.grn, fontFamily: C.mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginTop: 16 };
const backStyle = { color: C.dim, fontFamily: C.mono, fontSize: 10, textDecoration: "none" } as const;
const sectionTitle = { fontFamily: C.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: C.dim, margin: "0 0 12px" };
const cardStyle = { border: `1px solid ${C.border}`, borderRadius: 13, background: C.surface, padding: 16 } as const;
const emptyStyle = { border: `1px dashed ${C.border}`, borderRadius: 12, padding: 18, color: C.muted, fontSize: 12, lineHeight: 1.55 } as const;
const errorStyle = { ...emptyStyle, color: C.red, border: `1px solid ${C.red}55`, background: C.redS, marginBottom: 16 } as const;
const labelStyle = { display: "grid", gap: 5, color: C.muted, fontSize: 10, fontFamily: C.mono } as const;
const inputStyle = { minHeight: 36, padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, fontSize: 12 } as const;
const primaryButton = { padding: "8px 12px", border: 0, borderRadius: 8, background: C.grn, color: "#fff", fontSize: 11, cursor: "pointer" } as const;
const secondaryButton = { ...primaryButton, background: C.surface, color: C.text, border: `1px solid ${C.border}` } as const;
const metaStyle = { color: C.dim, fontFamily: C.mono, fontSize: 9, marginTop: 5 } as const;
