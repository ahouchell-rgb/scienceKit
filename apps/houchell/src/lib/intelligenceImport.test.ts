import { describe, expect, it } from "vitest";
import {
  parseIntelligenceCsv,
  validateImportRow,
} from "./intelligenceImport";

describe("intelligence data imports", () => {
  it("parses quoted CSV and normalises headers", () => {
    const parsed = parseIntelligenceCsv(
      'Source Record ID,Pupil Source Record ID,Assessment Name\nrow-1,pupil-1,"Reading, standardised"\n',
    );
    expect(parsed.headers).toEqual([
      "source_record_id",
      "pupil_source_record_id",
      "assessment_name",
    ]);
    expect(parsed.rows[0].assessment_name).toBe("Reading, standardised");
  });

  it("validates attendance without guessing the pupil identity", () => {
    const result = validateImportRow("attendance", {
      source_record_id: "att-1",
      pupil_source_system: "mis_student",
      pupil_source_record_id: "mis-42",
      date: "2026-07-29",
      present: "yes",
      minutes_late: "4",
    });
    expect(result.errors).toEqual([]);
    expect(result.row).toMatchObject({
      pupilSourceRecordId: "mis-42",
      values: { sessionDate: "2026-07-29", present: true, minutesLate: 4 },
    });
  });

  it("rejects invalid literacy measures and dates", () => {
    const result = validateImportRow("literacy", {
      source_record_id: "lit-1",
      pupil_source_system: "mis_student",
      pupil_source_record_id: "mis-42",
      assessed_at: "not-a-date",
      measure: "",
      value: "not-a-number",
    });
    expect(result.errors).toContain("assessed_at must be a valid date/time");
    expect(result.errors).toContain("measure is required");
    expect(result.errors).toContain("value must be numeric");
  });

  it("rejects unsupported session and literacy vocabularies before database insert", () => {
    expect(validateImportRow("attendance", {
      source_record_id: "att-2",
      pupil_source_system: "mis_student",
      pupil_source_record_id: "mis-42",
      date: "2026-07-29",
      present: "yes",
      session: "lunchtime",
    }).errors).toContain("session must be morning, afternoon, lesson or full_day");
    expect(validateImportRow("literacy", {
      source_record_id: "lit-2",
      pupil_source_system: "mis_student",
      pupil_source_record_id: "mis-42",
      assessed_at: "2026-07-29",
      measure: "reading_vibes",
      value: "90",
    }).errors).toContain("measure is not a supported literacy measure");
  });
});
