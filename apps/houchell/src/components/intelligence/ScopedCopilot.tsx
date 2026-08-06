"use client";

import { useState, useTransition } from "react";
import type { CopilotResponse } from "@/lib/intelligence/contracts";
import { intelligenceFetch } from "@/lib/intelligence/client";
import { C } from "@/lib/theme";

const STARTERS = [
  "What needs teaching next?",
  "Which evidence should I check first?",
  "What has the response loop learned?",
] as const;

export function ScopedCopilot({ schoolId }: { schoolId: string }) {
  const [message, setMessage] = useState<string>(STARTERS[0]);
  const [result, setResult] = useState<CopilotResponse | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");

  const ask = () => {
    if (message.trim().length < 3) return;
    startTransition(async () => {
      setError("");
      try {
        const next = await intelligenceFetch<CopilotResponse>("/api/intelligence/copilot", {
          method: "POST",
          body: JSON.stringify({ schoolId, message }),
        });
        setResult(next);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The copilot could not answer");
      }
    });
  };

  return (
    <section style={panelStyle} aria-labelledby="copilot-title">
      <div style={eyebrowStyle}>Scoped education copilot</div>
      <h2 id="copilot-title" style={titleStyle}>Ask the school’s evidence</h2>
      <p style={copyStyle}>Read-only, role-scoped and citation-bound. It cannot reveal restricted pupil data or take a decision for you.</p>
      <div style={starterStyle}>
        {STARTERS.map((starter) => (
          <button key={starter} type="button" style={chipStyle} onClick={() => setMessage(starter)}>{starter}</button>
        ))}
      </div>
      <textarea
        aria-label="Question for the education copilot"
        value={message}
        maxLength={2000}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") ask();
        }}
        style={inputStyle}
      />
      <button type="button" style={buttonStyle} disabled={busy || message.trim().length < 3} onClick={ask}>
        {busy ? "Reading scoped evidence…" : "Ask School Intelligence"}
      </button>
      {error && <div role="alert" style={{ ...resultStyle, color: C.red }}>{error}</div>}
      {result && (
        <div style={resultStyle}>
          <div style={statusStyle}>{result.status.replaceAll("_", " ")}</div>
          <p style={{ ...copyStyle, color: C.text, fontSize: 12 }}>{result.answer.answer}</p>
          {result.answer.citations.length > 0 && (
            <div style={{ display: "grid", gap: 5 }}>
              {result.answer.citations.map((citation) => (
                <div key={`${citation.ref}:${citation.label}`} style={citationStyle}>↳ {citation.label}</div>
              ))}
            </div>
          )}
          {result.answer.suggestedActions.length > 0 && (
            <div style={starterStyle}>
              {result.answer.suggestedActions.map((action) => (
                <a key={`${action.href}:${action.label}`} href={action.href} style={actionStyle}>{action.label} →</a>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const panelStyle: React.CSSProperties = { border: `1px solid ${C.border}`, borderRadius: 14, background: C.surface, padding: 18, display: "grid", gap: 10 };
const eyebrowStyle: React.CSSProperties = { color: C.grn, fontFamily: C.mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" };
const titleStyle: React.CSSProperties = { color: C.text, fontFamily: C.serif, fontSize: 24, fontWeight: 400, margin: 0 };
const copyStyle: React.CSSProperties = { color: C.muted, fontSize: 11, lineHeight: 1.55, margin: 0 };
const starterStyle: React.CSSProperties = { display: "flex", gap: 7, flexWrap: "wrap" };
const chipStyle: React.CSSProperties = { border: `1px solid ${C.rule}`, background: C.bg, color: C.muted, borderRadius: 999, padding: "6px 9px", fontSize: 9, cursor: "pointer" };
const inputStyle: React.CSSProperties = { width: "100%", minHeight: 82, resize: "vertical", border: `1px solid ${C.border}`, background: C.bg, color: C.text, borderRadius: 9, padding: 10, fontSize: 11, lineHeight: 1.5, boxSizing: "border-box" };
const buttonStyle: React.CSSProperties = { border: `1px solid ${C.grn}`, background: C.grn, color: C.bg, borderRadius: 9, padding: "9px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer", justifySelf: "start" };
const resultStyle: React.CSSProperties = { borderTop: `1px solid ${C.rule}`, paddingTop: 12, display: "grid", gap: 9 };
const statusStyle: React.CSSProperties = { color: C.grn, fontFamily: C.mono, fontSize: 8, textTransform: "uppercase" };
const citationStyle: React.CSSProperties = { color: C.dim, fontFamily: C.mono, fontSize: 8.5 };
const actionStyle: React.CSSProperties = { color: C.grn, fontSize: 10, textDecoration: "none" };
