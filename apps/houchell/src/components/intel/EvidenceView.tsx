"use client";
/* The evidence base, on screen.

   Every coefficient the console relies on, what it is, where it came from, and
   whether it is a published figure or something we assumed. A buyer, a DPO or
   a sceptical head of department can read this page and check our working —
   which is the entire posture the ICO's edtech audit says the sector fails at.

   The `assumed` rows are shown in the same table as the published ones, with
   the same prominence. Hiding your assumptions among your evidence is how you
   end up believing them. */

import { C } from "@/lib/theme";
import { Chip, Micro, Rule } from "./ui";
import { EVIDENCE_BASE, provenanceCount, type Coefficient, type Provenance } from "@/lib/intel/evidence";

const TONE: Record<Provenance, "good" | "info" | "warn"> = {
  published: "good", derived: "info", assumed: "warn",
};

const EXPLAIN: Record<Provenance, string> = {
  published: "Stated in a named, checkable study.",
  derived: "Arithmetic on a published figure — traceable back to one.",
  assumed: "Our modelling choice. NOT evidence. Test this first.",
};

function CoefficientRow({ c, i }: { c: Coefficient; i: number }) {
  const attenuated = c.controlled != null;
  return (
    <div className="intel-rise" style={{
      animationDelay: `${i * 32}ms`, padding: "14px 16px",
      borderTop: i ? `1px solid ${C.rule}` : "none",
      background: c.provenance === "assumed" ? "rgba(255,209,102,0.045)" : "transparent",
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 14.5, color: C.text, flex: 1, minWidth: 220, lineHeight: 1.4 }}>{c.label}</span>

        {attenuated ? (
          <span style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: C.mono, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ fontSize: 16, color: C.red, textDecoration: "line-through", opacity: 0.75 }}>{c.value}</span>
            <span style={{ color: C.faint, fontSize: 12 }}>→</span>
            <span style={{ fontSize: 19, color: C.grn, fontWeight: 600 }}>{c.controlled}</span>
            <span style={{ fontSize: 10.5, color: C.dim }}>{c.unit}</span>
          </span>
        ) : (
          <span style={{ fontFamily: C.mono, fontSize: 19, color: C.text, fontVariantNumeric: "tabular-nums" }}>
            {c.value}<span style={{ fontSize: 10.5, color: C.dim, marginLeft: 5 }}>{c.unit}</span>
          </span>
        )}

        <span title={EXPLAIN[c.provenance]}><Chip tone={TONE[c.provenance]}>{c.provenance}</Chip></span>
      </div>

      {attenuated && (
        <div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.amb, marginBottom: 7, letterSpacing: "0.04em" }}>
          RAW → CONTROLLED FOR PRIOR ATTAINMENT · the difference is confounding, not effect
        </div>
      )}

      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: "82ch" }}>{c.note}</div>

      {c.citation && (
        <a href={c.citation.url} target="_blank" rel="noreferrer" style={{
          display: "inline-flex", alignItems: "center", gap: 7, marginTop: 9,
          fontFamily: C.mono, fontSize: 10.5, color: C.accent, textDecoration: "none",
          letterSpacing: "0.04em",
        }}>
          <span aria-hidden>↗</span>
          {c.citation.source} ({c.citation.year}){c.citation.n ? ` · ${c.citation.n}` : ""}
        </a>
      )}
    </div>
  );
}

export function EvidenceView() {
  const counts = provenanceCount();

  return (
    <div className="intel-fade" style={{ maxWidth: 1000 }}>
      <Micro style={{ marginBottom: 10 }}>Show your working</Micro>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 34, lineHeight: 1.12, marginBottom: 12 }}>
        The evidence base
      </h1>
      <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.65, maxWidth: "68ch", marginBottom: 12 }}>
        Every coefficient this console relies on, with the study it came from. The synthetic
        cohort is calibrated to these figures, so the model cannot drift away from its own
        evidence base without this page changing too.
      </p>

      <div style={{
        padding: "14px 16px", borderRadius: 10, border: `1px solid ${C.amb}44`,
        background: C.ambS, marginBottom: 8, maxWidth: "80ch",
      }}>
        <Chip tone="warn" style={{ marginBottom: 8, display: "inline-block" }}>Read this first</Chip>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65 }}>
          Most published education statistics are <strong>raw associations</strong>. Absence, exclusion
          and disadvantage are heavily confounded with prior attainment and with each other. Where a
          controlled estimate exists it is roughly <strong>half</strong> the raw one. Quoting the raw
          figure as if it were an effect is the most common analytical error in this sector — and it is
          how a school spends a year chasing a return that was never there.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <Chip tone="good">{counts.published} published</Chip>
        <Chip tone="info">{counts.derived} derived</Chip>
        <Chip tone="warn">{counts.assumed} assumed</Chip>
      </div>

      {EVIDENCE_BASE.map((group) => (
        <div key={group.key}>
          <Rule label={group.title} />
          <p style={{ fontSize: 13, color: C.faint, lineHeight: 1.6, marginBottom: 12, maxWidth: "70ch" }}>
            {group.question}
          </p>
          <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
            {group.coefficients.map((c, i) => <CoefficientRow key={c.key} c={c} i={i} />)}
          </div>
        </div>
      ))}

      <Rule label="What this model gets wrong" />
      <div style={{ display: "grid", gap: 8, maxWidth: "80ch" }}>
        {[
          "The scaffolding assumption is the load-bearing guess. It is our explanation for why a subject with a high reading correlation can still show no within-pupil gap. A pilot should test it first: read a maths paper aloud to a matched group and see whether the gap collapses.",
          "Year 7 reading calibration misses. We reproduce the Year 11 figure (25% at 12y or below) but land ~7% of Year 7s at reading age 15+, against a published 20%. The two figures are hard to reconcile with one distribution per year group; we calibrated to the one that drives the product.",
          "Absolute absence magnitudes run about 1.4× FFT's, because our comparison bands and control set are cruder than theirs. The ratio — 52% attenuation against their ~50% — is what is calibrated, and it is what the argument depends on.",
          "Everything here is synthetic. No real pupil has touched this console.",
        ].map((t, i) => (
          <div key={i} style={{
            padding: "12px 15px", borderRadius: 9, border: `1px dashed ${C.rule}`,
            fontSize: 13, color: C.muted, lineHeight: 1.6,
          }}>{t}</div>
        ))}
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
