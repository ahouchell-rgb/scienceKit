"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  InsightCoverage,
  type CoverageSignal,
} from "@/components/InsightCoverage";
import { sk } from "@/lib/sk";
import { C } from "@/lib/theme";

interface ClassObjective {
  key: string;
  objective_id: string | null;
  title: string;
  code: string | null;
  strand: string | null;
  mastery_pct: number;
  marked: number;
  students: number;
  sources: string[];
  evidence_strength: "limited" | "developing";
}

interface ClassOverview {
  class: {
    class_id: string;
    name: string;
    year_group: number | null;
    discipline: string | null;
    tier: string | null;
    teacher_name: string | null;
    school_name: string | null;
    access: "teacher" | "school" | "trust";
    retrievalLinked: boolean;
  };
  summary: {
    weakAreaAverage: number | null;
    objectivesObserved: number;
    lowestObjective: ClassObjective | null;
  };
  objectives: ClassObjective[];
  coverage: Record<string, CoverageSignal>;
  meta: {
    scope: "teacher" | "school" | "trust";
    assessmentIncluded: boolean;
    generatedAt: string;
  };
}

function heat(value: number) {
  if (value < 40) return C.red;
  if (value < 65) return C.amb;
  return C.grn;
}

function Class360Content() {
  const params = useParams<{ classId: string }>();
  const classId = params.classId;
  const [data, setData] = useState<ClassOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/class/${encodeURIComponent(classId)}/overview`, {
          headers: { authorization: `Bearer ${sk.auth.getToken()}` },
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Couldn't load this class");
        if (active) setData(body);
      } catch (reason: any) {
        if (active) setError(reason.message || "Couldn't load this class");
      }
    })();
    return () => {
      active = false;
    };
  }, [classId]);

  if (error) {
    return (
      <div style={{ padding: "40px 0", maxWidth: 680 }}>
        <div style={{ color: C.red, fontFamily: C.mono, fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
        <a href="/teacher" style={{ color: C.grn, fontFamily: C.mono, fontSize: 12 }}>
          Return to classes
        </a>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
        Building the class picture…
      </div>
    );
  }

  const back =
    data.meta.scope === "trust" ? "/trust" : data.meta.scope === "school" ? "/school" : "/teacher";
  const average = data.summary.weakAreaAverage;

  return (
    <div>
      <div style={{ marginBottom: 26 }}>
        <a
          href={back}
          style={{
            color: C.dim,
            fontFamily: C.mono,
            fontSize: 10,
            letterSpacing: "0.12em",
            textDecoration: "none",
            textTransform: "uppercase",
          }}
        >
          ← {data.meta.scope} workspace
        </a>
      </div>

      <header className="class360-hero">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: C.grn,
              fontFamily: C.mono,
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Class 360 · live evidence workspace
          </div>
          <h1
            style={{
              color: C.text,
              fontFamily: C.serif,
              fontSize: "clamp(38px, 6vw, 58px)",
              fontWeight: 400,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              margin: "0 0 12px",
            }}
          >
            {data.class.name}
          </h1>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {data.class.year_group ? `Year ${data.class.year_group}` : "Year not set"}
            {data.class.discipline ? ` · ${data.class.discipline}` : ""}
            {data.class.tier && data.class.tier !== "none" ? ` · ${data.class.tier}` : ""}
            {data.class.teacher_name ? ` · ${data.class.teacher_name}` : ""}
          </p>
        </div>
        <div
          style={{
            minWidth: 210,
            padding: 18,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
          }}
        >
          <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 9, textTransform: "uppercase" }}>
            Weak-area average
          </div>
          <div
            style={{
              color: average == null ? C.dim : heat(average),
              fontFamily: C.serif,
              fontSize: 48,
              lineHeight: 1,
              margin: "8px 0 6px",
            }}
          >
            {average == null ? "—" : `${average}%`}
          </div>
          <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.4 }}>
            This is the mean of surfaced weak objectives, not an overall class grade.
          </div>
        </div>
      </header>

      <section style={{ marginBottom: 34 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
          <h2 style={{ color: C.text, fontSize: 16, fontWeight: 600, margin: 0 }}>
            Evidence coverage
          </h2>
          <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 10 }}>
            absence is visible, not silently treated as zero
          </span>
        </div>
        <InsightCoverage coverage={data.coverage} />
      </section>

      <section style={{ marginBottom: 34 }}>
        <div className="class360-section-heading">
          <div>
            <h2 style={{ color: C.text, fontSize: 18, margin: "0 0 4px" }}>
              Objectives needing attention
            </h2>
            <p style={{ color: C.dim, fontSize: 12, margin: 0 }}>
              Weakest first · minimum retrieval evidence applied at source
            </p>
          </div>
          <a
            href={`/inbox?class=${encodeURIComponent(classId)}`}
            style={{
              color: C.grn,
              border: `1px solid ${C.grn}66`,
              borderRadius: 999,
              padding: "8px 13px",
              fontFamily: C.mono,
              fontSize: 10,
              textDecoration: "none",
            }}
          >
            Open class work queue →
          </a>
        </div>

        <div
          style={{
            border: `1px solid ${C.border}`,
            background: C.surface,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {data.objectives.length === 0 ? (
            <div style={{ padding: 22, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
              No objective has enough evidence yet. The coverage cards above show what to connect.
            </div>
          ) : (
            data.objectives.map((objective, index) => {
              const routeKey = objective.objective_id || objective.key;
              const color = heat(objective.mastery_pct);
              return (
                <a
                  key={objective.key}
                  href={`/objective/${encodeURIComponent(routeKey)}?class=${encodeURIComponent(classId)}`}
                  className="class360-objective"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 190px 110px",
                    gap: 16,
                    alignItems: "center",
                    padding: "14px 16px",
                    borderTop: index === 0 ? "none" : `1px solid ${C.rule}`,
                    color: C.text,
                    textDecoration: "none",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {objective.code ? `${objective.code} · ` : ""}
                      {objective.title}
                    </div>
                    <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 10, marginTop: 5 }}>
                      Retrieval · {objective.marked.toLocaleString()} marked
                      {objective.students ? ` · ${objective.students} pupils observed` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                    <div
                      style={{
                        height: 7,
                        flex: 1,
                        background: C.bg,
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(2, objective.mastery_pct)}%`,
                          background: color,
                        }}
                      />
                    </div>
                    <span style={{ color, fontFamily: C.mono, fontSize: 12, minWidth: 36 }}>
                      {objective.mastery_pct}%
                    </span>
                  </div>
                  <span
                    style={{
                      color: objective.evidence_strength === "developing" ? C.grn : C.amb,
                      fontFamily: C.mono,
                      fontSize: 9,
                      textAlign: "right",
                      textTransform: "uppercase",
                    }}
                  >
                    {objective.evidence_strength} →
                  </span>
                </a>
              );
            })
          )}
        </div>
      </section>

      <section
        style={{
          padding: 18,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          background: "rgba(122,167,255,0.07)",
        }}
      >
        <div style={{ color: C.blu, fontFamily: C.mono, fontSize: 10, marginBottom: 7 }}>
          INTERPRETATION GUARDRAIL
        </div>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          This page currently describes learning evidence. It does not predict an individual pupil,
          infer behaviour, or treat missing attendance and assessment feeds as favourable results.
          Stage 4 turns a reviewed observation into owned work; Stage 5 closes the loop through
          teaching and recheck.
        </p>
      </section>

      <style>{`
        .class360-hero {
          display: flex;
          justify-content: space-between;
          gap: 28px;
          align-items: flex-end;
          padding-bottom: 28px;
          margin-bottom: 30px;
          border-bottom: 1px solid ${C.rule};
        }
        .class360-section-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 13px;
        }
        .class360-objective:hover {
          background: rgba(255,255,255,0.04);
        }
        @media (max-width: 720px) {
          .class360-hero { align-items: stretch; flex-direction: column; }
          .class360-section-heading { align-items: flex-start; flex-direction: column; }
          .class360-objective {
            grid-template-columns: minmax(0, 1fr) 110px !important;
          }
          .class360-objective > :last-child { display: none; }
        }
      `}</style>
    </div>
  );
}

export default function Class360Page() {
  return (
    <AppShell>
      <Class360Content />
    </AppShell>
  );
}
