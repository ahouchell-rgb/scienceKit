"use client";
import { useEffect, useMemo, useState } from "react";
import { C } from "@/lib/theme";
import { Btn } from "@/lib/primitives";

export interface DiagramEntry {
  id: string;
  title: string;
  discipline: string;
  unitCode: string | null;
  unitTitle: string | null;
  vb: string;
  parts: { id: string; label: string; note: string }[];
  keywords: string[];
}

const DISCIPLINES = ["all", "biology", "chemistry", "physics"] as const;

/* Curriculum diagram picker: the 117 living build-up diagrams extracted from the
   Springboard learn app (public/diagrams + lib/diagramCatalog.json). The catalog
   is dynamically imported so the editor bundle doesn't carry it until the modal
   opens; previews load lazily as plain <img src="/diagrams/id.svg">. */
export function DiagramPickerModal({ onInsert, onCancel }: {
  onInsert: (entry: DiagramEntry, svg: string) => void;
  onCancel: () => void;
}) {
  const [catalog, setCatalog] = useState<DiagramEntry[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState<(typeof DISCIPLINES)[number]>("all");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let alive = true;
    import("@/lib/diagramCatalog.json")
      .then((m) => { if (alive) setCatalog((m.default || m) as DiagramEntry[]); })
      .catch(() => { if (alive) setError("Couldn't load the diagram library."); });
    return () => { alive = false; };
  }, []);

  const hits = useMemo(() => {
    if (!catalog) return [];
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.filter((d) => {
      if (disc !== "all" && d.discipline !== disc) return false;
      if (!terms.length) return true;
      const hay = `${d.title} ${d.unitTitle || ""} ${d.keywords.join(" ")}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [catalog, q, disc]);

  const pick = async (d: DiagramEntry) => {
    if (busy) return;
    setBusy(d.id);
    try {
      const r = await fetch(`/diagrams/${d.id}.svg`);
      if (!r.ok) throw new Error(String(r.status));
      onInsert(d, await r.text());
    } catch {
      setError(`Couldn't load "${d.title}" — try again.`);
      setBusy("");
    }
  };

  return (
    <div onMouseDown={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onMouseDown={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 18, width: 780, maxWidth: "94vw", height: "78vh", display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: C.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.dim, marginBottom: 10 }}>
          Diagram library — living build-up diagrams
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: heart, circuit, particle model, photosynthesis…"
            style={{ flex: 1, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.sans, fontSize: 14 }} />
          {DISCIPLINES.map((d) => (
            <button key={d} onClick={() => setDisc(d)}
              style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${disc === d ? C.accent : C.border}`, cursor: "pointer",
                       background: disc === d ? `${C.accent}22` : "#fff", fontFamily: C.mono, fontSize: 11, textTransform: "capitalize" }}>
              {d}
            </button>
          ))}
        </div>
        {error && <div style={{ color: "#b23", fontFamily: C.sans, fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10, alignContent: "start" }}>
          {!catalog && !error && <div style={{ fontFamily: C.sans, color: C.dim, fontSize: 13 }}>Loading library…</div>}
          {hits.map((d) => (
            <button key={d.id} onClick={() => pick(d)} disabled={!!busy} title={`${d.title} — ${d.parts.length} labelled parts`}
              style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", padding: 8,
                       textAlign: "left", opacity: busy && busy !== d.id ? 0.5 : 1, transition: "border-color .12s" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}>
              <div style={{ height: 108, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fafbff", borderRadius: 6 }}>
                <img src={`/diagrams/${d.id}.svg`} alt={d.title} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%" }} />
              </div>
              <div style={{ fontFamily: C.sans, fontSize: 12.5, fontWeight: 600, marginTop: 6, color: C.text, lineHeight: 1.25 }}>
                {busy === d.id ? "Inserting…" : d.title}
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, marginTop: 2, textTransform: "capitalize" }}>
                {d.discipline}{d.unitCode ? ` · ${d.unitCode}` : ""} · {d.parts.length} parts
              </div>
            </button>
          ))}
          {catalog && !hits.length && <div style={{ fontFamily: C.sans, color: C.dim, fontSize: 13 }}>No diagrams match “{q}”.</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <span style={{ fontFamily: C.sans, fontSize: 12, color: C.dim }}>
            Diagrams insert in build-up mode: each labelled part reveals on click in Present.
          </span>
          <Btn v="ghost" onClick={onCancel}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}
