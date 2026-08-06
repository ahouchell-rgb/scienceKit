import { C } from "@/lib/theme";

const statusColour = (score: number) => score >= 80 ? C.red : score >= 65 ? C.amb : C.grn;
const displayDate = (value: unknown) => {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-GB") : "—";
};

export function DailyBriefing({
  signals,
  summary,
  onRunCycle,
  canRunCycle,
  busy,
}: {
  signals: any[];
  summary?: Record<string, any> | null;
  onRunCycle: () => void;
  canRunCycle: boolean;
  busy: boolean;
}) {
  const topSignals = signals.slice(0, 4);
  return (
    <section style={panelStyle} aria-labelledby="daily-briefing-title">
      <div style={headStyle}>
        <div>
          <div style={eyebrowStyle}>Today’s intelligence briefing</div>
          <h2 id="daily-briefing-title" style={titleStyle}>What changed, what matters, what needs a human?</h2>
        </div>
        {canRunCycle && (
          <button type="button" style={buttonStyle} disabled={busy} onClick={onRunCycle}>
            {busy ? "Updating the brain…" : "Run intelligence cycle"}
          </button>
        )}
      </div>
      <div style={metricsStyle}>
        <Metric value={summary?.active_signals || signals.length} label="active signals" />
        <Metric value={summary?.high_materiality_signals || 0} label="high materiality" />
        <Metric value={summary?.decision_memory_segments || 0} label="learned response contexts" />
        <Metric value={displayDate(summary?.signals_refreshed_at)} label="evidence refreshed" />
      </div>
      {topSignals.length ? (
        <div style={signalGridStyle}>
          {topSignals.map((signal) => {
            const materiality = Number(signal.materiality_score || 0);
            return (
              <article key={signal.id} style={signalStyle}>
                <div style={signalMetaStyle}>
                  <span>{String(signal.signal_type || "signal").replaceAll("_", " ")}</span>
                  <span style={{ color: statusColour(materiality) }}>{Math.round(materiality)} materiality</span>
                </div>
                <strong style={{ color: C.text, fontSize: 13 }}>{signal.headline}</strong>
                <p style={copyStyle}>{signal.summary}</p>
                <div style={signalMetaStyle}>
                  <span>{Math.round(Number(signal.confidence || 0) * 100)}% evidence confidence</span>
                  <span>as of {displayDate(signal.evidence_as_of)}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div style={emptyStyle}>No material class or school signals currently meet the minimum evidence threshold.</div>
      )}
    </section>
  );
}

function Metric({ value, label }: { value: unknown; label: string }) {
  return (
    <div style={metricStyle}>
      <strong style={{ color: C.text, fontFamily: C.serif, fontSize: 24, fontWeight: 400 }}>{String(value ?? 0)}</strong>
      <span style={signalMetaStyle}>{label}</span>
    </div>
  );
}

const panelStyle: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 16, background: C.surface, padding: 18, marginTop: 16 };
const headStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" };
const eyebrowStyle: React.CSSProperties = { color: C.grn, fontFamily: C.mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" };
const titleStyle: React.CSSProperties = { color: C.text, fontFamily: C.serif, fontSize: 26, fontWeight: 400, margin: "6px 0 0" };
const metricsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginTop: 16 };
const metricStyle: React.CSSProperties = { border: `1px solid ${C.rule}`, borderRadius: 10, padding: 11, display: "grid", gap: 3 };
const signalGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10, marginTop: 12 };
const signalStyle: React.CSSProperties = { border: `1px solid ${C.rule}`, borderRadius: 11, padding: 12, display: "grid", gap: 8 };
const signalMetaStyle: React.CSSProperties = { color: C.dim, fontFamily: C.mono, fontSize: 8.5, lineHeight: 1.45, display: "flex", justifyContent: "space-between", gap: 8, textTransform: "uppercase" };
const copyStyle: React.CSSProperties = { color: C.muted, fontSize: 11, lineHeight: 1.55, margin: 0 };
const emptyStyle: React.CSSProperties = { color: C.dim, fontSize: 11, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 14, marginTop: 12 };
const buttonStyle: React.CSSProperties = { border: `1px solid ${C.grn}`, background: C.grn, color: C.bg, borderRadius: 9, padding: "9px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer" };
