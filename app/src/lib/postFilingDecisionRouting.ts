// Operator tasks + decision-dashboard + AI case summary integration --
// doc 09 sections 45-48. PLAN.md P8-14.
//
// "Every actionable exception should create a task ... all meaningful
// post-filing decisions should appear in the existing central
// dashboard ... for every important post-filing event, generate a
// concise AI summary; never hide uncertainty."
//
// Doc 09 section 45 describes an "Operator Task" shape
// (claim/delegate/complete/escalate/snooze), but section 46 is
// explicit that meaningful decisions belong in "the existing central
// dashboard" -- so, same reuse discipline as exceptionQueue.ts (P1-3)
// and every other *DecisionRouting.ts module, this doesn't stand up a
// second Task entity competing with Decision/DecisionStatus. An
// escalated post-filing case (P8-13's evaluateEscalation()) becomes a
// REVIEW_POST_FILING_EXCEPTION decision directly. AI case-summary
// generation (doc 09 sections 47-48) itself needs an AIProvider
// (blocked, same status as caseSummary.ts) -- the decision routing
// around it does not depend on that being wired up.

import type { DecisionTypeKey } from "./decisionTypes";
import type { EscalationEvaluationResult } from "./postFilingEscalation";

export interface DecisionRecommendation {
  decisionTypeKey: DecisionTypeKey;
  reason: string;
  evidenceRefs: string[];
}

/**
 * Pure: doc 09 sections 41-46. Any escalation above Normal (level > 0)
 * becomes an operator decision -- level 0 (nothing fired) needs none.
 */
export function planPostFilingEscalationDecision(
  postFilingCaseId: string,
  escalation: EscalationEvaluationResult
): DecisionRecommendation | null {
  if (escalation.level === 0) return null;

  const triggerSummary = escalation.firedTriggers.map((t) => t.type).join(", ");

  return {
    decisionTypeKey: "REVIEW_POST_FILING_EXCEPTION",
    reason: `Post-filing case escalated to level ${escalation.level} (${triggerSummary}).`,
    evidenceRefs: [postFilingCaseId],
  };
}
