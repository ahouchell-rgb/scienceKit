"use client";
/* ⌘K over the ontology. Every object type in ontology.ts is searchable from
   one box, and what you are allowed to resolve depends on your level — the
   palette is where purpose-based access becomes visible rather than theoretical. */

import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "@/lib/theme";
import { Chip, Key, Micro } from "./ui";
import { OBJECT_TYPES, type ObjectTypeKey } from "@/lib/intel/ontology";
import { LEVEL_DEFS, type Viewer } from "@/lib/intel/scope";
import { world } from "@/lib/intel/synth";
import type { Finding } from "@/lib/intel/analytics";

export interface PaletteHit {
  type: ObjectTypeKey | "Finding";
  id: string;
  title: string;
  sub: string;
  blocked?: string;
}

export function Palette({
  viewer, findings, onClose, onPick,
}: {
  viewer: Viewer;
  findings: Finding[];
  onClose: () => void;
  onPick: (hit: PaletteHit) => void;
}) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => {
    const w = world();
    const needle = q.trim().toLowerCase();
    const out: PaletteHit[] = [];
    const canName = LEVEL_DEFS[viewer.level].maxPupilGrain !== null;

    const match = (s: string) => !needle || s.toLowerCase().includes(needle);

    for (const f of findings) {
      if (match(f.headline) || match(f.sub)) {
        out.push({ type: "Finding", id: f.id, title: f.headline, sub: f.sub.slice(0, 90) + "…" });
      }
    }
    for (const s of w.schools) {
      if (match(s.name)) out.push({ type: "School", id: s.id, title: s.name, sub: `${s.pupilCount.toLocaleString("en-GB")} on roll · FSM6 ${s.fsm6Pct}%` });
    }
    for (const d of w.departments) {
      if (!match(d.name)) continue;
      if (viewer.schoolId && d.schoolId !== viewer.schoolId) continue;
      out.push({ type: "Department", id: d.id, title: `${d.name} — ${w.schoolById.get(d.schoolId)!.name}`, sub: `${d.staffCount} staff` });
    }
    if (needle.length >= 2) {
      // If this level cannot resolve children, we do not list them and then
      // refuse — printing the name in order to say "you may not see this name"
      // would leak precisely what is being withheld. One row explains why, and
      // the query never touches the pupil table.
      if (!canName) {
        out.push({
          type: "Pupil", id: "__blocked__",
          title: "Pupil search is unavailable at this altitude",
          sub: "",
          blocked: `${LEVEL_DEFS[viewer.level].label} has no granted purpose that requires naming a child, so the console does not search them. The school can.`,
        });
      } else {
        for (const p of w.pupils) {
          if (!match(p.name)) continue;
          if (viewer.schoolId && p.schoolId !== viewer.schoolId) continue;
          out.push({
            type: "Pupil", id: p.id, title: p.name,
            sub: `Year ${p.year} ${p.form} · ${w.schoolById.get(p.schoolId)!.name}`,
          });
          if (out.length > 120) break;
        }
      }
      for (const o of w.objectives) {
        if (!match(o.name)) continue;
        out.push({ type: "Objective", id: o.id, title: o.name, sub: `Year ${o.year} · taught week ${o.taughtWeek}` });
        if (out.length > 160) break;
      }
      for (const s of w.slots) {
        if (match(s.label) || match(s.room)) out.push({ type: "TimetableSlot", id: s.id, title: s.label, sub: `Room ${s.room}` });
      }
    }
    return out.slice(0, 40);
  }, [q, findings, viewer]);

  useEffect(() => setI(0), [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) { e.preventDefault(); setI((n) => Math.min(hits.length - 1, n + 1)); }
      else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const h = hits[i];
        if (h && !h.blocked) { onPick(h); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [hits, i, onClose, onPick]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }, [i]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(4,10,20,0.72)",
        backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", paddingTop: "12vh",
      }}
    >
      <div
        className="intel-pop" onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, calc(100% - 32px))", maxHeight: "70vh", display: "flex", flexDirection: "column",
          background: "#0b1728", border: `1px solid ${C.borderStrong}`, borderRadius: 14,
          boxShadow: "0 40px 100px rgba(0,0,0,0.6)", overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${C.rule}` }}>
          <span style={{ color: C.accent, fontFamily: C.mono, fontSize: 14 }} aria-hidden>⌕</span>
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search the ontology — findings, schools, departments, pupils, objectives, slots…"
            aria-label="Search the ontology"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: C.text, fontFamily: C.sans, fontSize: 15,
            }}
          />
          <Key>esc</Key>
        </div>

        <div ref={listRef} className="intel-scroll" style={{ overflowY: "auto", padding: 6 }}>
          {hits.length === 0 && (
            <div style={{ padding: 22, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
              {q ? "Nothing matches." : "Type to search. Two characters to reach pupils and objectives."}
            </div>
          )}
          {hits.map((h, n) => {
            const glyph = h.type === "Finding" ? "◇" : OBJECT_TYPES[h.type as ObjectTypeKey]?.glyph ?? "·";
            return (
              <div
                key={h.type + h.id} data-i={n}
                onMouseEnter={() => setI(n)}
                onClick={() => { if (!h.blocked) { onPick(h); onClose(); } }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", borderRadius: 8,
                  cursor: h.blocked ? "not-allowed" : "pointer",
                  background: n === i ? "rgba(255,255,255,0.075)" : "transparent",
                  opacity: h.blocked ? 0.5 : 1,
                }}
              >
                <span style={{ color: C.accent, fontFamily: C.mono, fontSize: 13, width: 16, textAlign: "center" }} aria-hidden>{glyph}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</div>
                  <div style={{ fontSize: 11.5, color: h.blocked ? C.amb : C.dim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.blocked ?? h.sub}
                  </div>
                </div>
                <Chip>{h.type}</Chip>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 14, padding: "9px 16px", borderTop: `1px solid ${C.rule}`, alignItems: "center" }}>
          <Micro style={{ display: "flex", gap: 6, alignItems: "center" }}><Key>↑</Key><Key>↓</Key> move</Micro>
          <Micro style={{ display: "flex", gap: 6, alignItems: "center" }}><Key>↵</Key> open</Micro>
          <span style={{ flex: 1 }} />
          <Micro>{LEVEL_DEFS[viewer.level].label} scope</Micro>
        </div>
      </div>
    </div>
  );
}
