"use client";
/* ─────────────────────────────────────────────────────────────────────────
   THE CONSOLE.

   One surface, four altitudes. A trust director, a head, a head of department
   and a class teacher are all doing the same job — looking at evidence and
   deciding what to change — so they get the same instrument, scoped
   differently. Switch level with 1–4 and watch what the console will and will
   not tell you change with it.

   Keyboard-first by design: an analyst who has to reach for the mouse is an
   analyst who has stopped thinking.
   ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { C } from "@/lib/theme";
import { Btn, Chip, INTEL_CSS, Key, Micro, Rule, StatTile } from "@/components/intel/ui";
import { CaseView, ChangeList, FindingCard, PupilCase } from "@/components/intel/views";
import { Palette, type PaletteHit } from "@/components/intel/Palette";
import { EvidenceView } from "@/components/intel/EvidenceView";
import { ProgressionView } from "@/components/intel/ProgressionView";
import { briefingFor } from "@/lib/intel/analytics";
import { LEVELS, LEVEL_DEFS, PURPOSES, type Level, type Viewer } from "@/lib/intel/scope";
import { world } from "@/lib/intel/synth";
import { LINK_TYPES, OBJECT_TYPES, ONTOLOGY_VERSION } from "@/lib/intel/ontology";
import { auditLog, subscribe, undo } from "@/lib/intel/actions";

/* ─── Views ────────────────────────────────────────────────────────────── */

type View =
  | { kind: "board" }
  | { kind: "case"; findingId: string }
  | { kind: "pupil"; pupilId: string; subjectKey?: string }
  | { kind: "audit" }
  | { kind: "ontology" }
  | { kind: "evidence" }
  | { kind: "progression"; ks2?: number };

/** A default identity per level, chosen to land somewhere with something to
 *  find. In production this comes from the JWT; here it is switchable so the
 *  same console can be shown to four different people in one meeting. */
function defaultViewer(level: Level, schoolId?: string, departmentId?: string): Viewer {
  const w = world();
  const sid = schoolId ?? "sch-marsh";
  const did = departmentId ?? `dept-${sid}-science`;
  const teacher = w.staff.find((s) => s.departmentId === did && s.role === "teacher");
  const classIds = teacher ? w.classes.filter((c) => c.staffId === teacher.id).map((c) => c.id) : [];

  switch (level) {
    case "trust":
      return { level, schoolId: null, departmentId: null, staffId: null, classIds: [], name: "Director of Education" };
    case "head":
      return { level, schoolId: sid, departmentId: null, staffId: null, classIds: [], name: "Headteacher" };
    case "hod":
      return { level, schoolId: sid, departmentId: did, staffId: w.departmentById.get(did)?.headStaffId ?? null, classIds: [], name: w.staffById.get(w.departmentById.get(did)?.headStaffId ?? "")?.name ?? "Head of Department" };
    case "teacher":
      return { level, schoolId: sid, departmentId: did, staffId: teacher?.id ?? null, classIds, name: teacher?.name ?? "Class teacher" };
  }
}

export default function IntelPage() {
  const w = useMemo(() => world(), []);
  const [level, setLevel] = useState<Level>("head");
  const [schoolId, setSchoolId] = useState("sch-marsh");
  const [departmentId, setDepartmentId] = useState("dept-sch-marsh-science");
  const [view, setView] = useState<View>({ kind: "board" });
  const [trail, setTrail] = useState<{ label: string; view: View }[]>([]);
  const [cursor, setCursor] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const viewer = useMemo(
    () => defaultViewer(level, schoolId, departmentId),
    [level, schoolId, departmentId],
  );
  const briefing = useMemo(() => briefingFor(viewer), [viewer]);

  const departments = useMemo(
    () => w.departments.filter((d) => d.schoolId === schoolId),
    [w, schoolId],
  );

  /* ── Navigation with a trail you can walk back up ── */
  // The crumb we push describes where we are LEAVING, not where we are going —
  // the destination is rendered as the tail of the trail. The board is never
  // pushed because the home crumb already stands for it.
  const go = useCallback((next: View) => {
    setTrail((t) => (view.kind === "board" ? t : [...t, { label: titleOf(view, briefing.findings, w), view }]));
    setView(next);
    mainRef.current?.scrollTo({ top: 0 });
  }, [view, briefing.findings, w]);

  // Both setState calls happen here, at event time. Updating one piece of state
  // from inside another's updater function would run it during render.
  const back = useCallback(() => {
    if (!trail.length) { setView({ kind: "board" }); return; }
    setView(trail[trail.length - 1].view);
    setTrail(trail.slice(0, -1));
    mainRef.current?.scrollTo({ top: 0 });
  }, [trail]);

  const home = useCallback(() => { setTrail([]); setView({ kind: "board" }); }, []);

  // Changing level resets you to that person's board — you are a different
  // person now, and carrying a case across altitudes would leak scope.
  useEffect(() => { setTrail([]); setView({ kind: "board" }); setCursor(0); }, [level, schoolId, departmentId]);

  /* ── Keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing = tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setPaletteOpen(true); return;
      }
      if (typing || paletteOpen) return;

      if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); return; }
      if (e.key === "Escape") { e.preventDefault(); back(); return; }
      if (e.key >= "1" && e.key <= "4") { e.preventDefault(); setLevel(LEVELS[+e.key - 1]); return; }
      if (e.key === "a" || e.key === "A") { e.preventDefault(); go({ kind: "audit" }); return; }
      if (e.key === "o" || e.key === "O") { e.preventDefault(); go({ kind: "ontology" }); return; }
      if (e.key === "e" || e.key === "E") { e.preventDefault(); go({ kind: "evidence" }); return; }
      if (e.key === "p" || e.key === "P") { e.preventDefault(); go({ kind: "progression" }); return; }

      if (view.kind !== "board") return;
      const max = briefing.findings.length - 1;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(max, c + 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const f = briefing.findings[cursor];
        if (f && !f.suppressed) go({ kind: "case", findingId: f.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, briefing, cursor, paletteOpen, back, go]);

  const onPalettePick = (hit: PaletteHit) => {
    if (hit.type === "Finding") go({ kind: "case", findingId: hit.id });
    else if (hit.type === "Pupil") go({ kind: "pupil", pupilId: hit.id });
    else if (hit.type === "School") { setLevel("head"); setSchoolId(hit.id); }
    else if (hit.type === "Department") {
      const d = w.departmentById.get(hit.id);
      if (d) { setSchoolId(d.schoolId); setDepartmentId(d.id); setLevel("hod"); }
    }
  };

  const current = view.kind === "case" ? briefing.findings.find((f) => f.id === view.findingId) : undefined;

  return (
    <div style={{
      minHeight: "100dvh", background: `radial-gradient(1200px 700px at 20% -10%, #10243d 0%, ${C.bg} 55%)`,
      color: C.text, fontFamily: C.sans, display: "flex",
    }}>
      <style dangerouslySetInnerHTML={{ __html: INTEL_CSS }} />

      {/* ── Level rail ── */}
      <aside style={{
        width: 232, flexShrink: 0, borderRight: `1px solid ${C.rule}`,
        padding: "22px 18px", display: "flex", flexDirection: "column", gap: 4,
        position: "sticky", top: 0, height: "100dvh", overflowY: "auto",
      }} className="intel-scroll">
        <Link href="/" style={{ textDecoration: "none", color: "inherit", marginBottom: 20, display: "block" }}>
          <div style={{ fontFamily: C.serif, fontSize: 19, letterSpacing: "-0.01em" }}>Northreach</div>
          <Micro style={{ marginTop: 2 }}>Intelligence console</Micro>
        </Link>

        <Micro style={{ marginBottom: 8 }}>Altitude</Micro>
        {LEVELS.map((l, i) => {
          const def = LEVEL_DEFS[l];
          const on = l === level;
          return (
            <button
              key={l} onClick={() => setLevel(l)} className="intel-btn"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9,
                border: `1px solid ${on ? def.accent : "transparent"}`,
                background: on ? def.accent + "1c" : "transparent",
                color: on ? C.text : C.muted, cursor: "pointer", textAlign: "left", width: "100%",
              }}
            >
              <span style={{ color: def.accent, fontSize: 13 }} aria-hidden>{def.glyph}</span>
              <span style={{ flex: 1, fontSize: 13.5 }}>{def.label}</span>
              <Key>{i + 1}</Key>
            </button>
          );
        })}

        <div style={{ marginTop: 14, padding: "11px 12px", borderRadius: 9, background: "rgba(255,255,255,0.035)", border: `1px solid ${C.rule}` }}>
          <Micro style={{ marginBottom: 6 }}>Their job</Micro>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: C.muted }}>{LEVEL_DEFS[level].job}</div>
        </div>

        {level !== "trust" && (
          <>
            <Micro style={{ marginTop: 18, marginBottom: 7 }}>School</Micro>
            <Select value={schoolId} onChange={(v) => { setSchoolId(v); setDepartmentId(`dept-${v}-science`); }}
              options={w.schools.map((s) => ({ value: s.id, label: s.name }))} />
          </>
        )}
        {(level === "hod" || level === "teacher") && (
          <>
            <Micro style={{ marginTop: 12, marginBottom: 7 }}>Department</Micro>
            <Select value={departmentId} onChange={setDepartmentId}
              options={departments.map((d) => ({ value: d.id, label: d.name }))} />
          </>
        )}

        <Micro style={{ marginTop: 20, marginBottom: 7 }}>Purposes granted</Micro>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {LEVEL_DEFS[level].purposes.map((p) => (
            <span key={p} title={PURPOSES[p].question}>
              <Chip tone="info">{PURPOSES[p].label}</Chip>
            </span>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 24 }} />

        <div style={{ display: "grid", gap: 5 }}>
          <RailLink label="Audit trail" hint="a" onClick={() => go({ kind: "audit" })} />
          <RailLink label="The ontology" hint="o" onClick={() => go({ kind: "ontology" })} />
          <RailLink label="Evidence base" hint="e" onClick={() => go({ kind: "evidence" })} />
          <RailLink label="KS2 → GCSE" hint="p" onClick={() => go({ kind: "progression" })} />
          <RailLink label="Search" hint="⌘K" onClick={() => setPaletteOpen(true)} />
        </div>

        <div style={{ marginTop: 16, fontSize: 10.5, color: C.faint, lineHeight: 1.6, fontFamily: C.mono }}>
          SYNTHETIC COHORT · no real pupil data<br />ontology v{ONTOLOGY_VERSION}
        </div>
      </aside>

      {/* ── Main ── */}
      <div ref={mainRef} className="intel-scroll" style={{ flex: 1, minWidth: 0, height: "100dvh", overflowY: "auto" }}>
        {/* Trail */}
        <div style={{
          position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 10,
          padding: "13px 30px", borderBottom: `1px solid ${C.rule}`,
          background: "rgba(7,17,31,0.82)", backdropFilter: "blur(14px)",
        }}>
          <button onClick={home} className="intel-btn" style={crumbStyle(trail.length === 0)}>
            {LEVEL_DEFS[level].label} briefing
          </button>
          {trail.map((t, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: C.faint, fontSize: 11 }}>/</span>
              <button className="intel-btn" style={crumbStyle(false)}
                onClick={() => { setView(t.view); setTrail(trail.slice(0, i)); }}>{t.label}</button>
            </span>
          ))}
          {trail.length > 0 && (
            <>
              <span style={{ color: C.faint, fontSize: 11 }}>/</span>
              <span style={{ ...crumbStyle(true), cursor: "default" }}>{titleOf(view, briefing.findings, w)}</span>
            </>
          )}
          <span style={{ flex: 1 }} />
          {trail.length > 0 && <Btn small onClick={back}>← back <Key>esc</Key></Btn>}
          <Btn small onClick={() => setPaletteOpen(true)}>⌕ <Key>⌘K</Key></Btn>
        </div>

        <div style={{ padding: "30px 30px 0", maxWidth: 1180 }}>
          {view.kind === "board" && (
            <Board viewer={viewer} briefing={briefing} cursor={cursor} setCursor={setCursor} go={go} />
          )}
          {view.kind === "case" && current && (
            <CaseView viewer={viewer} finding={current}
              onPupil={(id) => go({ kind: "pupil", pupilId: id, subjectKey: current.subjectKey })} />
          )}
          {view.kind === "case" && !current && (
            <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
              That finding is not in scope at this altitude. <Btn small onClick={home}>Back to briefing</Btn>
            </div>
          )}
          {view.kind === "pupil" && <PupilCase viewer={viewer} pupilId={view.pupilId} subjectKey={view.subjectKey} onProgression={(ks2) => go({ kind: "progression", ks2 })} />}
          {view.kind === "audit" && <AuditView />}
          {view.kind === "ontology" && <OntologyView />}
          {view.kind === "evidence" && <EvidenceView />}
          {view.kind === "progression" && <ProgressionView initialKs2={view.ks2 ?? 101} />}
        </div>
      </div>

      {paletteOpen && (
        <Palette viewer={viewer} findings={briefing.findings}
          onClose={() => setPaletteOpen(false)} onPick={onPalettePick} />
      )}
    </div>
  );
}

/* ─── Board ────────────────────────────────────────────────────────────── */

function Board({
  viewer, briefing, cursor, setCursor, go,
}: {
  viewer: Viewer;
  briefing: ReturnType<typeof briefingFor>;
  cursor: number; setCursor: (n: number) => void;
  go: (v: View) => void;
}) {
  const def = LEVEL_DEFS[viewer.level];
  const live = briefing.findings.filter((f) => !f.suppressed);
  const suppressed = briefing.findings.filter((f) => f.suppressed);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ color: def.accent, fontSize: 15 }} aria-hidden>{def.glyph}</span>
        <Micro>{def.role} · {viewer.name}</Micro>
      </div>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 40, lineHeight: 1.06, letterSpacing: "-0.02em", marginBottom: 10, maxWidth: "20ch" }}>
        {briefing.headline}
      </h1>
      <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.6, maxWidth: "62ch", marginBottom: 24 }}>
        {def.job} Findings are ordered by effect size, largest first — this is a short list on purpose.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: 10, marginBottom: 8 }}>
        {briefing.stats.map((s, i) => <StatTile key={s.label} label={s.label} value={s.value} hint={s.hint} delay={i * 70} />)}
      </div>

      <Rule label={`Findings · ${live.length}`} />
      <div style={{ display: "grid", gap: 10 }}>
        {live.length === 0 && (
          <div style={{ padding: 22, borderRadius: 10, border: `1px dashed ${C.rule}`, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            Nothing meets the threshold at this altitude. That is a result, not an empty state.
          </div>
        )}
        {live.map((f, i) => (
          <FindingCard key={f.id} finding={f} index={i} cursor={i === cursor}
            onOpen={() => { setCursor(i); go({ kind: "case", findingId: f.id }); }} />
        ))}
      </div>

      {briefing.changes.length > 0 && (
        <>
          <Rule label="Trajectories that changed — descriptive, not predictive" />
          <p style={{ fontSize: 13, color: C.faint, lineHeight: 1.6, maxWidth: "70ch", marginBottom: 12 }}>
            These pupils moved against their own cross-subject baseline. No score, no ranking, no
            prediction about any child — just what changed, with the evidence attached.
          </p>
          <ChangeList changes={briefing.changes}
            onPupil={(id, subj) => go({ kind: "pupil", pupilId: id, subjectKey: subj })} />
        </>
      )}

      {suppressed.length > 0 && (
        <>
          <Rule label={`Suppressed · ${suppressed.length}`} />
          <div style={{ display: "grid", gap: 8 }}>
            {suppressed.map((f, i) => <FindingCard key={f.id} finding={f} index={i} cursor={false} onOpen={() => {}} />)}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "30px 0 60px", flexWrap: "wrap" }}>
        <Micro style={{ display: "flex", gap: 6, alignItems: "center" }}><Key>j</Key><Key>k</Key> move</Micro>
        <Micro style={{ display: "flex", gap: 6, alignItems: "center" }}><Key>↵</Key> open</Micro>
        <Micro style={{ display: "flex", gap: 6, alignItems: "center" }}><Key>esc</Key> back</Micro>
        <Micro style={{ display: "flex", gap: 6, alignItems: "center" }}><Key>1</Key>–<Key>4</Key> altitude</Micro>
        <Micro style={{ display: "flex", gap: 6, alignItems: "center" }}><Key>⌘K</Key> search</Micro>
      </div>
    </div>
  );
}

/* ─── Audit ────────────────────────────────────────────────────────────── */

function AuditView() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force((n) => n + 1)), []);
  const log = auditLog();

  return (
    <div className="intel-fade" style={{ maxWidth: 940 }}>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 34, marginBottom: 10 }}>Audit trail</h1>
      <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, maxWidth: "66ch", marginBottom: 22 }}>
        Every state change in this console, in order, with who did it, at which altitude, and under which
        named purpose. Undo marks a row; it never deletes one. This is what a DPIA conversation asks for
        and what almost no edtech product can produce.
      </p>
      {log.length === 0 ? (
        <div style={{ padding: 22, borderRadius: 10, border: `1px dashed ${C.rule}`, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          Nothing has been actioned yet. Open a finding and act on it.
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
          {[...log].reverse().map((r, i) => (
            <div key={r.id} className="intel-rise" style={{
              animationDelay: `${i * 30}ms`, padding: "13px 16px",
              borderTop: i ? `1px solid ${C.rule}` : "none",
              opacity: r.undoneAt ? 0.45 : 1,
              textDecoration: r.undoneAt ? "line-through" : "none",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                <span style={{ fontFamily: C.mono, fontSize: 11, color: C.faint }}>{r.id}</span>
                <span style={{ fontSize: 14, color: C.text }}>{r.action.replace(/_/g, " ")}</span>
                <Chip tone="info">{r.purpose.replace(/_/g, " ")}</Chip>
                <Chip>{LEVEL_DEFS[r.level].label}</Chip>
                <span style={{ flex: 1 }} />
                <Micro>{new Date(r.at).toLocaleTimeString("en-GB")}</Micro>
                {!r.undoneAt && <Btn small onClick={() => undo(r.id)}>undo</Btn>}
              </div>
              {r.findingHeadline && <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{r.findingHeadline}</div>}
              {r.note && <div style={{ fontSize: 13, color: C.muted, marginTop: 6, paddingLeft: 11, borderLeft: `2px solid ${C.accent}66` }}>{r.note}</div>}
            </div>
          ))}
        </div>
      )}
      <div style={{ height: 60 }} />
    </div>
  );
}

/* ─── Ontology ─────────────────────────────────────────────────────────── */

function OntologyView() {
  return (
    <div className="intel-fade" style={{ maxWidth: 1000 }}>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 34, marginBottom: 10 }}>The ontology</h1>
      <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, maxWidth: "68ch", marginBottom: 8 }}>
        Object types, their properties and the links between them — one versioned artefact, v{ONTOLOGY_VERSION}.
        Every property carries a sensitivity marking that propagates downstream, and a named question it
        exists to answer. No question, no field.
      </p>
      <p style={{ fontSize: 13, color: C.faint, lineHeight: 1.6, maxWidth: "68ch", marginBottom: 22 }}>
        Nobody buys an ontology. It is here because it makes the answers on the briefing screen cheap and
        checkable — and because it is the reason an LLM can be pointed at this data without being able to
        write to it.
      </p>

      <Rule label="Links that make it more than a gradebook" />
      <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
        {LINK_TYPES.map((l, i) => (
          <div key={l.key} className="intel-rise" style={{
            animationDelay: `${i * 28}ms`, padding: "12px 15px", borderRadius: 10,
            border: `1px solid ${C.rule}`, background: "rgba(255,255,255,0.03)",
          }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center", fontFamily: C.mono, fontSize: 12, marginBottom: 6, flexWrap: "wrap" }}>
              <span style={{ color: C.accent }}>{OBJECT_TYPES[l.from].glyph} {l.from}</span>
              <span style={{ color: C.faint }}>—{l.label}→</span>
              <span style={{ color: C.accent2 }}>{OBJECT_TYPES[l.to].glyph} {l.to}</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{l.unlocks}</div>
          </div>
        ))}
      </div>

      <Rule label="Object types" />
      <div style={{ display: "grid", gap: 10 }}>
        {Object.values(OBJECT_TYPES).map((t) => (
          <div key={t.key} style={{ padding: "14px 16px", borderRadius: 10, border: `1px solid ${C.rule}`, background: "rgba(255,255,255,0.03)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span style={{ color: C.accent, fontSize: 14 }} aria-hidden>{t.glyph}</span>
              <span style={{ fontSize: 15.5, color: C.text }}>{t.label}</span>
              <Chip>from {LEVEL_DEFS[t.minLevel].label}</Chip>
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              {t.properties.map((p) => (
                <div key={p.key} style={{ display: "grid", gridTemplateColumns: "170px 108px 1fr", gap: 12, alignItems: "baseline" }}>
                  <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.text }}>{p.key}</span>
                  <Chip tone={p.sensitivity === "special" ? "bad" : p.sensitivity === "restricted" ? "warn" : p.sensitivity === "internal" ? "info" : "neutral"}>
                    {p.sensitivity}
                  </Chip>
                  <span style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{p.why}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}

/* ─── Bits ─────────────────────────────────────────────────────────────── */

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "7px 9px", borderRadius: 7, fontSize: 12.5,
        background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`,
        color: C.text, fontFamily: C.sans, cursor: "pointer",
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value} style={{ background: "#0b1728" }}>{o.label}</option>)}
    </select>
  );
}

function RailLink({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="intel-btn" style={{
      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8,
      border: `1px solid ${C.rule}`, background: "transparent", color: C.muted,
      cursor: "pointer", textAlign: "left", width: "100%", fontSize: 12.5,
    }}>
      <span style={{ flex: 1 }}>{label}</span><Key>{hint}</Key>
    </button>
  );
}

const crumbStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: C.mono, fontSize: 11, letterSpacing: "0.05em", padding: "4px 9px", borderRadius: 6,
  border: "1px solid transparent", background: active ? "rgba(255,255,255,0.08)" : "transparent",
  color: active ? C.text : C.muted, cursor: "pointer", whiteSpace: "nowrap",
  maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis",
});

function titleOf(view: View, findings: { id: string; headline: string }[], w: ReturnType<typeof world>) {
  if (view.kind === "case") return findings.find((f) => f.id === view.findingId)?.headline.slice(0, 40) + "…";
  if (view.kind === "pupil") return w.pupilById.get(view.pupilId)?.name ?? "Pupil";
  if (view.kind === "audit") return "Audit trail";
  if (view.kind === "ontology") return "Ontology";
  if (view.kind === "evidence") return "Evidence base";
  if (view.kind === "progression") return "KS2 → GCSE";
  return "Briefing";
}
