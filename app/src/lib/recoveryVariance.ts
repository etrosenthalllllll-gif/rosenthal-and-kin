// Expected-vs-actual comparison + variance rules -- doc 10 sections
// 8-9. PLAN.md P9-3.
//
// "Automatically compare expected gross recovery versus actual gross
// recovery. If variance exceeds a configured threshold, create a
// review task. Create configurable variance thresholds: difference <=
// $25 -- normal; difference <= 1% -- review optional; difference > 1%
// -- operator review; difference > a configured critical threshold --
// mandatory review. Do not hardcode financial thresholds."

export interface VarianceThresholds {
  normalMaxAbsoluteDifferenceCents: number;
  reviewOptionalMaxPercent: number;
  mandatoryReviewMinPercent: number;
}

// doc 10 section 9's own worked example, verbatim, as a config default
// rather than hardcoded inline in the classifier.
export const DEFAULT_VARIANCE_THRESHOLDS: VarianceThresholds = {
  normalMaxAbsoluteDifferenceCents: 2500, // $25
  reviewOptionalMaxPercent: 1,
  mandatoryReviewMinPercent: 10,
};

export type VarianceLevel = "NORMAL" | "REVIEW_OPTIONAL" | "OPERATOR_REVIEW" | "MANDATORY_REVIEW";

export interface RecoveryVarianceResult {
  expectedCents: number;
  actualCents: number;
  differenceCents: number;
  percentDifference: number | null;
  level: VarianceLevel;
}

/**
 * Pure: doc 10 sections 8-9. `percentDifference` is null when
 * `expectedCents` is 0 -- a percentage against zero has no meaning, so
 * the classifier falls back to the absolute-difference tiers only in
 * that case (never divides by zero, never guesses a percentage).
 */
export function evaluateRecoveryVariance(
  expectedCents: number,
  actualCents: number,
  thresholds: VarianceThresholds = DEFAULT_VARIANCE_THRESHOLDS
): RecoveryVarianceResult {
  const differenceCents = actualCents - expectedCents;
  const absDifference = Math.abs(differenceCents);
  const percentDifference = expectedCents !== 0 ? (absDifference / Math.abs(expectedCents)) * 100 : null;

  let level: VarianceLevel;
  if (absDifference <= thresholds.normalMaxAbsoluteDifferenceCents) {
    level = "NORMAL";
  } else if (percentDifference != null && percentDifference >= thresholds.mandatoryReviewMinPercent) {
    level = "MANDATORY_REVIEW";
  } else if (percentDifference != null && percentDifference <= thresholds.reviewOptionalMaxPercent) {
    level = "REVIEW_OPTIONAL";
  } else {
    level = "OPERATOR_REVIEW";
  }

  return { expectedCents, actualCents, differenceCents, percentDifference, level };
}
