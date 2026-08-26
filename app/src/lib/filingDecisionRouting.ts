// Filing decision-dashboard integration -- doc 08 sections 39-42, 48,
// 51, 58. PLAN.md P7-18 (part 3 of 4).
//
// "All exceptions should flow into the existing Decision Dashboard."
//
// Same wiring-layer role as claimPackageDecisionRouting.ts (P6-17)/
// documentDecisionRouting.ts (P4-14): composes filingRejection.ts
// (P7-16), filingCorrection.ts's duplicate-filing check (P7-17), and
// filingTrackingReconciliation.ts's reconciliation result (P7-15) into
// DecisionRecommendations against decisionTypes.ts's
// REVIEW_FILING_EXCEPTION entry. Pure -- no live Decision row created
// here.

import type { DecisionTypeKey } from "./decisionTypes";
import type { RejectionRecord } from "./filingRejection";
import type { DuplicateFilingCheckResult } from "./filingCorrection";
import type { ReconciliationResult } from "./filingTrackingReconciliation";

export interface DecisionRecommendation {
  decisionTypeKey: DecisionTypeKey;
  reason: string;
  evidenceRefs: string[];
}

/**
 * Pure: doc 08 sections 39-42. Only a rejection whose severity
 * requires human review (HIGH/CRITICAL, per filingRejection.ts)
 * becomes a decision -- a LOW/MEDIUM rejection is informational and
 * doesn't need one.
 */
export function planFilingRejectionDecision(
  filingId: string,
  rejection: RejectionRecord
): DecisionRecommendation | null {
  if (!rejection.requiresHumanReview) return null;

  return {
    decisionTypeKey: "REVIEW_FILING_EXCEPTION",
    reason: `Filing rejected (${rejection.category}, severity ${rejection.severity}): ${rejection.rawProviderMessage}`,
    evidenceRefs: [filingId],
  };
}

/**
 * Pure: doc 08 section 48. A PAUSE_REQUIRES_REVIEW duplicate-filing
 * check always becomes a decision -- PROCEED needs none.
 */
export function planDuplicateFilingDecision(
  filingId: string,
  check: DuplicateFilingCheckResult
): DecisionRecommendation | null {
  if (check.decision !== "PAUSE_REQUIRES_REVIEW") return null;

  return {
    decisionTypeKey: "REVIEW_FILING_EXCEPTION",
    reason: `Possible duplicate filing detected: ${check.existingFilings.map((f) => f.filingId).join(", ")}.`,
    evidenceRefs: [filingId, ...check.existingFilings.map((f) => f.filingId)],
  };
}

/**
 * Pure: doc 08 section 58. A reconciliation MISMATCH always becomes a
 * decision -- MATCH needs none.
 */
export function planReconciliationDecision(
  filingId: string,
  result: ReconciliationResult
): DecisionRecommendation | null {
  if (result.outcome !== "MISMATCH") return null;

  return {
    decisionTypeKey: "REVIEW_FILING_EXCEPTION",
    reason: `Filing state mismatch: internal is "${result.internalStatus}", provider reports "${result.externalStatus}".`,
    evidenceRefs: [filingId],
  };
}
