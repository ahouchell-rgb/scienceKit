"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  ObjectiveMasteryPanel,
  type BlendedObjectiveRow,
} from "@/components/ObjectiveMasteryPanel";
import { WorkspaceWorkSummary } from "@/components/WorkspaceWorkSummary";
import { sk } from "@/lib/sk";
import { C, DISC } from "@/lib/theme";

interface ClassRow {
  class_id: string;
  name: string;
  year_group: number;
  discipline: string | null;
  tier: string | null;
  teacher_name: string | null;
  linked: boolean;
  weak: {
    topic_name: string;
    pct_correct: number;
    marked: number | null;
    students: number | null;
  }[];
}

interface DepartmentOverview {
  enabled: boolean;
  reason?: string;
  department?: { id: string | null; name: string; subject?: { name: string; slug: string } };
  school?: { name: string };
  mappingMode?: "canonical_department" | "legacy_hod_pointer" | "school_role_fallback";
  mappingDetail?: string;
  classes?: ClassRow[];
  years?: number[];
  objectiveMastery?: BlendedObjectiveRow[];
  assessmentIncluded?: boolean;
}

function heat(value: number) {
  if (value < 40) return C.red;
  if (value < 65) return C.amb;
  return C.grn;
}

function DepartmentContent() {
  const [data, setData] = useState<DepartmentOverview | null>(null);
  const [error, setError] = useState("");
  const [year, setYear] = useState<number | "all">("all");

  useEffect(() => {
    fetch("/api/department/overview", {
      headers: { authorization: `Bearer ${sk.auth.getToken()}` },
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Couldn't load department");
        setData(body);
      })
      .catch((reason) => setError(reason.message || "Couldn't load department"));
  }, []);

  const classes = useMemo(
    () =>
      (data?.classes || []).filter(
        (row) => year === "all" || row.year_group === year,
      ),
    [data, year],
  );

  if (error) {
    return <div style={{ color: C.red, fontFamily: C.mono, fontSize: 12 }}>{error}</div>;
  }
  if (!data) {
    return (
      <div style={{ padding: 40, color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
        Loading department evidence…
      </div>
    );
  }
  if (!data.enabled) {
    return (
      <div>
        <h1 style={{ fontFamily: C.serif, fontSize: 42, fontWeight: 400 }}>
          Department workspace
        </h1>
        <p style={{ color: C.muted, maxWidth: 600 }}>
          This workspace is available to department leads. Your current profile does not carry
          that scope.
        </p>
      </div>
    );
  }

  const unlinked = classes.filter((row) => !row.linked).length;

  return (
    <div>
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
        {data.school?.name} · Department workspace
      </div>
      <h1
        style={{
          color: C.text,
          fontFamily: C.serif,
          fontSize: "clamp(40px, 6vw, 56px)",
          lineHeight: 0.98,
          fontWeight: 400,
          letterSpacing: "-0.035em",
          margin: "0 0 11px",
        }}
      >
        {data.department?.name}
      </h1>
      <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: "0 0 23px" }}>
        Curriculum landing, class evidence, owned response work and outcomes at one altitude.
      </p>

      <div
        style={{
          padding: "11px 14px",
          color: data.mappingMode === "canonical_department" ? C.grn : C.amb,
          background:
            data.mappingMode === "canonical_department" ? C.grnS : C.ambS,
          border: `1px solid ${
            data.mappingMode === "canonical_department" ? C.grn : C.amb
          }44`,
          borderRadius: 10,
          marginBottom: 18,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        <strong>
          {data.mappingMode === "canonical_department"
            ? "Canonical department scope"
            : data.mappingMode === "legacy_hod_pointer"
              ? "Compatibility department scope"
              : "Provisional school-role scope"}
        </strong>
        {" · "}
        {data.mappingDetail}
      </div>

      <WorkspaceWorkSummary label="Department work and outcomes" />

      {unlinked > 0 && (
        <div style={{ color: C.amb, fontSize: 12, marginBottom: 18 }}>
          {unlinked} {unlinked === 1 ? "class is" : "classes are"} not linked to retrieval
          practice and therefore contribute no mastery evidence.
        </div>
      )}

      {(data.years || []).length > 1 && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
          {(["all", ...(data.years || [])] as Array<number | "all">).map((value) => (
            <button
              key={String(value)}
              onClick={() => setYear(value)}
              style={{
                padding: "6px 11px",
                color: year === value ? C.accentFg : C.muted,
                background: year === value ? C.accent : "transparent",
                border: `1px solid ${year === value ? C.accent : C.border}`,
                borderRadius: 999,
                fontFamily: C.mono,
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              {value === "all" ? "All years" : `Year ${value}`}
            </button>
          ))}
        </div>
      )}

      <SectionLabel>Weakest objectives · retrieval evidence</SectionLabel>
      <ObjectiveMasteryPanel
        rows={data.objectiveMastery}
        objectiveBase="/objective"
      />

      <SectionLabel>Classes · {classes.length}</SectionLabel>
      <div
        style={{
          border: `1px solid ${C.border}`,
          background: C.surface,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {classes.length === 0 ? (
          <div style={{ padding: 18, color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            No classes resolve to this department scope yet.
          </div>
        ) : (
          classes.map((row, index) => {
            const average = row.weak.length
              ? Math.round(
                  row.weak.reduce((sum, item) => sum + item.pct_correct, 0) /
                    row.weak.length,
                )
              : null;
            const discipline =
              DISC[row.discipline as keyof typeof DISC] || DISC.combined;
            return (
              <a
                key={row.class_id}
                href={`/class/${row.class_id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(150px, .7fr) 80px",
                  gap: 14,
                  alignItems: "center",
                  padding: "13px 15px",
                  borderTop: index === 0 ? "none" : `1px solid ${C.rule}`,
                  color: C.text,
                  textDecoration: "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: discipline.color,
                      }}
                    />
                    <strong style={{ fontSize: 13 }}>{row.name}</strong>
                    <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 9 }}>
                      Y{row.year_group}
                    </span>
                  </div>
                  <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 9, marginTop: 5, paddingLeft: 15 }}>
                    {row.teacher_name || "Teacher not resolved"}
                  </div>
                </div>
                <span
                  style={{
                    color: C.muted,
                    fontSize: 11,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.weak[0]?.topic_name || (row.linked ? "Awaiting evidence" : "Not linked")}
                </span>
                <span
                  style={{
                    color: average == null ? C.dim : heat(average),
                    fontFamily: C.mono,
                    fontSize: 12,
                    textAlign: "right",
                  }}
                >
                  {average == null ? "—" : `${average}%`} →
                </span>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 11,
        alignItems: "center",
        color: C.dim,
        fontFamily: C.mono,
        fontSize: 9,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        margin: "24px 0 11px",
      }}
    >
      <span style={{ width: 22, height: 1, background: C.ruleStrong }} />
      <span>{children}</span>
      <span style={{ height: 1, background: C.rule, flex: 1 }} />
    </div>
  );
}

export default function DepartmentPage() {
  return (
    <AppShell>
      <DepartmentContent />
    </AppShell>
  );
}
