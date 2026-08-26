// Human-review triggers + risk-based review levels -- doc 06 sections
// 28-29, 46. PLAN.md P5-9.
//
// "Create configurable review triggers. Trigger human review when:
// Identity confidence is below threshold, Two people could plausibly
// match, Critical documents conflict, Relationship evidence
// conflicts, Competing heir is detected, Genealogy branch is
// incomplete, Important source is ambiguous, Evidence is
// insufficient, AI cannot explain its conclusion, Human explicitly
// requests review, Case reaches a configured high-risk stage,
// Automated verification produces inconsistent results." / "Not every
// uncertainty should receive the same treatment. Create risk levels:
// LOW / MEDIUM / HIGH / CRITICAL... Review thresholds should be
// configurable."
//
// This module composes the outputs earlier P5 modules already produce
// (identityResolution.ts's POSSIBLE_MATCH, relationshipVerification.ts's
// CONFLICTED, conflictDetection.ts's severity, competingHeirDetection.ts's
// REQUIRES_REVIEW, genealogyGraph.ts's incompleteness) into one
// centralized trigger table + evaluator -- same config-table
// discipline as communicationClassification.ts/decisionTypes.ts,
// rather than each caller deciding independently whether something
// warrants review.

export type ReviewTriggerType =
  | "IDENTITY_CONFIDENCE_BELOW_THRESHOLD"
  | "PLAUSIBLE_IDENTITY_MATCH_AMBIGUITY" // "two people could plausibly match"
  | "CRITICAL_DOCUMENT_CONFLICT"
  | "RELATIONSHIP_EVIDENCE_CONFLICT"
  | "COMPETING_HEIR_DETECTED"
  | "GENEALOGY_BRANCH_INCOMPLETE"
  | "AMBIGUOUS_SOURCE"
  | "INSUFFICIENT_EVIDENCE"
  | "AI_CANNOT_EXPLAIN_CONCLUSION"
  | "OPERATOR_REQUESTED_REVIEW"
  | "HIGH_RISK_WORKFLOW_STAGE"
  | "INCONSISTENT_AUTOMATED_RESULTS";

export type ReviewRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// doc 06 section 28's trigger list, each mapped to a risk level per
// section 29's own worked examples (a potential second child is HIGH;
// two people possibly being the same claimant, or a competing heir
// found mid-claim-prep per section 46, are both CRITICAL). A trigger
// not in this table fails closed to CRITICAL in getTriggerRisk() below
// -- same discipline as conflictDetection.ts's classifyConflictSeverity().
export const REVIEW_TRIGGER_RISK: Record<ReviewTriggerType, ReviewRiskLevel> = {
  IDENTITY_CONFIDENCE_BELOW_THRESHOLD: "MEDIUM",
  PLAUSIBLE_IDENTITY_MATCH_AMBIGUITY: "CRITICAL", // doc 06 sec 29: "Two people may be the same claimant"
  CRITICAL_DOCUMENT_CONFLICT: "CRITICAL",
  RELATIONSHIP_EVIDENCE_CONFLICT: "HIGH",
  COMPETING_HEIR_DETECTED: "CRITICAL", // doc 06 sec 46's own example
  GENEALOGY_BRANCH_INCOMPLETE: "MEDIUM",
  AMBIGUOUS_SOURCE: "MEDIUM",
  INSUFFICIENT_EVIDENCE: "MEDIUM",
  AI_CANNOT_EXPLAIN_CONCLUSION: "HIGH",
  OPERATOR_REQUESTED_REVIEW: "HIGH", // an explicit human ask is always honored
  HIGH_RISK_WORKFLOW_STAGE: "HIGH",
  INCONSISTENT_AUTOMATED_RESULTS: "HIGH",
};

const RISK_ORDER: Record<ReviewRiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export function getTriggerRisk(type: ReviewTriggerType): ReviewRiskLevel {
  return REVIEW_TRIGGER_RISK[type] ?? "CRITICAL";
}

export interface ReviewTriggerInput {
  type: ReviewTriggerType;
  detail?: string;
}

export interface FiredReviewTrigger {
  type: ReviewTriggerType;
  risk: ReviewRiskLevel;
  detail?: string;
}

export interface ReviewEvaluationResult {
  // doc 06 section 28 is unconditional: any one of these firing means
  // review is required, full stop -- there's no "3 low-risk triggers
  // don't count" exception anywhere in the doc.
  requiresReview: boolean;
  // null only when nothing fired -- never a default LOW, since "no
  // triggers fired" and "a LOW-risk trigger fired" are different facts.
  overallRisk: ReviewRiskLevel | null;
  firedTriggers: FiredReviewTrigger[];
}

/**
 * Pure: doc 06 sections 28-29. Evaluates whichever triggers already
 * fired (each produced elsewhere -- P5-2 identity ambiguity, P5-3
 * relationship conflicts, P5-6 document conflicts, P5-8 competing
 * heirs, P5-4 genealogy completeness) into one review decision plus
 * the single highest risk level among them, so a dashboard can prioritize
 * without re-deriving severity per trigger type itself.
 */
export function evaluateReviewTriggers(
  inputs: readonly ReviewTriggerInput[]
): ReviewEvaluationResult {
  const firedTriggers: FiredReviewTrigger[] = inputs.map((input) => ({
    type: input.type,
    risk: getTriggerRisk(input.type),
    detail: input.detail,
  }));

  if (firedTriggers.length === 0) {
    return { requiresReview: false, overallRisk: null, firedTriggers: [] };
  }

  const overallRisk = firedTriggers.reduce<ReviewRiskLevel>(
    (highest, trigger) => (RISK_ORDER[trigger.risk] > RISK_ORDER[highest] ? trigger.risk : highest),
    "LOW"
  );

  return { requiresReview: true, overallRisk, firedTriggers };
}
