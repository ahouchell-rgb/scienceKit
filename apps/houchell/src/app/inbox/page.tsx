"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useAuth, sk } from "@/lib/sk";
import { inboxQueues } from "@/lib/inbox";
import {
  workUrgency,
  type IntelligenceActionStatus,
} from "@/lib/intelligenceWork";
import { C } from "@/lib/theme";

const TONE = {
  accent: { color: C.accent, bg: C.grnS },
  blue: { color: C.accent2, bg: C.bluS },
  amber: { color: C.amb, bg: C.ambS },
};

interface WorkAction {
  id: string;
  title: string;
  description: string;
  status: IntelligenceActionStatus;
  priority: "low" | "normal" | "high" | "urgent";
  owner_id: string | null;
  created_by: string;
  due_at: string | null;
  outcome_summary: string | null;
  proposed_by_kind: string;
}

interface WorkFinding {
  id: string;
  headline: string;
  summary: string;
  status: string;
  evidence_strength: string;
  evidence_snapshot: {
    masteryPct?: number | null;
    marked?: number;
    students?: number;
    contextLabel?: string;
  };
  class_id: string | null;
  objective_id: string | null;
  objective_key: string | null;
  created_at: string;
  actions: WorkAction[];
}

function ActionStatus({ action }: { action: WorkAction }) {
  const urgency = workUrgency(action.due_at, action.status);
  const color =
    action.status === "completed"
      ? C.grn
      : urgency === "overdue"
        ? C.red
        : urgency === "due_soon"
          ? C.amb
          : C.blu;
  return (
    <span
      style={{
        padding: "3px 7px",
        color,
        background: `${color}18`,
        borderRadius: 999,
        fontFamily: C.mono,
        fontSize: 9,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {urgency === "overdue" ? "overdue · " : ""}
      {action.status.replace("_", " ")}
    </span>
  );
}

function InboxContent() {
  const { profile } = useAuth();
  const queues = inboxQueues(profile);
  const router = useRouter();
  const search = useSearchParams();
  const creating = search.get("create") === "finding";
  const [findings, setFindings] = useState<WorkFinding[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [formError, setFormError] = useState("");
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [dueDate, setDueDate] = useState("");

  const classId = search.get("class") || "";
  const objectiveId = search.get("objective") || "";
  const sourceTitle = search.get("title") || "objective evidence";

  useEffect(() => {
    if (!creating) return;
    setHeadline((current) => current || `Review: ${sourceTitle}`);
    setActionTitle((current) => current || `Plan and teach a response to ${sourceTitle}`);
  }, [creating, sourceTitle]);

  const load = async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/intelligence/work", {
        headers: { authorization: `Bearer ${sk.auth.getToken()}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't load work");
      setEnabled(body.enabled);
      setFindings(body.findings || []);
    } catch (error: any) {
      setLoadError(error.message || "Couldn't load persistent work");
      setEnabled(false);
    }
  };

  useEffect(() => {
    load();
    // The bearer token is hydrated before AuthGate renders this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = useMemo(
    () =>
      findings
        .flatMap((finding) =>
          (finding.actions || []).map((action) => ({ finding, action })),
        )
        .sort((left, right) => {
          const leftClosed = ["completed", "cancelled"].includes(left.action.status) ? 1 : 0;
          const rightClosed = ["completed", "cancelled"].includes(right.action.status) ? 1 : 0;
          if (leftClosed !== rightClosed) return leftClosed - rightClosed;
          const leftDue = left.action.due_at ? Date.parse(left.action.due_at) : Infinity;
          const rightDue = right.action.due_at ? Date.parse(right.action.due_at) : Infinity;
          return leftDue - rightDue;
        }),
    [findings],
  );

  const createFinding = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!classId || !objectiveId) {
      setFormError("Open this form from a class objective so the evidence scope is explicit.");
      return;
    }
    setBusy("create");
    try {
      const response = await fetch("/api/intelligence/work", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sk.auth.getToken()}`,
        },
        body: JSON.stringify({
          classId,
          objectiveId,
          headline,
          summary,
          actionTitle,
          dueAt: dueDate ? `${dueDate}T16:00:00` : null,
          createAction: true,
          evidence: {
            masteryPct: search.get("mastery"),
            marked: search.get("marked"),
            students: search.get("students"),
            sources: (search.get("sources") || "").split(",").filter(Boolean),
            contextLabel: search.get("context") || "",
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't create finding");
      await load();
      router.replace("/inbox");
    } catch (error: any) {
      setFormError(error.message || "Couldn't create finding");
    } finally {
      setBusy("");
    }
  };

  const transition = async (
    action: WorkAction,
    status: IntelligenceActionStatus,
  ) => {
    let outcomeSummary: string | undefined;
    if (status === "completed") {
      outcomeSummary =
        window.prompt("What changed? Record the observed outcome before closing the action.") ||
        undefined;
      if (!outcomeSummary) return;
    }
    setBusy(action.id);
    setLoadError("");
    try {
      const response = await fetch("/api/intelligence/work", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${sk.auth.getToken()}`,
        },
        body: JSON.stringify({ actionId: action.id, status, outcomeSummary }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Couldn't update action");
      await load();
    } catch (error: any) {
      setLoadError(error.message || "Couldn't update action");
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <div
        style={{
          fontFamily: C.mono,
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: C.accent,
          marginBottom: 10,
        }}
      >
        Action Inbox
      </div>
      <h1
        style={{
          fontFamily: C.serif,
          fontWeight: 400,
          fontSize: 48,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          marginBottom: 10,
        }}
      >
        One place to <em style={{ color: C.accent }}>act</em>.
      </h1>
      <p
        style={{
          maxWidth: 720,
          color: C.muted,
          fontSize: 15,
          lineHeight: 1.65,
          marginBottom: 28,
        }}
      >
        Findings become owned work here. Every accepted action has a purpose, due date,
        evidence snapshot, status history and recorded outcome.
      </p>

      {creating && (
        <form
          onSubmit={createFinding}
          style={{
            padding: 20,
            border: `1px solid ${C.accent}66`,
            borderRadius: 16,
            background: "rgba(88,224,194,0.055)",
            marginBottom: 28,
          }}
        >
          <div style={{ color: C.accent, fontFamily: C.mono, fontSize: 10, marginBottom: 8 }}>
            RECORD REVIEWED FINDING
          </div>
          <h2 style={{ color: C.text, fontSize: 20, margin: "0 0 16px" }}>{sourceTitle}</h2>
          <label style={{ display: "block", color: C.muted, fontSize: 11, marginBottom: 12 }}>
            Finding headline
            <input
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              maxLength={240}
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "block", color: C.muted, fontSize: 11, marginBottom: 12 }}>
            Professional judgement and rationale
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={3000}
              placeholder="What do you know that the data does not? What should be checked before acting?"
              style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
            />
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(150px, .35fr)",
              gap: 12,
            }}
          >
            <label style={{ color: C.muted, fontSize: 11 }}>
              First owned action
              <input
                value={actionTitle}
                onChange={(event) => setActionTitle(event.target.value)}
                maxLength={240}
                required
                style={inputStyle}
              />
            </label>
            <label style={{ color: C.muted, fontSize: 11 }}>
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
          {formError && (
            <div style={{ color: C.red, fontFamily: C.mono, fontSize: 11, marginTop: 12 }}>
              {formError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="submit" disabled={busy === "create" || enabled === false} style={primaryButton}>
              {busy === "create" ? "Recording…" : "Record finding + proposed action"}
            </button>
            <button type="button" onClick={() => router.replace("/inbox")} style={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="persistent-work-title" style={{ marginBottom: 34 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 12,
          }}
        >
          <h2
            id="persistent-work-title"
            style={{
              fontFamily: C.mono,
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: C.dim,
              margin: 0,
            }}
          >
            Persistent work · {actions.length}
          </h2>
          <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 9 }}>
            proposed → accepted → in progress → outcome
          </span>
        </div>

        {loadError && (
          <div
            style={{
              padding: 12,
              color: C.red,
              border: `1px solid ${C.red}55`,
              background: C.redS,
              borderRadius: 10,
              marginBottom: 10,
              fontSize: 12,
            }}
          >
            {loadError}
          </div>
        )}

        {enabled === null ? (
          <div style={emptyStyle}>Loading owned work…</div>
        ) : enabled === false ? (
          <div style={emptyStyle}>
            <strong style={{ color: C.amb, display: "block", marginBottom: 6 }}>
              Stage 4 migration is gated
            </strong>
            The workflow is implemented, but this environment does not expose the persistent
            tables yet. Apply the generated migration only after the documented branch/RLS gate.
          </div>
        ) : actions.length === 0 ? (
          <div style={emptyStyle}>
            No persistent action is assigned to your scope yet. Open an objective from Class 360
            and record the first reviewed finding.
          </div>
        ) : (
          <div
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              overflow: "hidden",
              background: C.surface,
            }}
          >
            {actions.map(({ finding, action }, index) => {
              const next =
                action.status === "proposed"
                  ? "accepted"
                  : action.status === "accepted"
                    ? "in_progress"
                    : action.status === "in_progress"
                      ? "completed"
                      : null;
              return (
                <div
                  key={action.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 16,
                    padding: 16,
                    borderTop: index === 0 ? "none" : `1px solid ${C.rule}`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ color: C.text, fontSize: 14 }}>{action.title}</strong>
                      <ActionStatus action={action} />
                      {action.proposed_by_kind !== "human" && (
                        <span style={{ color: C.amb, fontFamily: C.mono, fontSize: 9 }}>
                          human acceptance required
                        </span>
                      )}
                    </div>
                    <div style={{ color: C.muted, fontSize: 12, marginTop: 7 }}>
                      Finding: {finding.headline}
                    </div>
                    <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 10, marginTop: 6 }}>
                      {action.due_at
                        ? `Due ${new Date(action.due_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                        : "No due date"}
                      {finding.evidence_snapshot?.masteryPct != null
                        ? ` · evidence ${finding.evidence_snapshot.masteryPct}%`
                        : ""}
                    </div>
                    {action.outcome_summary && (
                      <div style={{ color: C.grn, fontSize: 12, marginTop: 8 }}>
                        Outcome: {action.outcome_summary}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {finding.class_id && (
                      <Link
                        href={`/class/${finding.class_id}`}
                        style={{ ...secondaryButton, display: "inline-block" }}
                      >
                        Evidence
                      </Link>
                    )}
                    {action.status !== "proposed" && action.status !== "cancelled" && (
                      <Link
                        href={`/response/${action.id}`}
                        style={{ ...secondaryButton, display: "inline-block", color: C.blu }}
                      >
                        Response loop
                      </Link>
                    )}
                    {next && (
                      <button
                        disabled={busy === action.id}
                        onClick={() => transition(action, next)}
                        style={primaryButton}
                      >
                        {busy === action.id
                          ? "Saving…"
                          : next === "accepted"
                            ? "Accept"
                            : next === "in_progress"
                              ? "Start"
                              : "Record outcome"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="work-queues-title">
        <h2
          id="work-queues-title"
          style={{
            fontFamily: C.mono,
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.dim,
            marginBottom: 12,
          }}
        >
          Connected specialist queues
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 12,
          }}
        >
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
                <span
                  style={{
                    alignSelf: "flex-start",
                    padding: "3px 7px",
                    borderRadius: 999,
                    background: tone.bg,
                    color: tone.color,
                    fontFamily: C.mono,
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: 13,
                  }}
                >
                  {queue.source}
                </span>
                <strong
                  style={{
                    fontFamily: C.serif,
                    fontSize: 22,
                    fontWeight: 400,
                    marginBottom: 8,
                  }}
                >
                  {queue.label}
                </strong>
                <span style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>
                  {queue.description}
                </span>
                <span
                  style={{
                    color: tone.color,
                    fontFamily: C.mono,
                    fontSize: 10,
                    marginTop: "auto",
                    paddingTop: 14,
                  }}
                >
                  Open queue →
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  padding: "10px 11px",
  color: C.text,
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 9,
  fontFamily: C.sans,
  fontSize: 13,
};

const primaryButton: React.CSSProperties = {
  padding: "8px 12px",
  color: C.accentFg,
  background: C.accent,
  border: "none",
  borderRadius: 999,
  fontFamily: C.mono,
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const secondaryButton: React.CSSProperties = {
  padding: "8px 12px",
  color: C.muted,
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 999,
  fontFamily: C.mono,
  fontSize: 10,
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const emptyStyle: React.CSSProperties = {
  padding: 18,
  color: C.dim,
  background: C.surface,
  border: `1px dashed ${C.borderStrong}`,
  borderRadius: 12,
  fontSize: 12,
  lineHeight: 1.55,
};

export default function InboxPage() {
  return (
    <AppShell>
      <InboxContent />
    </AppShell>
  );
}
