// Confidence thresholds + rule/confidence combination -- doc 11
// sections 17-20. PLAN.md P10-5.
//
// "Create configurable confidence bands... These thresholds must be
// configurable by workflow. Do not hardcode these exact values." /
// "HIGH confidence -> automatic action permitted. MEDIUM confidence ->
// operator review. LOW confidence -> exception queue." / "Rule: FAIL,
// AI confidence: 99% -> do not override deterministic failure.
// Deterministic rules should take precedence over probabilistic AI
// recommendations."
//
// Same confidence-scored, never-guess-past-a-threshold discipline
// already used everywhere an AI recommendation feeds this codebase
// (matchConversationToCase.ts, etc.) -- formalized here as the shared
// gate every workflow step routes an AI recommendation through.

export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW";

export interface ConfidenceBandThresholds {
  // Doc 11 §18's own example values (>=95% HIGH, 80-94.99% MEDIUM,
  // <80% LOW) are illustrative only -- callers configure their own
  // per workflow rather than this module hardcoding them.
  highMinPercent: number;
  mediumMinPercent: number;
}

/**
 * Pure: classifies a confidence percentage into HIGH/MEDIUM/LOW using
 * caller-supplied, per-workflow thresholds (never the hardcoded doc
 * example values).
 */
export function classifyConfidence(confidencePercent: number, thresholds: ConfidenceBandThresholds): ConfidenceBand {
  if (confidencePercent >= thresholds.highMinPercent) return "HIGH";
  if (confidencePercent >= thresholds.mediumMinPercent) return "MEDIUM";
  return "LOW";
}

export type ConfidenceAction = "AUTOMATIC_ACTION_PERMITTED" | "OPERATOR_REVIEW" | "EXCEPTION_QUEUE";

const DEFAULT_ACTION_FOR_BAND: Record<ConfidenceBand, ConfidenceAction> = {
  HIGH: "AUTOMATIC_ACTION_PERMITTED",
  MEDIUM: "OPERATOR_REVIEW",
  LOW: "EXCEPTION_QUEUE",
};

export function actionForConfidenceBand(band: ConfidenceBand): ConfidenceAction {
  return DEFAULT_ACTION_FOR_BAND[band];
}

export type RuleConfidenceDecision = "AUTOMATED_ACTION_ALLOWED" | "HUMAN_REVIEW_REQUIRED" | "BLOCKED_RULE_FAILED";

/**
 * doc 11 §20's combination table, verbatim:
 *   Rule PASS + HIGH confidence  -> automated action allowed
 *   Rule PASS + MEDIUM/LOW       -> human review
 *   Rule FAIL + any confidence   -> BLOCKED (never overridden)
 *
 * A rule FAIL always wins regardless of how confident the AI
 * recommendation is -- deterministic rules outrank probabilistic
 * confidence, never the other way around.
 */
export function combineRuleAndConfidence(rulePassed: boolean, band: ConfidenceBand): RuleConfidenceDecision {
  if (!rulePassed) return "BLOCKED_RULE_FAILED";
  return band === "HIGH" ? "AUTOMATED_ACTION_ALLOWED" : "HUMAN_REVIEW_REQUIRED";
}

export interface ConfidenceRecommendation {
  recommendation: string;
  confidencePercent: number;
  evidence?: string;
  model?: string;
  modelVersion?: string;
  timestamp: string;
}

/**
 * Pure convenience wrapper: given a rule pass/fail plus a full AI
 * recommendation record, returns the combined decision and the band it
 * was classified into -- so a caller only needs to store one object
 * for the audit trail rather than re-deriving the band later.
 */
export function evaluateRuleAndConfidence(
  rulePassed: boolean,
  recommendation: ConfidenceRecommendation,
  thresholds: ConfidenceBandThresholds
): { decision: RuleConfidenceDecision; band: ConfidenceBand } {
  const band = classifyConfidence(recommendation.confidencePercent, thresholds);
  return { decision: combineRuleAndConfidence(rulePassed, band), band };
}
