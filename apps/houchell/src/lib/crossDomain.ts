export interface CrossDomainClassState {
  learning_mastery?: number | null;
  learning_evidence?: number | null;
  attendance_rate?: number | null;
  attendance_sessions?: number | null;
  literacy_value?: number | null;
  literacy_measure?: string | null;
  literacy_pupils?: number | null;
  pupil_count?: number | null;
}

export interface ConstraintHypothesis {
  key: "attendance_exposure" | "literacy_access" | "curriculum_or_instruction" | "insufficient_evidence";
  status: "plausible" | "not_supported" | "insufficient_evidence";
  summary: string;
  nextCheck: string;
}

export function bindingConstraintHypotheses(
  state: CrossDomainClassState,
): ConstraintHypothesis[] {
  const learning = Number(state.learning_mastery);
  const learningEvidence = Number(state.learning_evidence) || 0;
  const attendance = Number(state.attendance_rate);
  const attendanceSessions = Number(state.attendance_sessions) || 0;
  const literacy = Number(state.literacy_value);
  const literacyPupils = Number(state.literacy_pupils) || 0;
  const pupils = Math.max(1, Number(state.pupil_count) || 1);

  if (!Number.isFinite(learning) || learningEvidence < 8) {
    return [{
      key: "insufficient_evidence",
      status: "insufficient_evidence",
      summary: "There is not enough reconciled learning evidence to test a binding constraint.",
      nextCheck: "Collect or reconcile more objective-level evidence before acting.",
    }];
  }

  const hypotheses: ConstraintHypothesis[] = [];
  if (Number.isFinite(attendance) && attendanceSessions >= pupils * 5) {
    hypotheses.push({
      key: "attendance_exposure",
      status: learning < 55 && attendance < 90 ? "plausible" : "not_supported",
      summary:
        learning < 55 && attendance < 90
          ? "Low learning evidence co-occurs with reduced attendance exposure."
          : "Attendance exposure does not currently separate this learning pattern.",
      nextCheck: "Compare taught-content exposure and objective evidence for present versus frequently absent pupils; do not infer cause from this aggregate.",
    });
  } else {
    hypotheses.push({
      key: "attendance_exposure",
      status: "insufficient_evidence",
      summary: "Attendance coverage is too thin for an exposure hypothesis.",
      nextCheck: "Import at least several weeks of session attendance.",
    });
  }

  if (Number.isFinite(literacy) && literacyPupils >= Math.max(3, Math.ceil(pupils * 0.5))) {
    const standardised = String(state.literacy_measure || "").includes("standard");
    hypotheses.push({
      key: "literacy_access",
      status: learning < 55 && standardised && literacy < 90 ? "plausible" : "not_supported",
      summary:
        learning < 55 && standardised && literacy < 90
          ? "The class learning pattern co-occurs with lower standardised literacy access."
          : "The available literacy measure does not currently support an access constraint.",
      nextCheck: "Inspect vocabulary load and reading demand in the relevant curriculum materials, then test a scaffolded variant.",
    });
  } else {
    hypotheses.push({
      key: "literacy_access",
      status: "insufficient_evidence",
      summary: "Literacy coverage is not representative enough for a class hypothesis.",
      nextCheck: "Reconcile and import a recent literacy screen for at least half the class.",
    });
  }

  hypotheses.push({
    key: "curriculum_or_instruction",
    status:
      learning < 55 &&
      hypotheses.every((hypothesis) => hypothesis.status !== "plausible")
        ? "plausible"
        : "not_supported",
    summary:
      learning < 55
        ? "A curriculum sequence, explanation or practice-design constraint remains possible."
        : "The current objective estimate is not low enough to prioritise a teaching-design constraint.",
    nextCheck: "Review item-level misconceptions, lesson sequence and opportunities to practise before changing the curriculum.",
  });

  return hypotheses;
}
