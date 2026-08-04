"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { sk } from "@/lib/sk";
import { C } from "@/lib/theme";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function GraphWorkbench() {
  const searchParams = useSearchParams();
  const requestedObjective = searchParams.get("objective") || "";
  const [data, setData] = useState<any>(null);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [linkType, setLinkType] = useState("prerequisite_of");
  const [strength, setStrength] = useState("supporting");
  const [rationale, setRationale] = useState("");

  const load = async (selection: { schoolId?: string; subjectId?: string; objectiveId?: string } = {}) => {
    setError("");
    const params = new URLSearchParams();
    const schoolId = selection.schoolId ?? data?.selectedSchoolId;
    const subjectId = selection.subjectId ?? data?.selectedSubjectId;
    const objectiveId = selection.objectiveId ?? selectedObjectiveId ?? requestedObjective;
    if (schoolId) params.set("schoolId", schoolId);
    if (subjectId) params.set("subjectId", subjectId);
    if (objectiveId && UUID.test(objectiveId)) params.set("objectiveId", objectiveId);
    try {
      const response = await fetch(`/api/intelligence/curriculum-graph?${params}`, {
        headers: { authorization: `Bearer ${sk.auth.getToken()}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't load the curriculum graph");
      setData(body);
      const nextObjective =
        objectiveId && body.objectives?.some((row: any) => row.id === objectiveId)
          ? objectiveId
          : body.selectedObjectiveId || body.objectives?.[0]?.id || "";
      setSelectedObjectiveId(nextObjective);
      setFromId((current) => current || nextObjective);
    } catch (reason: any) {
      setError(reason.message || "Couldn't load the curriculum graph");
    }
  };

  useEffect(() => {
    load({ objectiveId: requestedObjective });
    // The first request resolves the user's available subjects and school scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedObjective]);

  const mutate = async (payload: Record<string, unknown>, label: string) => {
    setBusy(label);
    setError("");
    try {
      const response = await fetch("/api/intelligence/curriculum-graph", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sk.auth.getToken()}`,
        },
        body: JSON.stringify({
          schoolId: data?.selectedSchoolId,
          subjectId: data?.selectedSubjectId,
          ...payload,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Curriculum graph operation failed");
      await load();
      return true;
    } catch (reason: any) {
      setError(reason.message || "Curriculum graph operation failed");
      return false;
    } finally {
      setBusy("");
    }
  };

  const objectives = data?.objectives || [];
  const objectiveById = useMemo(
    () => new Map(objectives.map((row: any) => [row.id, row])),
    [objectives],
  );
  const selected: any = objectiveById.get(selectedObjectiveId);
  const approvedLinks = (data?.links || []).filter((row: any) => row.status === "approved");
  const incoming = approvedLinks.filter(
    (row: any) =>
      row.link_type === "prerequisite_of" && row.to_objective_id === selectedObjectiveId,
  );
  const outgoing = approvedLinks.filter(
    (row: any) =>
      row.link_type === "prerequisite_of" && row.from_objective_id === selectedObjectiveId,
  );
  const otherLinks = approvedLinks.filter(
    (row: any) =>
      row.link_type !== "prerequisite_of" &&
      (row.from_objective_id === selectedObjectiveId ||
        row.to_objective_id === selectedObjectiveId),
  );
  const effectiveProfile =
    (data?.profiles || []).find(
      (row: any) =>
        row.objective_id === selectedObjectiveId &&
        row.school_id === data?.selectedSchoolId &&
        row.status === "approved",
    ) ||
    (data?.profiles || []).find(
      (row: any) =>
        row.objective_id === selectedObjectiveId &&
        row.school_id == null &&
        row.status === "approved",
    );
  const misconceptionById = useMemo(
    () => new Map((data?.misconceptions || []).map((row: any) => [row.id, row])),
    [data?.misconceptions],
  );
  const vocabularyById = useMemo(
    () => new Map((data?.vocabulary || []).map((row: any) => [row.id, row])),
    [data?.vocabulary],
  );
  const misconceptionMaps = (data?.objectiveMisconceptions || []).filter(
    (row: any) => row.objective_id === selectedObjectiveId && row.status === "approved",
  );
  const vocabularyMaps = (data?.objectiveVocabulary || []).filter(
    (row: any) => row.objective_id === selectedObjectiveId && row.status === "approved",
  );
  const filteredObjectives = objectives.filter((row: any) =>
    `${row.code || ""} ${row.title}`.toLowerCase().includes(query.toLowerCase()),
  );

  const reviewItems = useMemo(() => {
    if (!data || !selectedObjectiveId) return [];
    const items: any[] = [];
    const reviewable = (row: any) =>
      (row.school_id || null) === (data.selectedSchoolId || null);
    for (const row of data.profiles || []) {
      if (
        reviewable(row) &&
        row.status === "proposed" &&
        row.objective_id === selectedObjectiveId
      ) {
        items.push({
          entityKind: "objective_profile",
          id: row.id,
          title: "Objective profile",
          detail: row.statement || "No statement",
          source: row.source_kind,
        });
      }
    }
    for (const row of data.links || []) {
      if (
        reviewable(row) &&
        row.status === "proposed" &&
        (row.from_objective_id === selectedObjectiveId ||
          row.to_objective_id === selectedObjectiveId)
      ) {
        const from: any = objectiveById.get(row.from_objective_id);
        const to: any = objectiveById.get(row.to_objective_id);
        items.push({
          entityKind: "objective_link",
          id: row.id,
          title: row.link_type.replaceAll("_", " "),
          detail: `${from?.title || "Unknown"} → ${to?.title || "Unknown"}`,
          source: row.source_kind,
        });
      }
    }
    for (const row of data.objectiveMisconceptions || []) {
      if (
        !reviewable(row) ||
        row.status !== "proposed" ||
        row.objective_id !== selectedObjectiveId
      ) continue;
      const concept: any = misconceptionById.get(row.misconception_id);
      items.push({
        entityKind: "objective_misconception",
        id: row.id,
        title: "Misconception mapping",
        detail: concept?.title || "Mapped misconception",
        source: row.source_kind,
      });
      if (concept?.status === "proposed" && reviewable(concept)) {
        items.push({
          entityKind: "misconception",
          id: concept.id,
          title: "Misconception definition",
          detail: concept.title,
          source: concept.source_kind,
        });
      }
    }
    for (const row of data.objectiveVocabulary || []) {
      if (
        !reviewable(row) ||
        row.status !== "proposed" ||
        row.objective_id !== selectedObjectiveId
      ) continue;
      const term: any = vocabularyById.get(row.vocabulary_id);
      items.push({
        entityKind: "objective_vocabulary",
        id: row.id,
        title: "Vocabulary mapping",
        detail: term?.term || "Mapped vocabulary",
        source: row.source_kind,
      });
      if (term?.status === "proposed" && reviewable(term)) {
        items.push({
          entityKind: "vocabulary",
          id: term.id,
          title: "Vocabulary definition",
          detail: term.term,
          source: term.source_kind,
        });
      }
    }
    return items.filter(
      (item, index, all) =>
        all.findIndex(
          (other) => other.entityKind === item.entityKind && other.id === item.id,
        ) === index,
    );
  }, [
    data,
    misconceptionById,
    objectiveById,
    selectedObjectiveId,
    vocabularyById,
  ]);

  const createLink = async () => {
    if (!fromId || !toId) return setError("Choose both objectives");
    const created = await mutate(
      {
        operation: "create_link",
        fromObjectiveId: fromId,
        toObjectiveId: toId,
        linkType,
        strength,
        rationale,
      },
      "create-link",
    );
    if (created) setRationale("");
  };

  if (!data && !error) return <div style={empty}>Loading the curriculum brain…</div>;

  return (
    <div>
      <a href="/curriculum" style={back}>← Curriculum</a>
      <div style={eyebrow}>Curriculum knowledge graph · Stage 13</div>
      <h1 style={title}>Make progression <em style={{ color: C.grn }}>computable.</em></h1>
      <p style={intro}>
        Objectives are the canonical nodes. Reviewed relationships, misconceptions,
        vocabulary and resource coverage become the shared curriculum brain used by
        intelligence and lesson generation. Suggestions remain quarantined until review.
      </p>

      {error && <div style={errorStyle}>{error}</div>}
      {!data?.enabled ? (
        <div style={empty}>
          The Stage 13 workbench is built, but its database migration has not been applied
          in this environment. The existing curriculum remains unchanged.
        </div>
      ) : (
        <>
          <div style={guardrails}>
            <span>✓ approved assertions only in generation</span>
            <span>✓ global canon + school variants</span>
            <span>✓ cycle-safe prerequisites</span>
            <span>✓ append-only review history</span>
          </div>

          <div className="graph-toolbar">
            <label style={label}>
              School scope
              <select
                style={select}
                value={data.selectedSchoolId || ""}
                onChange={(event) =>
                  load({ schoolId: event.target.value, subjectId: data.selectedSubjectId })
                }
              >
                {(data.schools || []).map((school: any) => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </label>
            <label style={label}>
              Subject
              <select
                style={select}
                value={data.selectedSubjectId || ""}
                onChange={(event) =>
                  load({ subjectId: event.target.value, schoolId: data.selectedSchoolId })
                }
              >
                {(data.subjects || []).map((subject: any) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>
            {data.permissions?.canManage && (
              <button
                style={primaryButton}
                disabled={Boolean(busy)}
                onClick={() => mutate({ operation: "seed" }, "seed")}
              >
                {busy === "seed" ? "Building proposals…" : "Seed review graph"}
              </button>
            )}
          </div>

          <section className="coverage-grid">
            <Metric label="Objectives" value={data.coverage?.objectives ?? 0} />
            <Metric label="Profile coverage" value={`${data.coverage?.profileCoveragePct ?? 0}%`} />
            <Metric label="Approved links" value={data.coverage?.approvedLinks ?? 0} />
            <Metric label="Review queue" value={data.coverage?.proposedAssertions ?? 0} warn />
          </section>

          <div className="workbench-grid">
            <aside style={panel}>
              <div style={panelHead}>Objective index</div>
              <input
                style={input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search code or objective…"
              />
              <div style={{ maxHeight: 650, overflowY: "auto" }}>
                {filteredObjectives.map((row: any) => (
                  <button
                    key={row.id}
                    onClick={() => {
                      setSelectedObjectiveId(row.id);
                      setFromId(row.id);
                    }}
                    style={{
                      ...objectiveButton,
                      borderColor: row.id === selectedObjectiveId ? C.grn : "transparent",
                      background: row.id === selectedObjectiveId ? C.grnS : "transparent",
                    }}
                  >
                    <span style={{ color: C.grn, fontFamily: C.mono, fontSize: 9 }}>
                      {row.code || "OBJECTIVE"}
                    </span>
                    <span>{row.title}</span>
                  </button>
                ))}
              </div>
            </aside>

            <main style={{ minWidth: 0 }}>
              {selected ? (
                <>
                  <div style={{ ...panel, marginBottom: 14 }}>
                    <div style={eyebrow}>{selected.code || "Objective"}</div>
                    <h2 style={{ margin: "7px 0 8px", color: C.text, fontSize: 24 }}>
                      {selected.title}
                    </h2>
                    <p style={{ ...intro, marginBottom: 0, fontSize: 12 }}>
                      {effectiveProfile?.statement ||
                        "No approved school or shared objective profile yet."}
                    </p>
                  </div>

                  <div className="progression-grid">
                    <GraphColumn
                      label="Prerequisites"
                      emptyLabel="No approved prerequisites"
                      rows={incoming.map((edge: any) => ({
                        edge,
                        objective: objectiveById.get(edge.from_objective_id),
                      }))}
                      onSelect={setSelectedObjectiveId}
                    />
                    <div style={{ ...panel, borderColor: `${C.grn}66`, background: C.grnS }}>
                      <div style={{ ...panelHead, color: C.grn }}>Current objective</div>
                      <strong style={{ color: C.text }}>{selected.title}</strong>
                      <div style={{ color: C.dim, fontSize: 10, marginTop: 8 }}>
                        {incoming.length} prerequisites · {outgoing.length} next objectives
                      </div>
                    </div>
                    <GraphColumn
                      label="Unlocks next"
                      emptyLabel="No approved next objectives"
                      rows={outgoing.map((edge: any) => ({
                        edge,
                        objective: objectiveById.get(edge.to_objective_id),
                      }))}
                      onSelect={setSelectedObjectiveId}
                    />
                  </div>

                  {otherLinks.length > 0 && (
                    <div style={{ ...panel, marginTop: 14 }}>
                      <div style={panelHead}>Other reviewed relationships</div>
                      <div style={chipRow}>
                        {otherLinks.map((edge: any) => {
                          const other =
                            edge.from_objective_id === selectedObjectiveId
                              ? objectiveById.get(edge.to_objective_id)
                              : objectiveById.get(edge.from_objective_id);
                          return (
                            <span key={edge.id} style={chip}>
                              {edge.link_type.replaceAll("_", " ")} · {(other as any)?.title}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="detail-grid">
                    <DetailCard
                      title="Reviewed misconceptions"
                      rows={misconceptionMaps
                        .map((mapping: any) => misconceptionById.get(mapping.misconception_id))
                        .filter((row: any) => row?.status === "approved")
                        .map((row: any) => ({
                          title: row.title,
                          detail: row.description,
                        }))}
                    />
                    <DetailCard
                      title="Reviewed vocabulary"
                      rows={vocabularyMaps
                        .map((mapping: any) => {
                          const row: any = vocabularyById.get(mapping.vocabulary_id);
                          return row?.status === "approved"
                            ? { title: row.term, detail: row.definition }
                            : null;
                        })
                        .filter(Boolean)}
                    />
                  </div>

                  {data.permissions?.canManage && (
                    <>
                      <section style={{ ...panel, marginTop: 14 }}>
                        <div style={panelHead}>Propose a typed relationship</div>
                        <div className="link-form">
                          <select style={select} value={fromId} onChange={(event) => setFromId(event.target.value)}>
                            {objectives.map((row: any) => <option key={row.id} value={row.id}>From · {row.code || row.title}</option>)}
                          </select>
                          <select style={select} value={linkType} onChange={(event) => setLinkType(event.target.value)}>
                            <option value="prerequisite_of">prerequisite of →</option>
                            <option value="supports">supports →</option>
                            <option value="extends">extends →</option>
                            <option value="contrasts_with">contrasts with ↔</option>
                            <option value="part_of">part of →</option>
                          </select>
                          <select style={select} value={toId} onChange={(event) => setToId(event.target.value)}>
                            <option value="">Choose destination…</option>
                            {objectives.map((row: any) => <option key={row.id} value={row.id}>To · {row.code || row.title}</option>)}
                          </select>
                          <select style={select} value={strength} onChange={(event) => setStrength(event.target.value)}>
                            <option value="supporting">Supporting</option>
                            <option value="required">Required</option>
                          </select>
                        </div>
                        <textarea
                          style={{ ...input, minHeight: 70, resize: "vertical", marginTop: 8 }}
                          value={rationale}
                          onChange={(event) => setRationale(event.target.value)}
                          placeholder="Why does this relationship hold? Add the curriculum evidence…"
                        />
                        <button style={primaryButton} disabled={Boolean(busy)} onClick={createLink}>
                          Propose relationship
                        </button>
                      </section>

                      <section style={{ marginTop: 18 }}>
                        <div style={panelHead}>Review queue for this objective · {reviewItems.length}</div>
                        {reviewItems.length === 0 ? (
                          <div style={empty}>No proposed assertions touch this objective.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {reviewItems.map((item: any) => (
                              <article key={`${item.entityKind}:${item.id}`} style={reviewCard}>
                                <div>
                                  <div style={{ color: C.amb, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" }}>
                                    {item.title} · {item.source}
                                  </div>
                                  <div style={{ color: C.text, fontSize: 12, marginTop: 5 }}>{item.detail}</div>
                                </div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    style={approveButton}
                                    disabled={Boolean(busy)}
                                    onClick={() => mutate({
                                      operation: "review",
                                      entityKind: item.entityKind,
                                      entityId: item.id,
                                      decision: "approved",
                                    }, `approve:${item.id}`)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    style={rejectButton}
                                    disabled={Boolean(busy)}
                                    onClick={() => mutate({
                                      operation: "review",
                                      entityKind: item.entityKind,
                                      entityId: item.id,
                                      decision: "rejected",
                                    }, `reject:${item.id}`)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </>
              ) : (
                <div style={empty}>Choose an objective to inspect its curriculum neighbourhood.</div>
              )}
            </main>
          </div>
        </>
      )}

      <style>{`
        .graph-toolbar { display:grid; grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) auto; gap:10px; align-items:end; margin:22px 0; }
        .coverage-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:16px; }
        .workbench-grid { display:grid; grid-template-columns:minmax(230px,.65fr) minmax(0,2fr); gap:14px; align-items:start; }
        .progression-grid { display:grid; grid-template-columns:1fr 1.08fr 1fr; gap:10px; align-items:stretch; }
        .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; }
        .link-form { display:grid; grid-template-columns:1.3fr .8fr 1.3fr .7fr; gap:8px; }
        @media (max-width: 880px) {
          .graph-toolbar, .coverage-grid, .workbench-grid, .progression-grid, .detail-grid, .link-form { grid-template-columns:1fr; }
        }
      `}</style>
    </div>
  );
}

function Metric({ label: metricLabel, value, warn = false }: any) {
  return (
    <div style={panel}>
      <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" }}>{metricLabel}</div>
      <div style={{ color: warn ? C.amb : C.grn, fontFamily: C.serif, fontSize: 32, marginTop: 5 }}>{value}</div>
    </div>
  );
}

function GraphColumn({ label: columnLabel, rows, emptyLabel, onSelect }: any) {
  return (
    <div style={panel}>
      <div style={panelHead}>{columnLabel}</div>
      {!rows.length ? <div style={{ color: C.dim, fontSize: 10 }}>{emptyLabel}</div> : rows.map(({ edge, objective }: any) => (
        <button key={edge.id} style={graphNode} onClick={() => objective?.id && onSelect(objective.id)}>
          <span style={{ color: C.text }}>{objective?.title || "Unknown objective"}</span>
          <small style={{ color: edge.strength === "required" ? C.amb : C.dim }}>
            {edge.strength}{edge.rationale ? ` · ${edge.rationale}` : ""}
          </small>
        </button>
      ))}
    </div>
  );
}

function DetailCard({ title: cardTitle, rows }: any) {
  return (
    <div style={panel}>
      <div style={panelHead}>{cardTitle}</div>
      {!rows.length ? <div style={{ color: C.dim, fontSize: 10 }}>No approved assertions yet.</div> : rows.map((row: any, index: number) => (
        <div key={`${row.title}:${index}`} style={{ padding: "9px 0", borderTop: index ? `1px solid ${C.rule}` : "none" }}>
          <strong style={{ color: C.text, fontSize: 12 }}>{row.title}</strong>
          {row.detail && <div style={{ color: C.dim, fontSize: 10, lineHeight: 1.45, marginTop: 4 }}>{row.detail}</div>}
        </div>
      ))}
    </div>
  );
}

export default function CurriculumGraphPage() {
  return <AppShell><GraphWorkbench /></AppShell>;
}

const title = { color: C.text, fontFamily: C.serif, fontWeight: 400, fontSize: 48, lineHeight: 1, margin: "8px 0 12px" } as const;
const intro = { color: C.muted, maxWidth: 850, fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" } as const;
const eyebrow = { color: C.grn, fontFamily: C.mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginTop: 14 };
const back = { color: C.dim, fontFamily: C.mono, fontSize: 10, textDecoration: "none" } as const;
const panel = { padding: 15, border: `1px solid ${C.border}`, borderRadius: 13, background: C.surface } as const;
const panelHead = { color: C.dim, fontFamily: C.mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 10 };
const empty = { padding: 18, border: `1px dashed ${C.border}`, borderRadius: 12, color: C.muted, fontSize: 12, lineHeight: 1.55 } as const;
const errorStyle = { ...empty, color: C.red, border: `1px solid ${C.red}55`, background: C.redS, marginBottom: 14 } as const;
const guardrails = { display: "flex", gap: 8, flexWrap: "wrap" as const, color: C.grn, background: C.grnS, border: `1px solid ${C.grn}44`, padding: 11, borderRadius: 11, fontFamily: C.mono, fontSize: 9 } as const;
const label = { display: "grid", gap: 5, color: C.dim, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" as const };
const select = { width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgSoft, color: C.text, fontSize: 11 } as const;
const input = { width: "100%", boxSizing: "border-box" as const, padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgSoft, color: C.text, fontSize: 11, marginBottom: 9 };
const primaryButton = { padding: "9px 13px", border: "none", borderRadius: 999, background: C.accent, color: C.accentFg, fontFamily: C.mono, fontSize: 9, fontWeight: 700, cursor: "pointer", marginTop: 8 } as const;
const objectiveButton = { width: "100%", display: "grid", gap: 4, padding: 10, color: C.text, textAlign: "left" as const, border: "1px solid transparent", borderRadius: 8, cursor: "pointer", fontSize: 11 };
const graphNode = { display: "grid", gap: 5, width: "100%", textAlign: "left" as const, padding: 10, marginTop: 7, border: `1px solid ${C.border}`, borderRadius: 9, background: C.bgSoft, cursor: "pointer", fontSize: 11 };
const chipRow = { display: "flex", flexWrap: "wrap" as const, gap: 6 };
const chip = { border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 8px", color: C.muted, fontSize: 9 };
const reviewCard = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: 12, border: `1px solid ${C.amb}44`, background: C.ambS, borderRadius: 10 } as const;
const approveButton = { padding: "6px 9px", borderRadius: 7, border: `1px solid ${C.grn}`, background: C.grnS, color: C.grn, fontSize: 9, cursor: "pointer" } as const;
const rejectButton = { padding: "6px 9px", borderRadius: 7, border: `1px solid ${C.red}`, background: C.redS, color: C.red, fontSize: 9, cursor: "pointer" } as const;
