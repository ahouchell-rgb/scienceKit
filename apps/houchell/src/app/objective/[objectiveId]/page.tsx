"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  InsightCoverage,
  type CoverageSignal,
} from "@/components/InsightCoverage";
import { sk, useAuth } from "@/lib/sk";
import { C } from "@/lib/theme";

interface ObjectiveView {
  key: string;
  objective_id?: string | null;
  title?: string;
  label?: string;
  code?: string | null;
  strand?: string | null;
  subject?: { name?: string; slug?: string } | null;
  mastery_pct?: number;
  blendedPct?: number;
  marked: number;
  students?: number;
  sources: string[];
  retrieval?: { pct: number; marked: number };
  assessment?: { pct: number; marked: number; students: number };
  evidence_strength?: string;
}

interface ObjectivePageData {
  objective: ObjectiveView | null;
  context: {
    kind: "class" | "teacher" | "school" | "trust";
    id?: string;
    label: string;
    href: string;
  };
  coverage: Record<string, CoverageSignal>;
  generatedAt?: string;
}

function heat(value: number) {
  if (value < 40) return C.red;
  if (value < 65) return C.amb;
  return C.grn;
}

function objectiveMatches(row: ObjectiveView, requested: string) {
  return (
    row.objective_id === requested ||
    row.key === requested ||
    row.key === `obj:${requested}` ||
    row.key.replace(/^obj:/, "") === requested
  );
}

function globalCoverage(objective: ObjectiveView | null): Record<string, CoverageSignal> {
  const sources = objective?.sources || [];
  return {
    mastery: {
      status: objective ? "available" : "empty",
      label: "Mastery",
      detail: objective
        ? "Objective evidence is available in this workspace"
        : "No evidence currently resolves to this objective",
    },
    assessment: {
      status: sources.includes("assessment") ? "available" : "not_available",
      label: "Assessment QLA",
      detail: sources.includes("assessment")
        ? "Common-assessment question evidence is included"
        : "No assessment evidence is included in this scope",
    },
    attendance: {
      status: "not_connected",
      label: "Attendance",
      detail: "Attendance-event exposure is not connected to objective evidence",
    },
    behaviour: {
      status: "not_connected",
      label: "Behaviour",
      detail: "Behaviour events are not used to explain this learning objective",
    },
  };
}

function Objective360Content() {
  const params = useParams<{ objectiveId: string }>();
  const requested = params.objectiveId;
  const search = useSearchParams();
  const classId = search.get("class");
  const { profile } = useAuth();
  const [data, setData] = useState<ObjectivePageData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const headers = { authorization: `Bearer ${sk.auth.getToken()}` };
        if (classId) {
          const response = await fetch(`/api/class/${encodeURIComponent(classId)}/overview`, {
            headers,
            cache: "no-store",
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Couldn't load class evidence");
          const objective =
            (body.objectives || []).find((row: ObjectiveView) => objectiveMatches(row, requested)) ||
            null;
          if (active) {
            setData({
              objective,
              context: {
                kind: "class",
                id: classId,
                label: body.class.name,
                href: `/class/${classId}`,
              },
              coverage: body.coverage,
              generatedAt: body.meta?.generatedAt,
            });
          }
          return;
        }

        const trust = profile?.trust_role === "trust_lead";
        const school = profile?.school_role === "hod" || profile?.school_role === "slt";
        const endpoint = trust
          ? "/api/trust/overview?live"
          : school
            ? "/api/school/overview?live"
            : "/api/teacher/overview";
        const response = await fetch(endpoint, { headers, cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Couldn't load objective evidence");
        const objective =
          (body.objectiveMastery || []).find((row: ObjectiveView) =>
            objectiveMatches(row, requested),
          ) || null;
        const kind = trust ? "trust" : school ? "school" : "teacher";
        const label = trust
          ? body.trust?.name || "Trust"
          : school
            ? body.school?.name || "School"
            : "My classes";
        if (active) {
          setData({
            objective,
            context: { kind, label, href: `/${kind}` },
            coverage: globalCoverage(objective),
            generatedAt: body.generatedAt,
          });
        }
      } catch (reason: any) {
        if (active) setError(reason.message || "Couldn't load objective evidence");
      }
    })();
    return () => {
      active = false;
    };
  }, [classId, profile?.school_role, profile?.trust_role, requested]);

  const score = data?.objective
    ? data.objective.mastery_pct ?? data.objective.blendedPct ?? null
    : null;
  const title = data?.objective?.title || data?.objective?.label || "Unresolved objective";
  const sources = data?.objective?.sources || [];
  const actionQuery = useMemo(() => {
    const query = new URLSearchParams({
      create: "finding",
      objective: requested,
      title,
    });
    if (classId) query.set("class", classId);
    return query.toString();
  }, [classId, requested, title]);

  if (error) {
    return (
      <div style={{ padding: "40px 0", color: C.red, fontFamily: C.mono, fontSize: 12 }}>
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 40, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
        Resolving objective evidence…
      </div>
    );
  }

  const evidence = [
    {
      name: "Retrieval practice",
      included: sources.includes("retrieval"),
      value: data.objective?.retrieval?.pct ?? (sources.includes("retrieval") ? score : null),
      detail: data.objective?.retrieval
        ? `${data.objective.retrieval.marked.toLocaleString()} marked responses`
        : `${data.objective?.marked || 0} marked responses in this view`,
    },
    {
      name: "Common assessment QLA",
      included: sources.includes("assessment"),
      value: data.objective?.assessment?.pct ?? null,
      detail: data.objective?.assessment
        ? `${data.objective.assessment.marked.toLocaleString()} marks · ${data.objective.assessment.students} pupils`
        : "No class/scope assessment evidence available",
    },
  ];

  return (
    <div>
      <a
        href={data.context.href}
        style={{
          color: C.dim,
          fontFamily: C.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          textDecoration: "none",
          textTransform: "uppercase",
        }}
      >
        ← {data.context.label}
      </a>

      <header
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 24,
          alignItems: "end",
          padding: "28px 0",
          marginBottom: 28,
          borderBottom: `1px solid ${C.rule}`,
        }}
        className="objective360-hero"
      >
        <div>
          <div
            style={{
              color: C.blu,
              fontFamily: C.mono,
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginBottom: 11,
            }}
          >
            Objective 360 · {data.context.kind} evidence
          </div>
          <h1
            style={{
              color: C.text,
              fontFamily: C.serif,
              fontSize: "clamp(34px, 5vw, 52px)",
              lineHeight: 1,
              fontWeight: 400,
              letterSpacing: "-0.03em",
              maxWidth: 820,
              margin: "0 0 12px",
            }}
          >
            {title}
          </h1>
          <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 10 }}>
            {data.objective?.code ? `${data.objective.code} · ` : ""}
            {data.objective?.strand ? `${data.objective.strand} · ` : ""}
            {data.context.label}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" }}>
            Current mastery signal
          </div>
          <div
            style={{
              color: score == null ? C.dim : heat(score),
              fontFamily: C.serif,
              fontSize: 58,
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            {score == null ? "—" : `${score}%`}
          </div>
        </div>
      </header>

      {!data.objective && (
        <div
          style={{
            padding: 16,
            color: C.amb,
            background: C.ambS,
            border: `1px solid ${C.amb}66`,
            borderRadius: 12,
            marginBottom: 26,
            fontSize: 13,
          }}
        >
          This objective key is valid, but no current evidence in {data.context.label} resolves to it.
          It has not been converted into a zero score.
        </div>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ color: C.text, fontSize: 16, margin: "0 0 12px" }}>Evidence coverage</h2>
        <InsightCoverage coverage={data.coverage} compact />
      </section>

      <section className="objective360-grid">
        <div
          style={{
            border: `1px solid ${C.border}`,
            background: C.surface,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "15px 17px", borderBottom: `1px solid ${C.rule}` }}>
            <h2 style={{ color: C.text, fontSize: 16, margin: 0 }}>Evidence ledger</h2>
          </div>
          {evidence.map((item, index) => (
            <div
              key={item.name}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 16,
                padding: "15px 17px",
                borderTop: index === 0 ? "none" : `1px solid ${C.rule}`,
                opacity: item.included ? 1 : 0.6,
              }}
            >
              <div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                <div style={{ color: C.dim, fontSize: 11, marginTop: 5 }}>{item.detail}</div>
              </div>
              <div
                style={{
                  color: item.value == null ? C.dim : heat(item.value),
                  fontFamily: C.mono,
                  fontSize: 16,
                }}
              >
                {item.value == null ? "not included" : `${item.value}%`}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: 18,
            border: `1px solid ${C.border}`,
            background: C.surface,
            borderRadius: 16,
          }}
        >
          <div style={{ color: C.grn, fontFamily: C.mono, fontSize: 9, marginBottom: 8 }}>
            NEXT DECISION
          </div>
          <h2 style={{ color: C.text, fontSize: 18, lineHeight: 1.25, margin: "0 0 9px" }}>
            Review the evidence, then choose a response.
          </h2>
          <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.55, margin: "0 0 16px" }}>
            A low signal is a prompt for professional judgement. Stage 4 records the finding,
            owner, due date and rationale. Stage 5 can then generate a response deck and schedule
            the recheck.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a
              href={`/inbox?${actionQuery}`}
              style={{
                padding: "9px 13px",
                color: C.accentFg,
                background: C.accent,
                borderRadius: 999,
                fontFamily: C.mono,
                fontSize: 10,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Record a finding
            </a>
            <a
              href="/curriculum"
              style={{
                padding: "9px 13px",
                color: C.muted,
                border: `1px solid ${C.border}`,
                borderRadius: 999,
                fontFamily: C.mono,
                fontSize: 10,
                textDecoration: "none",
              }}
            >
              Open curriculum
            </a>
          </div>
        </div>
      </section>

      <section
        style={{
          marginTop: 28,
          paddingTop: 20,
          borderTop: `1px solid ${C.rule}`,
          color: C.dim,
          fontSize: 11,
          lineHeight: 1.55,
        }}
      >
        No trend is shown until comparable snapshots exist. No pupil-level prediction is derived
        from this cohort signal. Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString("en-GB") : "from the latest available evidence"}.
      </section>

      <style>{`
        .objective360-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(260px, .75fr);
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 760px) {
          .objective360-hero { grid-template-columns: 1fr !important; }
          .objective360-hero > :last-child { text-align: left !important; }
          .objective360-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

export default function Objective360Page() {
  return (
    <AppShell>
      <Objective360Content />
    </AppShell>
  );
}
