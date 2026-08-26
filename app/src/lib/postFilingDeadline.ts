// Deadline model + sources/calculation/confidence -- doc 09 sections
// 20-23. PLAN.md P8-7.
//
// "Every deadline must identify its source. Do not present an
// AI-inferred deadline as an official deadline. Where rules specify
// deadlines, preserve the calculation inputs (rule id/version, trigger
// date, calculation, result). If a deadline is extracted from an
// ambiguous document or message, mark CONFIDENCE and SOURCE; if
// ambiguity exists, REQUIRES_REVIEW. Do not automatically create a
// hard deadline from uncertain information."

// doc 09 section 20's own status list, verbatim.
export type DeadlineStatus = "UPCOMING" | "DUE_SOON" | "DUE_TODAY" | "OVERDUE" | "COMPLETED" | "WAIVED" | "CANCELLED" | "UNKNOWN";

// doc 09 section 21's own source list, verbatim.
export type DeadlineSource =
  | "OFFICIAL_AUTHORITY"
  | "FILING_RULE"
  | "COURT_EVENT"
  | "PROVIDER_REQUEST"
  | "OPERATOR_CREATED"
  | "CLAIMANT_COMMUNICATION";

export type DeadlineConfidence = "CONFIRMED" | "REQUIRES_REVIEW";

/**
 * Pure: doc 09 section 24's own DUE_SOON/OVERDUE distinctions,
 * computed from days remaining rather than hardcoded per-deadline.
 * `dueSoonThresholdDays` is configurable so different deadline types
 * can use a tighter or looser "soon" window.
 */
export function classifyDeadlineStatus(daysRemaining: number, dueSoonThresholdDays = 3): DeadlineStatus {
  if (daysRemaining < 0) return "OVERDUE";
  if (daysRemaining === 0) return "DUE_TODAY";
  if (daysRemaining <= dueSoonThresholdDays) return "DUE_SOON";
  return "UPCOMING";
}

export interface DeadlineCalculationInput {
  source: DeadlineSource;
  dueDate: string;
  // doc 09 section 22: preserved verbatim on the resulting record so
  // the calculation stays auditable, not just the final date.
  ruleId?: string;
  ruleVersion?: string;
  triggerDate?: string;
  calculationDescription?: string;
  // doc 09 section 23: whether this deadline was extracted from
  // ambiguous source text -- ANY ambiguity forces REQUIRES_REVIEW,
  // regardless of source.
  isAmbiguous: boolean;
}

export interface DeadlineRecord {
  source: DeadlineSource;
  dueDate: string;
  confidence: DeadlineConfidence;
  ruleId?: string;
  ruleVersion?: string;
  triggerDate?: string;
  calculationDescription?: string;
}

/**
 * Pure: doc 09 sections 21-23. Every deadline requires an explicit
 * source (the type system enforces this at the caller level -- there's
 * no "unknown source" option to silently fall back to). An ambiguous
 * extraction always yields REQUIRES_REVIEW; this function never
 * "automatically creates a hard deadline from uncertain information" --
 * the caller is responsible for treating REQUIRES_REVIEW as
 * provisional, not authoritative, until reviewed.
 */
export function buildDeadlineRecord(input: DeadlineCalculationInput): DeadlineRecord {
  return {
    source: input.source,
    dueDate: input.dueDate,
    confidence: input.isAmbiguous ? "REQUIRES_REVIEW" : "CONFIRMED",
    ruleId: input.ruleId,
    ruleVersion: input.ruleVersion,
    triggerDate: input.triggerDate,
    calculationDescription: input.calculationDescription,
  };
}
