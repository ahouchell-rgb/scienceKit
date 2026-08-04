import type { IntelligenceProfile } from "./server";

export interface SchoolOption {
  id: string;
  name: string;
  trust_id?: string | null;
}

export interface IntelligenceApiState {
  enabled: boolean;
  reason?: string;
  profile?: IntelligenceProfile;
}

export interface ForecastRun {
  id: string;
  status: string;
  as_of: string;
  forecast_count: number;
  outcome_count: number;
  truncated?: boolean;
}

export interface ForecastEvaluation {
  run_id: string;
  sample_size: number;
  evaluation_status: string;
  brier_score: number | null;
  baseline_brier_score: number | null;
  brier_skill_score: number | null;
  expected_calibration_error: number | null;
  calibration_bins: Array<{
    lower: number;
    upper: number;
    count: number;
    observedRate: number | null;
  }>;
}

export interface ForecastLabResponse extends IntelligenceApiState {
  selectedSchoolId?: string;
  schools?: SchoolOption[];
  models?: any[];
  runs?: ForecastRun[];
  latestRun?: ForecastRun | null;
  latestAttempt?: ForecastRun | null;
  latestEvaluation?: ForecastEvaluation | null;
  distribution?: {
    total: number;
    buckets: Array<{ key: string; label: string; count: number }>;
    confidence?: Record<string, number>;
  };
  objectiveAggregates?: any[];
}

export interface LiveIntelligenceResponse extends IntelligenceApiState {
  classState?: any[];
  coverage?: any[];
  crossDomain?: any[];
}

export interface EvaluationSummary {
  school_id: string;
  school_name: string;
  findings: number;
  accepted_actions: number;
  artifacts_generated: number;
  deliveries_recorded: number;
  rechecks_completed: number;
  outcomes_recorded: number;
  mean_teacher_rating: number | null;
  mean_reported_minutes_saved: number | null;
  edited_artifacts: number;
  rejected_artifacts: number;
}

export interface IntelligenceEvaluationResponse extends IntelligenceApiState {
  summaries?: EvaluationSummary[];
}
