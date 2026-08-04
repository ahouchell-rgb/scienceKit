export type IntelligenceImportDomain = "attendance" | "literacy";

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export interface ValidatedImportRow {
  sourceRecordId: string;
  pupilSourceSystem: string;
  pupilSourceTenantKey: string;
  pupilSourceRecordId: string;
  values: Record<string, string | number | boolean | null>;
}

function csvCells(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseIntelligenceCsv(text: string): ParsedCsv {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = csvCells(lines[0]).map((header) =>
    header.trim().toLocaleLowerCase("en-GB").replace(/[\s-]+/g, "_"),
  );
  const rows = lines.slice(1).map((line) => {
    const cells = csvCells(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
  return { headers, rows };
}

function dateOnly(value: unknown): string | null {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : null;
}

function instant(value: unknown): string | null {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean | null {
  const text = String(value ?? "").trim().toLocaleLowerCase("en-GB");
  if (["true", "yes", "y", "1", "present"].includes(text)) return true;
  if (["false", "no", "n", "0", "absent"].includes(text)) return false;
  return null;
}

export function validateImportRow(
  domain: IntelligenceImportDomain,
  row: Record<string, unknown>,
): { row?: ValidatedImportRow; errors: string[] } {
  const errors: string[] = [];
  const sourceRecordId = String(row.source_record_id || "").trim();
  const pupilSourceSystem = String(row.pupil_source_system || "").trim();
  const pupilSourceTenantKey = String(row.pupil_source_tenant_key || "").trim();
  const pupilSourceRecordId = String(row.pupil_source_record_id || "").trim();
  if (!sourceRecordId) errors.push("source_record_id is required");
  if (!pupilSourceSystem) errors.push("pupil_source_system is required");
  if (!pupilSourceRecordId) errors.push("pupil_source_record_id is required");

  let values: Record<string, string | number | boolean | null>;
  if (domain === "attendance") {
    const sessionDate = dateOnly(row.date || row.session_date);
    const present = booleanValue(row.present);
    const sessionKind = String(row.session || row.session_kind || "full_day").trim();
    const minutesLate =
      String(row.minutes_late ?? "").trim() === "" ? 0 : numberValue(row.minutes_late);
    if (!sessionDate) errors.push("date must be YYYY-MM-DD");
    if (present == null) errors.push("present must be true/false, yes/no or 1/0");
    if (!["morning", "afternoon", "lesson", "full_day"].includes(sessionKind)) {
      errors.push("session must be morning, afternoon, lesson or full_day");
    }
    if (minutesLate == null || minutesLate < 0 || minutesLate > 1440) {
      errors.push("minutes_late must be between 0 and 1440");
    }
    values = {
      sessionDate,
      sessionKind,
      attendanceCode: String(row.attendance_code || "").trim() || null,
      present,
      minutesLate,
    };
  } else {
    const assessedAt = instant(row.assessed_at || row.date);
    const value = numberValue(row.value);
    const measure = String(row.measure || "").trim();
    if (!assessedAt) errors.push("assessed_at must be a valid date/time");
    if (!measure) errors.push("measure is required");
    if (
      measure &&
      ![
        "reading_age_months",
        "reading_standardised_score",
        "reading_fluency_wpm",
        "reading_comprehension_pct",
        "spelling_standardised_score",
        "custom",
      ].includes(measure)
    ) {
      errors.push("measure is not a supported literacy measure");
    }
    if (value == null) errors.push("value must be numeric");
    values = {
      assessedAt,
      measure,
      value,
      scale: String(row.scale || "").trim() || null,
      assessmentName: String(row.assessment_name || "").trim() || null,
    };
  }

  return errors.length
    ? { errors }
    : {
        errors,
        row: {
          sourceRecordId,
          pupilSourceSystem,
          pupilSourceTenantKey,
          pupilSourceRecordId,
          values,
        },
      };
}
