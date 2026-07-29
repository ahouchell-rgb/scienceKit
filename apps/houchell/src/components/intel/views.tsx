"use client";
/* The three things you can be looking at: a board of findings, one finding
   opened up, or one child's trajectory. Everything else is navigation. */

import { useEffect, useState } from "react";
import { C } from "@/lib/theme";
import { Btn, Chip, EffectMeter, Micro, Rule, Spark, StatTile } from "./ui";
import {
  diagnose, profile, sd, type Finding, type Hypothesis, type TrajectoryChange,
} from "@/lib/intel/analytics";
import { SUBJECT_BY_KEY, WINDOWS, world } from "@/lib/intel/synth";
import { LEVEL_DEFS, type Viewer } from "@/lib/intel/scope";
import {
  ACTIONS, actionsOn, can, dispatch, humanNotesOn, subscribe,
  type ActionKey,
} from "@/lib/intel/actions";

const KIND_LABEL: Record<Finding["kind"], string> = {
  literacy_gate: "Literacy gate",
  slot: "Timetable slot",
  sequencing: "Sequencing",
  trajectory_change: "Trajectory",
  inclusion_gap: "Inclusion gap",
  suppressed: "Suppressed",
};

const strengthTone = (s: Finding["strength"]) =>
  s === "strong" ? "bad" : s === "moderate" ? "warn" : "neutral";

/* ─── Board ────────────────────────────────────────────────────────────── */

export function FindingCard({
  finding, index, cursor, onOpen,
}: { finding: Finding; index: number; cursor: boolean; onOpen: () => void }) {
  const subj = finding.subjectKey ? SUBJECT_BY_KEY[finding.subjectKey] : null;
  const acted = actionsOn(finding.id).length;

  if (finding.suppressed) {
    return (
      <div className="intel-rise" style={{
        animationDelay: `${index * 40}ms`, padding: "14px 16px", borderRadius: 10,
        border: `1px dashed ${C.rule}`, background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
          <Chip>Suppressed</Chip>
          {subj && <Micro style={{ color: subj.colour }}>{subj.name}</Micro>}
        </div>
        <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{finding.sub}</div>
      </div>
    );
  }

  return (
    <button
      className="intel-card intel-rise" data-cursor={cursor ? "1" : "0"}
      onClick={onOpen}
      style={{
        animationDelay: `${index * 45}ms`, textAlign: "left", width: "100%", cursor: "pointer",
        padding: "16px 18px", borderRadius: 12, border: `1px solid ${C.border}`,
        background: "rgba(255,255,255,0.05)", color: C.text, display: "block",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 9, flexWrap: "wrap" }}>
        <Chip tone="info">{KIND_LABEL[finding.kind]}</Chip>
        {subj && (
          <span style={{ fontFamily: C.mono, fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: subj.colour }}>
            {subj.name}
          </span>
        )}
        <Chip tone={strengthTone(finding.strength)}>{finding.strength}</Chip>
        {acted > 0 && <Chip tone="good">{acted} action{acted > 1 ? "s" : ""} taken</Chip>}
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, fontVariantNumeric: "tabular-nums" }}>
          n={finding.n.toLocaleString("en-GB")}
        </span>
      </div>

      <div style={{ fontFamily: C.serif, fontSize: 19, lineHeight: 1.28, marginBottom: 7, letterSpacing: "-0.005em" }}>
        {finding.headline}
      </div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, marginBottom: 13 }}>{finding.sub}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          fontFamily: C.mono, fontSize: 13, fontWeight: 600, minWidth: 52,
          color: finding.effect < 0 ? C.red : C.grn, fontVariantNumeric: "tabular-nums",
        }}>
          {finding.effect > 0 ? "+" : ""}{finding.effect}
        </span>
        <div style={{ flex: 1 }}><EffectMeter effect={finding.effect} delay={index * 45 + 120} /></div>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: C.faint }}>std. pts</span>
      </div>
    </button>
  );
}

/* ─── Verdict chip for a hypothesis ────────────────────────────────────── */

function VerdictChip({ v }: { v: Hypothesis["verdict"] }) {
  if (v === "supported") return <Chip tone="bad">Supported</Chip>;
  if (v === "unsupported") return <Chip tone="good">Ruled out</Chip>;
  return <Chip tone="warn">Undetermined</Chip>;
}

function Differential({ hyps }: { hyps: Hypothesis[] }) {
  return (
    <div style={{ display: "grid", gap: 9 }}>
      {hyps.map((h, i) => (
        <div key={h.name} className="intel-rise" style={{
          animationDelay: `${i * 45}ms`, padding: "13px 15px", borderRadius: 10,
          border: `1px solid ${h.verdict === "supported" ? C.red + "44" : C.rule}`,
          background: h.verdict === "supported" ? "rgba(255,107,138,0.05)" : "rgba(255,255,255,0.03)",
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 7 }}>
            <span style={{ fontFamily: C.mono, fontSize: 11, color: C.faint, minWidth: 16 }}>{h.rank}</span>
            <span style={{ fontSize: 14.5, color: C.text, fontWeight: 500, flex: 1, lineHeight: 1.4 }}>{h.name}</span>
            <VerdictChip v={h.verdict} />
          </div>
          <div style={{ paddingLeft: 26, display: "grid", gap: 6 }}>
            <Row k="Discriminating signal" v={h.discriminator} />
            <Row k="What we found" v={h.found} strong />
            <Row k="What would settle it" v={h.ruleOut} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, alignItems: "baseline" }}>
      <Micro style={{ fontSize: 9, letterSpacing: "0.14em" }}>{k}</Micro>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: strong ? C.text : C.muted }}>{v}</div>
    </div>
  );
}

/* ─── Action bar ───────────────────────────────────────────────────────── */

function ActionBar({ viewer, finding }: { viewer: Viewer; finding: Finding }) {
  const [, force] = useState(0);
  const [noteFor, setNoteFor] = useState<ActionKey | null>(null);
  const [note, setNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => subscribe(() => force((n) => n + 1)), []);

  const keys = [...finding.actions, "note_professional_judgement", "dismiss_finding"] as ActionKey[];
  const notes = humanNotesOn(finding.id);

  const run = (key: ActionKey, withNote?: string) => {
    const res = dispatch(viewer, key, { finding, note: withNote });
    setFlash(res.ok ? `${ACTIONS[key].label} — recorded` : res.error!);
    if (res.ok) { setNoteFor(null); setNote(""); }
    setTimeout(() => setFlash(null), 3800);
  };

  return (
    <div>
      {notes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Rule label="What the humans said — this outranks the analysis" />
          {notes.map((n) => (
            <div key={n.id} className="intel-pop" style={{
              padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.accent}44`,
              background: "rgba(88,224,194,0.06)", marginBottom: 8,
            }}>
              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.55 }}>{n.note}</div>
              <Micro style={{ marginTop: 6 }}>{n.actor} · {LEVEL_DEFS[n.level].label} · {new Date(n.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</Micro>
            </div>
          ))}
        </div>
      )}

      <Rule label="Act" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {keys.map((key) => {
          const def = ACTIONS[key];
          if (!def) return null;
          const verdict = can(viewer, key, finding);
          return (
            <Btn
              key={key}
              disabled={!verdict.allowed}
              title={verdict.allowed ? def.effect : verdict.reason}
              onClick={() => (def.requiresNote ? setNoteFor(key) : run(key))}
              primary={key === finding.actions[0]}
            >
              <span style={{ marginRight: 6 }} aria-hidden>{def.glyph}</span>{def.label}
            </Btn>
          );
        })}
      </div>

      {noteFor && (
        <div className="intel-pop" style={{ marginTop: 12, padding: 14, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)" }}>
          <Micro style={{ marginBottom: 8 }}>{ACTIONS[noteFor].label} — say why</Micro>
          <textarea
            autoFocus value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="What do you know that the data does not?"
            style={{
              width: "100%", minHeight: 74, resize: "vertical", padding: 11, borderRadius: 8,
              background: "rgba(0,0,0,0.28)", border: `1px solid ${C.border}`, color: C.text,
              fontFamily: C.sans, fontSize: 14, lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn primary small onClick={() => run(noteFor, note)}>Record</Btn>
            <Btn small onClick={() => { setNoteFor(null); setNote(""); }}>Cancel</Btn>
          </div>
        </div>
      )}

      {flash && (
        <div className="intel-pop" style={{
          marginTop: 12, padding: "10px 13px", borderRadius: 8, fontSize: 13,
          border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.05)", color: C.muted,
        }}>{flash}</div>
      )}

      <div style={{ marginTop: 14, fontSize: 11.5, color: C.faint, lineHeight: 1.6, maxWidth: "72ch" }}>
        Every action above is a named, typed, permission-checked write with an immutable history row.
        Nothing in this console — including anything a model suggests — can change state by any other route.
      </div>
    </div>
  );
}

/* ─── Case view ────────────────────────────────────────────────────────── */

export function CaseView({ viewer, finding, onPupil }: { viewer: Viewer; finding: Finding; onPupil: (id: string) => void }) {
  const subj = finding.subjectKey ? SUBJECT_BY_KEY[finding.subjectKey] : null;
  const w = world();
  const school = finding.schoolId ? w.schoolById.get(finding.schoolId) : null;
  const named = finding.pupilIds && LEVEL_DEFS[viewer.level].maxPupilGrain !== null;

  return (
    <div className="intel-fade" style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <Chip tone="info">{KIND_LABEL[finding.kind]}</Chip>
        {subj && <Chip style={{ color: subj.colour, borderColor: subj.colour + "44" }}>{subj.name}</Chip>}
        <Chip tone={strengthTone(finding.strength)}>{finding.strength}</Chip>
        {school && <Micro>{school.name}</Micro>}
      </div>

      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 34, lineHeight: 1.14, letterSpacing: "-0.015em", marginBottom: 12, maxWidth: "22ch" }}>
        {finding.headline}
      </h1>
      <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.65, maxWidth: "66ch", marginBottom: 22 }}>{finding.sub}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
        <span style={{ fontFamily: C.serif, fontSize: 40, lineHeight: 1, color: finding.effect < 0 ? C.red : C.grn, fontVariantNumeric: "tabular-nums" }}>
          {finding.effect > 0 ? "+" : ""}{finding.effect}
        </span>
        <div style={{ flex: 1, maxWidth: 420 }}><EffectMeter effect={finding.effect} delay={140} /></div>
      </div>
      <Micro style={{ marginBottom: 4 }}>Standardised points · within-pupil comparison · n={finding.n.toLocaleString("en-GB")}</Micro>

      <Rule label="Evidence" />
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
        {finding.evidence.map((e, i) => (
          <div key={e.label + i} className="intel-rise" style={{
            animationDelay: `${i * 38}ms`,
            display: "grid", gridTemplateColumns: "minmax(180px, 34%) 1fr", gap: 16,
            padding: "11px 15px", borderTop: i ? `1px solid ${C.rule}` : "none",
            background: i % 2 ? "rgba(255,255,255,0.02)" : "transparent",
          }}>
            <Micro style={{ fontSize: 9.5 }}>{e.label}</Micro>
            <div style={{
              fontSize: 13.5, lineHeight: 1.5,
              color: e.tone === "bad" ? C.red : e.tone === "good" ? C.grn : C.text,
            }}>{e.value}</div>
          </div>
        ))}
      </div>

      <Rule label="Differential diagnosis — ranked, not decided" />
      <p style={{ fontSize: 13, color: C.faint, lineHeight: 1.6, maxWidth: "70ch", marginBottom: 14 }}>
        Observational school data cannot identify causes. These are candidate explanations with the
        signal that separates them and what would rule each in or out. Regression to the mean is checked
        first, always. The determination is yours.
      </p>
      <Differential hyps={finding.differential} />

      {named && finding.pupilIds!.length > 0 && (
        <>
          <Rule label={`Pupils behind this finding · ${finding.pupilIds!.length}`} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {finding.pupilIds!.slice(0, 40).map((id) => {
              const p = w.pupilById.get(id);
              if (!p) return null;
              return (
                <button key={id} className="intel-btn" onClick={() => onPupil(id)} style={{
                  fontFamily: C.mono, fontSize: 11, padding: "5px 10px", borderRadius: 6,
                  border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.05)",
                  color: C.text, cursor: "pointer",
                }}>{p.name} <span style={{ color: C.faint }}>· {p.readingAge}y</span></button>
              );
            })}
          </div>
        </>
      )}

      {!named && finding.pupilIds && (
        <>
          <Rule label="Pupils" />
          <div style={{ fontSize: 13, color: C.faint, lineHeight: 1.6, maxWidth: "68ch" }}>
            {finding.n} pupils sit behind this figure. At {LEVEL_DEFS[viewer.level].label} level the console does not
            resolve individual children — the purpose you are acting under is
            "{LEVEL_DEFS[viewer.level].purposes[0].replace(/_/g, " ")}", which does not require a name.
            The school can see them.
          </div>
        </>
      )}

      <div style={{ height: 26 }} />
      <ActionBar viewer={viewer} finding={finding} />
      <div style={{ height: 60 }} />
    </div>
  );
}

/* ─── One child ────────────────────────────────────────────────────────── */

export function PupilCase({
  viewer, pupilId, subjectKey, onProgression,
}: {
  viewer: Viewer; pupilId: string; subjectKey?: string;
  onProgression?: (ks2: number) => void;
}) {
  const w = world();
  const pupil = w.pupilById.get(pupilId);
  const [openSubject, setOpenSubject] = useState<string | null>(subjectKey ?? null);
  if (!pupil) return <div style={{ color: C.dim }}>Pupil not found.</div>;

  const pr = profile(pupilId);
  const subjects = Object.keys(pr.bySubject).sort((a, b) => pr.residual[a] - pr.residual[b]);
  const focus = openSubject ?? subjects[0];

  const series = pr.byWindow[focus] || [];
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const before = r1((series[0] + series[1]) / 2 - pr.overall);
  const after = r1((series[2] + series[3]) / 2 - pr.overall);
  const delta = r1(after - before);
  // Same regression-to-the-mean test the board applies. Computing it here as
  // well (rather than assuming false) is the difference between the pupil view
  // telling the truth and quietly reporting every bounce-back as a change.
  const spread = sd(series);
  const change: TrajectoryChange = {
    pupil, subjectKey: focus, before, after, delta,
    rtmSuspect: delta > 0 && Math.abs(before) > 1.6 * spread && Math.abs(before) > 8,
    attendanceDrop: pupil.attendancePct < 85,
    readingShortfall: pr.shortfall[focus],
  };
  const hyps = diagnose(change);
  const rtm = hyps.find((h) => h.name === "Regression to the mean");

  return (
    <div className="intel-fade" style={{ maxWidth: 980 }}>
      <Micro style={{ marginBottom: 10 }}>Pupil · {w.schoolById.get(pupil.schoolId)!.name} · Year {pupil.year} {pupil.form}</Micro>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 36, lineHeight: 1.1, marginBottom: 16 }}>{pupil.name}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 8 }}>
        <StatTile label="Reading age" value={`${pupil.readingAge} yrs`} hint={pr.worstShortfallSubject ? `Below the demand of ${SUBJECT_BY_KEY[pr.worstShortfallSubject].name}` : "Clears every paper"} />
        <StatTile label="KS2 scaled" value={String(pupil.ks2)} delay={60} />
        <StatTile label="Attendance" value={`${pupil.attendancePct}%`} delay={120} />
        <StatTile label="Own mean" value={String(Math.round(pr.overall))} hint="Their baseline — every residual below is against this" delay={180} />
      </div>

      {onProgression && (
        <button className="intel-btn" onClick={() => onProgression(pupil.ks2)} style={{
          marginTop: 10, display: "flex", alignItems: "center", gap: 10, width: "100%",
          textAlign: "left", cursor: "pointer", padding: "11px 14px", borderRadius: 10,
          border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text,
        }}>
          <span style={{ color: C.accent }} aria-hidden>↗</span>
          <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}>
            Where pupils who started at KS2 {pupil.ks2} actually landed
            <span style={{ color: C.faint }}> — real national outcomes, as a distribution</span>
          </span>
        </button>
      )}

      <Rule label="Subject residuals — against their own mean" />
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
        {subjects.map((k, i) => {
          const s = SUBJECT_BY_KEY[k];
          const r = pr.residual[k];
          const gated = pr.shortfall[k] >= 1.5;
          return (
            <button key={k} onClick={() => setOpenSubject(k)} className="intel-btn" style={{
              width: "100%", textAlign: "left", cursor: "pointer",
              display: "grid", gridTemplateColumns: "130px 60px 1fr 110px 100px", gap: 14, alignItems: "center",
              padding: "11px 15px",
              borderTop: i ? `1px solid ${C.rule}` : "none",
              borderRight: "none", borderBottom: "none",
              borderLeft: `2px solid ${k === focus ? s.colour : "transparent"}`,
              background: k === focus ? "rgba(255,255,255,0.07)" : "transparent",
              color: C.text, borderRadius: 0,
            }}>
              <span style={{ fontSize: 14, color: s.colour }}>{s.name}</span>
              <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: r < -3 ? C.red : r > 3 ? C.grn : C.muted, fontVariantNumeric: "tabular-nums" }}>
                {r > 0 ? "+" : ""}{r}
              </span>
              <EffectMeter effect={r} delay={i * 40} />
              <Spark points={pr.byWindow[k] || []} colour={s.colour} />
              {gated
                ? <Chip tone="bad">reads {pr.shortfall[k]}y short</Chip>
                : <span />}
            </button>
          );
        })}
      </div>
      <Micro style={{ marginTop: 8, color: C.faint, letterSpacing: "0.1em", fontSize: 10 }}>
        Windows: {WINDOWS.map((x) => x.name).join(" · ")}
      </Micro>

      <Rule label={`Differential — ${SUBJECT_BY_KEY[focus].name}`} />
      {rtm?.verdict === "supported" && (
        <div className="intel-pop" style={{
          padding: "13px 15px", borderRadius: 10, border: `1px solid ${C.amb}55`,
          background: C.ambS, marginBottom: 14,
        }}>
          <Chip tone="warn" style={{ marginBottom: 8, display: "inline-block" }}>Probably not a real change</Chip>
          <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>{rtm.found}</div>
        </div>
      )}
      <Differential hyps={hyps} />
      <div style={{ height: 60 }} />
    </div>
  );
}

/* ─── Trajectory list ──────────────────────────────────────────────────── */

export function ChangeList({ changes, onPupil }: { changes: TrajectoryChange[]; onPupil: (id: string, subj: string) => void }) {
  const real = changes.filter((c) => !c.rtmSuspect);
  const rtm = changes.filter((c) => c.rtmSuspect);

  return (
    <div>
      <div style={{ border: `1px solid ${C.rule}`, borderRadius: 10, overflow: "hidden" }}>
        {real.length === 0 && <div style={{ padding: 18, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>Nothing changed materially this window.</div>}
        {real.slice(0, 20).map((c, i) => {
          const s = SUBJECT_BY_KEY[c.subjectKey];
          return (
            <button key={c.pupil.id + c.subjectKey} onClick={() => onPupil(c.pupil.id, c.subjectKey)}
              className="intel-btn intel-rise" style={{
                animationDelay: `${i * 35}ms`, width: "100%", textAlign: "left", cursor: "pointer",
                display: "grid", gridTemplateColumns: "1fr 110px 70px 1fr auto", gap: 14, alignItems: "center",
                padding: "11px 15px",
                // Individual sides only — mixing the `border` shorthand with
                // `borderTop` leaves stale values behind on rerender.
                borderTop: i ? `1px solid ${C.rule}` : "none",
                borderRight: "none", borderBottom: "none", borderLeft: "none",
                background: "transparent", color: C.text, borderRadius: 0,
              }}>
              <span style={{ fontSize: 14 }}>{c.pupil.name}</span>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: s.colour }}>{s.name}</span>
              <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: c.delta < 0 ? C.red : C.grn, fontVariantNumeric: "tabular-nums" }}>
                {c.delta > 0 ? "+" : ""}{c.delta}
              </span>
              <EffectMeter effect={c.delta} max={20} delay={i * 35} />
              <span style={{ display: "flex", gap: 6 }}>
                {c.attendanceDrop && <Chip tone="warn">attendance</Chip>}
                {c.readingShortfall >= 1.5 && <Chip tone="info">reads {c.readingShortfall}y short</Chip>}
              </span>
            </button>
          );
        })}
      </div>

      {rtm.length > 0 && (
        <div style={{ marginTop: 14, padding: "12px 15px", borderRadius: 10, border: `1px dashed ${C.rule}`, background: "rgba(255,255,255,0.02)" }}>
          <Chip tone="warn" style={{ marginBottom: 8, display: "inline-block" }}>Held back — {rtm.length} regression-to-the-mean cases</Chip>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: "72ch" }}>
            These pupils moved by enough to trip the threshold, but their earlier window was an extreme
            excursion from their own baseline — so most of the movement is the mean pulling them back.
            Reporting them as improvements is how dashboards manufacture success. They are excluded above.
          </div>
        </div>
      )}
    </div>
  );
}
