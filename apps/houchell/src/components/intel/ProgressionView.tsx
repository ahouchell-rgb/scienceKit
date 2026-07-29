"use client";
/* "Pupils who started where this one started actually landed here."

   The whole design commitment of this screen is that it shows a DISTRIBUTION
   and refuses to show a predicted grade. Every commercial product in this
   space converts a KS2 score into a target grade and hands it to a child. The
   data does not support that: 49% of pupils starting at KS2 100–102 do not get
   a grade 4, and 4% of pupils starting below 89.5 do. A target grade
   communicates a certainty nobody has. */

import { useState } from "react";
import { C } from "@/lib/theme";
import { Chip, Micro, Rule } from "./ui";
import {
  DISADVANTAGE_SPLIT, MARGINAL_RETURN, PROGRESSION_SOURCE, SUBJECT_FINDINGS,
  SUBJECT_TRANSITION, THRESHOLD_LEVERAGE, TRANSITION, narrate, outcomeFor,
  subjectPenalties,
} from "@/lib/intel/progression";

export function ProgressionView({ initialKs2 = 101 }: { initialKs2?: number }) {
  const [ks2, setKs2] = useState(initialKs2);
  const o = outcomeFor(ks2);
  const maxMarginal = Math.max(...MARGINAL_RETURN.map((m) => m.pctPerA8Point));
  const maxPupils = Math.max(...TRANSITION.map((t) => t.pupils));

  return (
    <div className="intel-fade" style={{ maxWidth: 1000 }}>
      <Micro style={{ marginBottom: 10 }}>Real data · {PROGRESSION_SOURCE.n}</Micro>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 34, lineHeight: 1.12, marginBottom: 12 }}>
        Where pupils who started here actually landed
      </h1>
      <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.65, maxWidth: "70ch", marginBottom: 8 }}>
        The only screen in this console built on real children. National published aggregates from the
        DfE — {PROGRESSION_SOURCE.period}, England, state-funded schools. No pupil is identifiable.
      </p>

      {/* ── The chooser ── */}
      <Rule label="A pupil's KS2 average scaled score" />
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 6, flexWrap: "wrap" }}>
        <input
          type="range" min={75} max={120} step={0.5} value={ks2}
          onChange={(e) => setKs2(parseFloat(e.target.value))}
          aria-label="KS2 average scaled score"
          style={{ flex: 1, minWidth: 260, accentColor: C.accent }}
        />
        <div style={{ fontFamily: C.serif, fontSize: 40, lineHeight: 1, color: C.text, fontVariantNumeric: "tabular-nums", minWidth: 86 }}>
          {ks2}
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <Chip tone="info">{o.row.prior} prior attainment</Chip>
          <Micro>band {o.row.band} · {o.percentile}th percentile</Micro>
        </div>
      </div>

      {/* ── The distribution, stated as counts of 100 ── */}
      <Rule label="Of 100 pupils who started exactly here" />
      <Dots pct4={o.row.pct4} pct5={o.row.pct5} />

      <div style={{ display: "grid", gap: 9, marginTop: 16 }}>
        {narrate(ks2).map((line, i) => (
          <div key={i} className="intel-rise" style={{
            animationDelay: `${i * 55}ms`, padding: "12px 15px", borderRadius: 10,
            border: `1px solid ${i === 2 ? C.accent + "44" : C.rule}`,
            background: i === 2 ? "rgba(88,224,194,0.05)" : "rgba(255,255,255,0.03)",
            fontSize: 13.5, color: i === 2 ? C.text : C.muted, lineHeight: 1.65,
          }}>{line}</div>
        ))}
      </div>

      {/* ── The full matrix ── */}
      <Rule label="The full transition matrix — KS2 to GCSE" />
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflowX: "auto" }} className="intel-scroll">
        <div style={{ minWidth: 720 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "128px 1fr 76px 84px 84px 78px",
            gap: 12, padding: "10px 15px", borderBottom: `1px solid ${C.ruleStrong}`,
          }}>
            {["KS2 band", "National cohort", "Mean A8", "% grade 4+", "% grade 5+", "Mean P8"].map((h) => (
              <Micro key={h} style={{ fontSize: 9 }}>{h}</Micro>
            ))}
          </div>
          {TRANSITION.map((r, i) => {
            const here = r.band === o.row.band;
            return (
              <div key={r.band} style={{
                display: "grid", gridTemplateColumns: "128px 1fr 76px 84px 84px 78px",
                gap: 12, padding: "9px 15px", alignItems: "center",
                borderTop: i ? `1px solid ${C.rule}` : "none",
                background: here ? "rgba(88,224,194,0.09)" : "transparent",
                borderLeft: `2px solid ${here ? C.accent : "transparent"}`,
              }}>
                <span style={{ fontFamily: C.mono, fontSize: 11.5, color: here ? C.text : C.muted }}>{r.band}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    height: 7, width: `${(r.pupils / maxPupils) * 100}%`,
                    background: here ? C.accent : "rgba(255,255,255,0.2)", borderRadius: 3,
                  }} />
                  <span style={{ fontFamily: C.mono, fontSize: 10.5, color: C.faint }}>{(r.pupils / 1000).toFixed(0)}k</span>
                </span>
                <span style={{ fontFamily: C.mono, fontSize: 12.5, color: C.text, fontVariantNumeric: "tabular-nums" }}>{r.a8}</span>
                <span style={{ fontFamily: C.mono, fontSize: 12.5, color: heat(r.pct4), fontVariantNumeric: "tabular-nums" }}>{r.pct4}%</span>
                <span style={{ fontFamily: C.mono, fontSize: 12.5, color: heat(r.pct5), fontVariantNumeric: "tabular-nums" }}>{r.pct5}%</span>
                <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.dim, fontVariantNumeric: "tabular-nums" }}>{r.p8.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.6, marginTop: 10, maxWidth: "76ch" }}>
        Progress 8 is near zero in every row <em>by construction</em> — it is centred within prior-attainment
        group, so it is structurally incapable of telling you that starting points differ. That is precisely
        why this table is worth having next to it.
      </div>

      {/* ── The leverage curve ── */}
      <Rule label="Where a marginal gain converts into a grade" />
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, maxWidth: "72ch", marginBottom: 14 }}>
        Percentage points of grade-4 achievement gained per Attainment 8 point, derived from adjacent rows
        of the table above. The curve peaks in the middle because that is where the grade-4 boundary runs.
      </p>
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
        {MARGINAL_RETURN.map((m, i) => {
          const here = m.band === o.row.band;
          return (
            <div key={m.band} style={{
              display: "grid", gridTemplateColumns: "128px 1fr 62px 140px",
              gap: 12, padding: "9px 15px", alignItems: "center",
              borderTop: i ? `1px solid ${C.rule}` : "none",
              background: here ? "rgba(88,224,194,0.09)" : "transparent",
            }}>
              <span style={{ fontFamily: C.mono, fontSize: 11.5, color: here ? C.text : C.muted }}>{m.band}</span>
              <span style={{ display: "flex", alignItems: "center" }}>
                <span style={{
                  height: 8, width: `${(m.pctPerA8Point / maxMarginal) * 100}%`,
                  background: m.pctPerA8Point >= maxMarginal * 0.75 ? C.accent : "rgba(122,167,255,0.55)",
                  borderRadius: 4, transition: "width 300ms ease",
                }} />
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 12, color: C.text, fontVariantNumeric: "tabular-nums" }}>{m.pctPerA8Point}</span>
              {m.pctPerA8Point >= maxMarginal * 0.75
                ? <Chip tone="good">leverage zone</Chip>
                : <span />}
            </div>
          );
        })}
      </div>

      {/* ── Subject level ── */}
      <SubjectSection band={o.row.band} />

      {/* ── The headline finding ── */}
      <Rule label="The threshold-leverage finding" />
      <div style={{
        padding: "16px 18px", borderRadius: 12, border: `1px solid ${C.accent}44`,
        background: "rgba(88,224,194,0.05)", marginBottom: 12,
      }}>
        <div style={{ fontFamily: C.serif, fontSize: 20, lineHeight: 1.35, color: C.text, marginBottom: 12 }}>
          {THRESHOLD_LEVERAGE.headline}
        </div>
        <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>{THRESHOLD_LEVERAGE.detail}</div>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>{THRESHOLD_LEVERAGE.implication}</div>
      </div>

      <div style={{
        padding: "14px 16px", borderRadius: 10, border: `1px solid ${C.red}55`,
        background: C.redS, marginBottom: 8,
      }}>
        <Chip tone="bad" style={{ marginBottom: 9, display: "inline-block" }}>How this gets misread</Chip>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>{THRESHOLD_LEVERAGE.caveat}</div>
      </div>

      {/* ── Disadvantage within band ── */}
      <Rule label="Same starting point, split by disadvantage" />
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "128px 84px 84px 1fr 72px",
          gap: 12, padding: "10px 15px", borderBottom: `1px solid ${C.ruleStrong}`,
        }}>
          {["KS2 band", "% 4+ disadv", "% 4+ other", "Gap in grade-4 terms", "A8 gap"].map((h) => (
            <Micro key={h} style={{ fontSize: 9 }}>{h}</Micro>
          ))}
        </div>
        {DISADVANTAGE_SPLIT.map((d, i) => {
          const gap = Math.round((d.pct4Other - d.pct4Disadvantaged) * 10) / 10;
          const a8gap = Math.round((d.a8Other - d.a8Disadvantaged) * 10) / 10;
          const here = d.band === o.row.band;
          return (
            <div key={d.band} style={{
              display: "grid", gridTemplateColumns: "128px 84px 84px 1fr 72px",
              gap: 12, padding: "9px 15px", alignItems: "center",
              borderTop: i ? `1px solid ${C.rule}` : "none",
              background: here ? "rgba(88,224,194,0.09)" : "transparent",
            }}>
              <span style={{ fontFamily: C.mono, fontSize: 11.5, color: here ? C.text : C.muted }}>{d.band}</span>
              <span style={{ fontFamily: C.mono, fontSize: 12, color: C.red, fontVariantNumeric: "tabular-nums" }}>{d.pct4Disadvantaged}%</span>
              <span style={{ fontFamily: C.mono, fontSize: 12, color: C.grn, fontVariantNumeric: "tabular-nums" }}>{d.pct4Other}%</span>
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ height: 8, width: `${(gap / 21.5) * 100}%`, background: C.red, opacity: 0.8, borderRadius: 4 }} />
                <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.red }}>{gap}pp</span>
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.dim, fontVariantNumeric: "tabular-nums" }}>{a8gap}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.65, marginTop: 10, maxWidth: "78ch" }}>
        Read the last two columns together. The Attainment 8 gap barely moves — 5.4 to 8.5 points across the
        whole range. The grade-4 gap swings from 2.0 to 21.5. Nothing about disadvantage changes across the
        ability range; only the position of the boundary does.
      </div>

      <a href={PROGRESSION_SOURCE.url} target="_blank" rel="noreferrer" style={{
        display: "inline-flex", gap: 7, marginTop: 20, fontFamily: C.mono, fontSize: 10.5,
        color: C.accent, textDecoration: "none", letterSpacing: "0.04em",
      }}>
        <span aria-hidden>↗</span>{PROGRESSION_SOURCE.source} · {PROGRESSION_SOURCE.period}
      </a>
      <div style={{ height: 60 }} />
    </div>
  );
}

const heat = (pct: number) => (pct < 35 ? C.red : pct < 70 ? C.amb : C.grn);

/* ─── Subject level — the head-of-department view ──────────────────────── */

function SubjectSection({ band }: { band: string }) {
  const [threshold, setThreshold] = useState<"pct4" | "pct5">("pct4");
  const penalties = subjectPenalties(band);
  const key = threshold === "pct4" ? "pct4Delta" : "pct5Delta";
  const maxAbs = Math.max(6, ...penalties.map((p) => Math.abs(p[key])));

  return (
    <>
      <Rule label="Same starting point, different subject" />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        {(["pct4", "pct5"] as const).map((t) => (
          <button key={t} className="intel-btn" onClick={() => setThreshold(t)} style={{
            fontFamily: C.mono, fontSize: 11, padding: "6px 12px", borderRadius: 7, cursor: "pointer",
            border: `1px solid ${threshold === t ? C.accent : C.border}`,
            background: threshold === t ? "rgba(88,224,194,0.14)" : "transparent", color: C.text,
          }}>{t === "pct4" ? "grade 4 — standard pass" : "grade 5 — strong pass"}</button>
        ))}
        <span style={{ fontSize: 12.5, color: C.faint, marginLeft: 4 }}>
          Percentage points above or below the maths / English Language baseline, for pupils who started at KS2 {band}.
        </span>
      </div>

      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
        {penalties.map((p, i) => {
          const v = p[key];
          const frac = Math.abs(v) / maxAbs;
          return (
            <div key={p.key} style={{
              display: "grid", gridTemplateColumns: "150px 1fr 66px 108px",
              gap: 12, padding: "10px 15px", alignItems: "center",
              borderTop: i ? `1px solid ${C.rule}` : "none",
              opacity: p.comparable ? 1 : 0.55,
            }}>
              <span style={{ fontSize: 13.5, color: C.text }}>{p.name}</span>
              <div style={{ position: "relative", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
                <span style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: C.ruleStrong }} />
                <span style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: v < 0 ? "auto" : "50%", right: v < 0 ? "50%" : "auto",
                  width: `${frac * 50}%`, borderRadius: 4,
                  background: v < 0 ? C.red : C.grn, opacity: p.comparable ? 0.85 : 0.4,
                }} />
              </div>
              <span style={{
                fontFamily: C.mono, fontSize: 12.5, fontVariantNumeric: "tabular-nums",
                color: v < 0 ? C.red : v > 0 ? C.grn : C.muted,
              }}>{v > 0 ? "+" : ""}{v}pp</span>
              {p.comparable
                ? <Micro style={{ fontSize: 9 }}>{Math.round(p.entryShare * 100)}% take it</Micro>
                : <Chip tone="warn">only {Math.round(p.entryShare * 100)}% — selected</Chip>}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 12, padding: "13px 15px", borderRadius: 10,
        border: `1px solid ${C.amb}44`, background: C.ambS, maxWidth: "82ch",
      }}>
        <Chip tone="warn" style={{ marginBottom: 8, display: "inline-block" }}>Read the entry column first</Chip>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>
          Biology looks like the easiest subject in this table at almost every starting point. It is not.
          Only about a tenth of pupils in the middle bands sit separate Biology rather than Combined Science,
          so that cohort is heavily selected and its pass rate describes who was entered, not the
          qualification. Maths and English Language are the only near-universal entries and the only fair
          baseline — which is why the greyed rows are greyed.
        </div>
      </div>

      <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
        {[SUBJECT_FINDINGS.combinedScience, SUBJECT_FINDINGS.thresholdSwap].map((f) => (
          <div key={f.headline} style={{
            padding: "14px 16px", borderRadius: 10,
            border: `1px solid ${C.accent}44`, background: "rgba(88,224,194,0.05)",
          }}>
            <div style={{ fontFamily: C.serif, fontSize: 17, lineHeight: 1.4, color: C.text, marginBottom: 9 }}>{f.headline}</div>
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7 }}>{f.detail}</div>
          </div>
        ))}
      </div>

      {/* the raw per-subject curves */}
      <div style={{ marginTop: 16, border: `1px solid ${C.rule}`, borderRadius: 10, overflowX: "auto" }} className="intel-scroll">
        <div style={{ minWidth: 700 }}>
          <div style={{ display: "grid", gridTemplateColumns: `150px repeat(${TRANSITION.length}, 1fr)`, gap: 6, padding: "10px 15px", borderBottom: `1px solid ${C.ruleStrong}` }}>
            <Micro style={{ fontSize: 9 }}>Subject · % {threshold === "pct4" ? "9–4" : "9–5"}</Micro>
            {TRANSITION.map((t) => (
              <Micro key={t.band} style={{ fontSize: 8, letterSpacing: "0.08em", textAlign: "center" }}>{t.mid}</Micro>
            ))}
          </div>
          {SUBJECT_TRANSITION.map((s, i) => (
            <div key={s.key} style={{
              display: "grid", gridTemplateColumns: `150px repeat(${TRANSITION.length}, 1fr)`,
              gap: 6, padding: "7px 15px", alignItems: "center",
              borderTop: i ? `1px solid ${C.rule}` : "none",
            }}>
              <span style={{ fontSize: 12.5, color: C.text }}>{s.name}</span>
              {TRANSITION.map((t) => {
                const r = s.rows.find((x) => x.band === t.band);
                const v = r ? r[threshold] : null;
                const here = t.band === band;
                return (
                  <span key={t.band} style={{
                    fontFamily: C.mono, fontSize: 10.5, textAlign: "center", padding: "3px 0",
                    borderRadius: 4, fontVariantNumeric: "tabular-nums",
                    // Ink flips with the fill: dark text needs a saturated cell
                    // behind it, and low values leave the cell nearly
                    // transparent against a dark page.
                    color: v == null ? C.faint : v >= 45 ? "#06101e" : C.text,
                    background: v == null ? "transparent" : `rgba(88,224,194,${0.1 + (v / 100) * 0.82})`,
                    outline: here ? `1px solid ${C.accent}` : "none",
                  }}>{v == null ? "—" : v}</span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.6, marginTop: 9 }}>
        Columns are KS2 band midpoints. The outlined column is the starting point selected above.
      </div>
    </>
  );
}

/** 100 dots. Counts of children, not a percentage bar — a percentage invites
 *  you to round it away; a hundred dots make you look at the ones who did not. */
function Dots({ pct4, pct5 }: { pct4: number; pct5: number }) {
  const n5 = Math.round(pct5);
  const n4 = Math.round(pct4) - n5;
  const nNone = 100 - n5 - n4;
  const dot = (bg: string, key: string, i: number) => (
    <span key={key} className="intel-pop" style={{
      width: 13, height: 13, borderRadius: 3, background: bg,
      animationDelay: `${Math.min(i * 5, 500)}ms`,
    }} />
  );
  let i = 0;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 470, marginBottom: 12 }}>
        {Array.from({ length: n5 }, () => dot(C.grn, `a${i}`, i++))}
        {Array.from({ length: n4 }, () => dot("rgba(88,224,194,0.42)", `b${i}`, i++))}
        {Array.from({ length: nNone }, () => dot("rgba(255,107,138,0.55)", `c${i}`, i++))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Legend colour={C.grn} label={`${n5} reached grade 5+`} />
        <Legend colour="rgba(88,224,194,0.42)" label={`${n4} reached grade 4, not 5`} />
        <Legend colour="rgba(255,107,138,0.55)" label={`${nNone} did not reach grade 4`} />
      </div>
    </div>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: colour }} />
      <span style={{ fontFamily: C.mono, fontSize: 10.5, color: C.muted, letterSpacing: "0.04em" }}>{label}</span>
    </span>
  );
}
