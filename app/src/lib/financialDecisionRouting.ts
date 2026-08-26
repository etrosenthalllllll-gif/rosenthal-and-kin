// Financial reconciliation decision-dashboard integration -- doc 10
// section 47. PLAN.md P9-14 (part 2 of 2).
//
// Same wiring-layer role as every other *DecisionRouting.ts module:
// composes financialReconciliation.ts's (P9-14) result into a
// DecisionRecommendation against decisionTypes.ts's
// REVIEW_FINANCIAL_EXCEPTION entry.

import type { DecisionTypeKey } from "./decisionTypes";
import type { FinancialReconciliationResult } from "./financialReconciliation";

export interface DecisionRecommendation {
  decisionTypeKey: DecisionTypeKey;
  reason: string;
  evidenceRefs: string[];
}

/**
 * Pure: doc 10 section 47. Any reconciliation exception becomes a
 * decision, naming every exception type that fired -- PASS needs none.
 */
export function planFinancialReconciliationDecision(
  estateId: string,
  result: FinancialReconciliationResult
): DecisionRecommendation | null {
  if (result.outcome === "PASS") return null;

  return {
    decisionTypeKey: "REVIEW_FINANCIAL_EXCEPTION",
    reason: `Financial reconciliation exception(s): ${result.exceptions.join(", ")}.`,
    evidenceRefs: [estateId],
  };
}
