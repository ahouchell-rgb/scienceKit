"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/sk";
import { inboxQueues } from "@/lib/inbox";
import { C } from "@/lib/theme";

const TONE = {
  accent: { color: C.accent, bg: C.grnS },
  blue: { color: C.accent2, bg: C.bluS },
  amber: { color: C.amb, bg: C.ambS },
};

function InboxContent() {
  const { profile } = useAuth();
  const queues = inboxQueues(profile);

  return (
    <div>
      <div style={{ fontFamily: C.mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, marginBottom: 10 }}>
        Action Inbox
      </div>
      <h1 style={{ fontFamily: C.serif, fontWeight: 400, fontSize: 48, lineHeight: 1, letterSpacing: "-0.02em", marginBottom: 10 }}>
        One place to <em style={{ color: C.accent }}>act</em>.
      </h1>
      <p style={{ maxWidth: 720, color: C.muted, fontSize: 15, lineHeight: 1.65, marginBottom: 28 }}>
        These are the live work queues already present across Houchell. Stage 4 will turn
        findings, assignments, due dates and outcomes into one persistent action service;
        this page is the role-aware home for it.
      </p>

      <section aria-labelledby="work-queues-title">
        <h2 id="work-queues-title" style={{ fontFamily: C.mono, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.dim, marginBottom: 12 }}>
          Your work queues
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
          {queues.map((queue) => {
            const tone = TONE[queue.tone];
            return (
              <Link
                key={queue.key}
                href={queue.href}
                style={{
                  minHeight: 150,
                  display: "flex",
                  flexDirection: "column",
                  padding: 18,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  background: C.surface,
                  color: C.text,
                  textDecoration: "none",
                  boxShadow: "0 12px 36px rgba(0,0,0,0.16)",
                }}
              >
                <span style={{ alignSelf: "flex-start", padding: "3px 7px", borderRadius: 999, background: tone.bg, color: tone.color, fontFamily: C.mono, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 13 }}>
                  {queue.source}
                </span>
                <strong style={{ fontFamily: C.serif, fontSize: 22, fontWeight: 400, marginBottom: 8 }}>{queue.label}</strong>
                <span style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>{queue.description}</span>
                <span style={{ color: tone.color, fontFamily: C.mono, fontSize: 10, marginTop: "auto", paddingTop: 14 }}>Open queue →</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 28, padding: 18, border: `1px dashed ${C.borderStrong}`, borderRadius: 12, background: "rgba(255,255,255,0.025)" }}>
        <div style={{ color: C.text, fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Persistent actions arrive in Stage 4</div>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.55, margin: 0 }}>
          The durable inbox will add owners, purpose, evidence snapshots, status, due dates,
          generated artifacts, delivery and measured outcomes. Until then, this foundation
          links the existing queues without inventing task state that is not yet stored.
        </p>
      </section>
    </div>
  );
}

export default function InboxPage() {
  return <AppShell><InboxContent /></AppShell>;
}
