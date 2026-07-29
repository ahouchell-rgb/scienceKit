"use client";
/* Console primitives. Motion here is functional, not decorative: things enter
   in the order you should read them, numbers count so you notice they changed,
   and anything you can act on responds within 120ms. */

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme";

export const INTEL_CSS = `
@keyframes intel-rise { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: none; } }
@keyframes intel-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes intel-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes intel-pop  { 0% { transform: scale(0.94); opacity: 0; } 60% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
@keyframes intel-sweep { from { background-position: 200% 0; } to { background-position: -200% 0; } }

.intel-rise { animation: intel-rise 420ms cubic-bezier(0.16,1,0.3,1) both; }
.intel-pop  { animation: intel-pop 260ms cubic-bezier(0.16,1,0.3,1) both; }
.intel-fade { animation: intel-fade 300ms ease both; }

.intel-card {
  transition: transform 140ms cubic-bezier(0.16,1,0.3,1), border-color 140ms ease, background 140ms ease, box-shadow 200ms ease;
  will-change: transform;
}
.intel-card:hover, .intel-card[data-cursor="1"] {
  transform: translateY(-2px);
  border-color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.085);
  box-shadow: 0 18px 44px rgba(0,0,0,0.42);
}
.intel-card[data-cursor="1"] { border-color: ${C.accent}; box-shadow: 0 0 0 1px ${C.accent}, 0 18px 44px rgba(0,0,0,0.42); }
.intel-card:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }

.intel-btn {
  transition: transform 110ms cubic-bezier(0.16,1,0.3,1), background 140ms ease, border-color 140ms ease, opacity 140ms ease;
}
.intel-btn:not(:disabled):hover { transform: translateY(-1px); background: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.32); }
.intel-btn:not(:disabled):active { transform: translateY(0) scale(0.985); }
.intel-btn:disabled { opacity: 0.42; cursor: not-allowed; }

.intel-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.intel-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 9px; }
.intel-scroll::-webkit-scrollbar-track { background: transparent; }

@media (prefers-reduced-motion: reduce) {
  .intel-rise, .intel-pop, .intel-fade { animation: none !important; }
  .intel-card, .intel-btn { transition: none !important; }
  .intel-card:hover, .intel-btn:hover { transform: none !important; }
}
`;

/* ─── Type ─────────────────────────────────────────────────────────────── */

export function Micro({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontFamily: C.mono, fontSize: 9.5, letterSpacing: "0.24em", textTransform: "uppercase", color: C.dim, ...style }}>
      {children}
    </div>
  );
}

export function Rule({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "26px 0 14px" }}>
      <Micro>{label}</Micro>
      <span style={{ flex: 1, height: 1, background: C.rule }} />
    </div>
  );
}

/* ─── Chips ────────────────────────────────────────────────────────────── */

export function Chip({
  children, tone = "neutral", solid = false, style,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "info";
  solid?: boolean;
  style?: React.CSSProperties;
}) {
  const map = {
    neutral: { fg: C.muted, bg: "rgba(255,255,255,0.07)" },
    good: { fg: C.grn, bg: C.grnS },
    bad: { fg: C.red, bg: C.redS },
    warn: { fg: C.amb, bg: C.ambS },
    info: { fg: C.blu, bg: C.bluS },
  }[tone];
  return (
    <span style={{
      fontFamily: C.mono, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase",
      color: solid ? C.accentFg : map.fg, background: solid ? map.fg : map.bg,
      padding: "3px 7px", borderRadius: 4, whiteSpace: "nowrap",
      border: `1px solid ${solid ? "transparent" : map.fg + "33"}`, ...style,
    }}>{children}</span>
  );
}

/* ─── Count-up ─────────────────────────────────────────────────────────── */

export function useCountUp(target: number, ms = 620) {
  const [v, setV] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setV(target); return;
    }
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      // easeOutExpo — fast, then settles. Reads as "landing on" a number.
      setV(target * (k === 1 ? 1 : 1 - Math.pow(2, -10 * k)));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    // Safety net: requestAnimationFrame is throttled or suspended in
    // backgrounded and headless tabs, which would leave every figure on the
    // page reading zero. A wrong number is far worse than a missing animation.
    const settle = setTimeout(() => setV(target), ms + 120);
    return () => { cancelAnimationFrame(raf.current); clearTimeout(settle); };
  }, [target, ms]);
  return v;
}

export function StatTile({ label, value, hint, delay = 0 }: { label: string; value: string; hint?: string; delay?: number }) {
  // Count the leading number if there is one; keep any suffix (%, pts).
  const numeric = /^-?[\d,]+(\.\d+)?/.exec(value.replace(/,/g, ""));
  const target = numeric ? parseFloat(numeric[0]) : null;
  const animated = useCountUp(target ?? 0);
  const shown = target != null
    ? value.replace(/^-?[\d,]+(\.\d+)?/, Math.round(animated).toLocaleString("en-GB"))
    : value;
  return (
    <div className="intel-rise" style={{
      animationDelay: `${delay}ms`, padding: "13px 15px", borderRadius: 10,
      border: `1px solid ${C.rule}`, background: "rgba(255,255,255,0.045)", minWidth: 0,
    }} title={hint}>
      <Micro>{label}</Micro>
      <div style={{ fontFamily: C.serif, fontSize: 30, lineHeight: 1.12, marginTop: 5, color: C.text, fontVariantNumeric: "tabular-nums" }}>
        {shown}
      </div>
      {hint && <div style={{ fontSize: 11, color: C.faint, marginTop: 4, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

/* ─── Effect meter ─────────────────────────────────────────────────────── */

/** Signed effect in standardised points, drawn from a centre line. Negative
 *  runs left in red; positive runs right in mint. */
export function EffectMeter({ effect, max = 12, delay = 0 }: { effect: number; max?: number; delay?: number }) {
  const frac = Math.min(1, Math.abs(effect) / max);
  const neg = effect < 0;
  return (
    <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.ruleStrong }} />
      <div
        className="intel-fade"
        style={{
          position: "absolute", top: 0, bottom: 0,
          // Both edges are always specified. Setting only one and swapping which
          // one across renders leaves the previous value in place — React warns
          // about exactly this, and a bar whose effect flips sign would smear.
          left: neg ? "auto" : "50%",
          right: neg ? "50%" : "auto",
          width: `${frac * 50}%`,
          background: neg ? C.red : C.grn, opacity: 0.85,
          transformOrigin: neg ? "right" : "left",
          animation: `intel-grow 560ms cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
        } as React.CSSProperties}
      />
    </div>
  );
}

/* ─── Sparkline over the four assessment windows ───────────────────────── */

export function Spark({ points, w = 96, h = 30, colour = C.accent }: { points: number[]; w?: number; h?: number; colour?: string }) {
  const clean = points.filter((p) => p != null && !Number.isNaN(p));
  if (clean.length < 2) return null;
  const min = Math.min(...clean), max = Math.max(...clean);
  const span = Math.max(1, max - min);
  const x = (i: number) => (i / (clean.length - 1)) * (w - 6) + 3;
  const y = (v: number) => h - 4 - ((v - min) / span) * (h - 8);
  const d = clean.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }} aria-hidden>
      <path d={d} fill="none" stroke={colour} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      <circle cx={x(clean.length - 1)} cy={y(clean[clean.length - 1])} r={2.6} fill={colour} />
    </svg>
  );
}

/* ─── Buttons ──────────────────────────────────────────────────────────── */

export function Btn({
  children, onClick, disabled, title, primary, small, style,
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  title?: string; primary?: boolean; small?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button
      className="intel-btn" onClick={onClick} disabled={disabled} title={title}
      style={{
        fontFamily: C.mono, fontSize: small ? 10.5 : 11.5, letterSpacing: "0.06em",
        padding: small ? "5px 10px" : "8px 14px", borderRadius: 7, cursor: "pointer",
        color: primary ? C.accentFg : C.text,
        background: primary ? C.accent : "rgba(255,255,255,0.075)",
        border: `1px solid ${primary ? "transparent" : C.border}`,
        ...style,
      }}
    >{children}</button>
  );
}

/** Keycap hint. The console is keyboard-first and should say so. */
export function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      fontFamily: C.mono, fontSize: 9.5, padding: "1.5px 5px", borderRadius: 4,
      border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.06)",
      color: C.muted, lineHeight: 1.5,
    }}>{children}</kbd>
  );
}
