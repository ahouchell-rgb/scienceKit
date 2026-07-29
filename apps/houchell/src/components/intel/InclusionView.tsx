"use client";
/* Equality monitoring — SEN, EAL and ethnicity, within KS2 starting point.

   This screen is deliberately isolated from the rest of the console. It shows
   national aggregates only, it never resolves a pupil, and `analytics.ts` does
   not import the module behind it. DPA 2018 Sch 1 para 8(3) permits this data
   for reviewing equality of opportunity and explicitly forbids it for
   "measures or decisions with respect to a particular data subject" — so the
   separation is architectural, not a setting. */

import { C } from "@/lib/theme";
import { Chip, Micro, Rule } from "./ui";
import {
  EAL_WITHIN_BAND, ENGLISH_FIRST_WITHIN_BAND, EQUALITY_FINDINGS,
  ETHNICITY_WITHIN_BAND, LAWFUL_USE, SEN_WITHIN_BAND,
  cohortPct4, deviations, widestGap, type EqualityGroup,
} from "@/lib/intel/equality";
import { TRANSITION } from "@/lib/intel/progression";

const BANDS = TRANSITION.map((t) => t.band);

export function InclusionView() {
  return (
    <div className="intel-fade" style={{ maxWidth: 1000 }}>
      <Micro style={{ marginBottom: 10 }}>Equality monitoring · national aggregate only</Micro>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 34, lineHeight: 1.12, marginBottom: 12 }}>
        Same starting point, different group
      </h1>
      <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.65, maxWidth: "70ch", marginBottom: 16 }}>
        Every comparison here holds KS2 prior attainment constant. That removes the usual explanation —
        "they arrived further behind" — and leaves the part that happened between Year 7 and Year 11.
      </p>

      {/* The legal frame, stated before the data rather than after it. */}
      <div style={{
        padding: "15px 17px", borderRadius: 11, border: `1px solid ${C.blu}55`,
        background: C.bluS, marginBottom: 10, maxWidth: "84ch",
      }}>
        <Chip tone="info" style={{ marginBottom: 10, display: "inline-block" }}>What this may and may not be used for</Chip>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7, marginBottom: 10 }}>
          <strong style={{ color: C.grn }}>Permitted.</strong> {LAWFUL_USE.permitted}
        </div>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>
          <strong style={{ color: C.red }}>Prohibited.</strong> {LAWFUL_USE.prohibited}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.6, maxWidth: "80ch", marginBottom: 6 }}>
        The console enforces this by construction: this module holds no pupil-grain data and the analytics
        engine does not import it. Nothing on this screen can reach a finding about a named child.
      </div>

      <GroupChart group={SEN_WITHIN_BAND} tone={C.red} />
      <EalChart />
      <EthnicityChart />

      <Rule label="What the three cuts say" />
      <div style={{ display: "grid", gap: 10 }}>
        {EQUALITY_FINDINGS.map((f, i) => (
          <div key={f.key} className="intel-rise" style={{
            animationDelay: `${i * 60}ms`, padding: "15px 17px", borderRadius: 11,
            border: `1px solid ${C.accent}44`, background: "rgba(88,224,194,0.05)",
          }}>
            <div style={{ fontFamily: C.serif, fontSize: 18, lineHeight: 1.4, color: C.text, marginBottom: 10 }}>{f.headline}</div>
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, marginBottom: 10 }}>{f.detail}</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, paddingLeft: 12, borderLeft: `2px solid ${C.accent}66` }}>
              {f.action}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}

/* ─── One group against the cohort ─────────────────────────────────────── */

function GroupChart({ group, tone }: { group: EqualityGroup; tone: string }) {
  const devs = deviations(group);
  const widest = widestGap(group);
  return (
    <>
      <Rule label={group.label} />
      <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, maxWidth: "74ch", marginBottom: 14 }}>
        {group.summary}
      </p>
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
        <Head cols={["KS2 band", "This group", "All pupils", "Difference"]} />
        {devs.map((d, i) => {
          const isWidest = widest?.band === d.band;
          return (
            <div key={d.band} style={{
              display: "grid", gridTemplateColumns: "132px 92px 92px 1fr",
              gap: 12, padding: "9px 15px", alignItems: "center",
              borderTop: i ? `1px solid ${C.rule}` : "none",
              background: isWidest ? "rgba(255,107,138,0.08)" : "transparent",
            }}>
              <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.muted }}>{d.band}</span>
              <span style={{ fontFamily: C.mono, fontSize: 12.5, color: tone, fontVariantNumeric: "tabular-nums" }}>{d.pct4}%</span>
              <span style={{ fontFamily: C.mono, fontSize: 12.5, color: C.dim, fontVariantNumeric: "tabular-nums" }}>{cohortPct4(d.band)}%</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bar v={d.vsCohort} />
                <span style={{ fontFamily: C.mono, fontSize: 11.5, color: d.vsCohort < 0 ? C.red : C.grn, minWidth: 52 }}>
                  {d.vsCohort > 0 ? "+" : ""}{d.vsCohort}pp
                </span>
                {isWidest && <Chip tone="bad">widest</Chip>}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── EAL vs English first language ────────────────────────────────────── */

function EalChart() {
  return (
    <>
      <Rule label="First language" />
      <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, maxWidth: "74ch", marginBottom: 14 }}>
        {EAL_WITHIN_BAND.summary}
      </p>
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
        <Head cols={["KS2 band", "EAL", "English first", "EAL advantage"]} />
        {BANDS.map((band, i) => {
          const e = EAL_WITHIN_BAND.rows.find((r) => r.band === band)?.pct4 ?? 0;
          const n = ENGLISH_FIRST_WITHIN_BAND.rows.find((r) => r.band === band)?.pct4 ?? 0;
          const d = Math.round((e - n) * 10) / 10;
          return (
            <div key={band} style={{
              display: "grid", gridTemplateColumns: "132px 92px 92px 1fr",
              gap: 12, padding: "9px 15px", alignItems: "center",
              borderTop: i ? `1px solid ${C.rule}` : "none",
            }}>
              <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.muted }}>{band}</span>
              <span style={{ fontFamily: C.mono, fontSize: 12.5, color: C.grn, fontVariantNumeric: "tabular-nums" }}>{e}%</span>
              <span style={{ fontFamily: C.mono, fontSize: 12.5, color: C.dim, fontVariantNumeric: "tabular-nums" }}>{n}%</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bar v={d} max={20} />
                <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.grn, minWidth: 52 }}>+{d}pp</span>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 12, padding: "14px 16px", borderRadius: 10,
        border: `1px solid ${C.amb}55`, background: C.ambS, maxWidth: "84ch",
      }}>
        <Chip tone="warn" style={{ marginBottom: 9, display: "inline-block" }}>A bias this console had, and no longer has</Chip>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7 }}>
          The literacy finding originally offered "EAL — decoding is fine, subject vocabulary is not" as an
          explanation for low scores. That reads as reasonable and is wrong: at the same starting point EAL
          pupils do <em>better</em>, not worse. A reading-age flag means something different for a bilingual
          pupil, and any rule that treats the two identically will quietly become a machine for
          mis-flagging them. The hypothesis now returns <strong>ruled out</strong> with this evidence attached.
        </div>
      </div>
    </>
  );
}

/* ─── Ethnicity ────────────────────────────────────────────────────────── */

function ETH_COLOUR(key: string) {
  return { asian: C.accent, black: C.accent2, mixed: C.amb, white: C.red }[key] ?? C.muted;
}

function EthnicityChart() {
  return (
    <>
      <Rule label="Ethnicity — major groups" />
      <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7, maxWidth: "76ch", marginBottom: 14 }}>
        The ordering is identical in all eleven bands. Shown for equality monitoring only; it cannot and must
        not inform anything about an individual pupil.
      </p>
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflowX: "auto" }} className="intel-scroll">
        <div style={{ minWidth: 640 }}>
          <Head cols={["KS2 band", ...ETHNICITY_WITHIN_BAND.map((g) => g.label.split(" ")[0]), "All pupils"]}
                grid={`132px repeat(${ETHNICITY_WITHIN_BAND.length + 1}, 1fr)`} />
          {BANDS.map((band, i) => (
            <div key={band} style={{
              display: "grid", gridTemplateColumns: `132px repeat(${ETHNICITY_WITHIN_BAND.length + 1}, 1fr)`,
              gap: 12, padding: "9px 15px", alignItems: "center",
              borderTop: i ? `1px solid ${C.rule}` : "none",
            }}>
              <span style={{ fontFamily: C.mono, fontSize: 11.5, color: C.muted }}>{band}</span>
              {ETHNICITY_WITHIN_BAND.map((g) => {
                const v = g.rows.find((r) => r.band === band)?.pct4;
                return (
                  <span key={g.key} style={{
                    fontFamily: C.mono, fontSize: 12, textAlign: "center",
                    color: ETH_COLOUR(g.key), fontVariantNumeric: "tabular-nums",
                  }}>{v == null ? "—" : `${v}%`}</span>
                );
              })}
              <span style={{ fontFamily: C.mono, fontSize: 12, textAlign: "center", color: C.dim, fontVariantNumeric: "tabular-nums" }}>
                {cohortPct4(band)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
        {ETHNICITY_WITHIN_BAND.map((g) => (
          <span key={g.key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: ETH_COLOUR(g.key) }} />
            <span style={{ fontSize: 11.5, color: C.muted }}>{g.label}</span>
          </span>
        ))}
      </div>
    </>
  );
}

/* ─── Bits ─────────────────────────────────────────────────────────────── */

function Head({ cols, grid = "132px 92px 92px 1fr" }: { cols: string[]; grid?: string }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: grid, gap: 12,
      padding: "10px 15px", borderBottom: `1px solid ${C.ruleStrong}`,
    }}>
      {cols.map((c, i) => (
        <Micro key={c + i} style={{ fontSize: 9, textAlign: i > 0 && cols.length > 4 ? "center" : "left" }}>{c}</Micro>
      ))}
    </div>
  );
}

function Bar({ v, max = 20 }: { v: number; max?: number }) {
  const frac = Math.min(1, Math.abs(v) / max);
  const neg = v < 0;
  return (
    <span style={{ position: "relative", flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, minWidth: 90 }}>
      <span style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: C.ruleStrong }} />
      <span style={{
        position: "absolute", top: 0, bottom: 0,
        left: neg ? "auto" : "50%", right: neg ? "50%" : "auto",
        width: `${frac * 50}%`, borderRadius: 4,
        background: neg ? C.red : C.grn, opacity: 0.85,
      }} />
    </span>
  );
}
