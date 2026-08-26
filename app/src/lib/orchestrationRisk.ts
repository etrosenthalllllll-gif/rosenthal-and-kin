// Orchestration safety: risk levels + high-risk action gates -- doc 11
// sections 76-78. PLAN.md P10-18.
//
// "The orchestration system must distinguish REVERSIBLE ACTIONS from
// IRREVERSIBLE ACTIONS... higher-risk actions should have stronger
// approval requirements." / "Assign each action: LOW, MEDIUM, HIGH,
// CRITICAL. Example: Generate internal summary: LOW. Draft email: LOW.
// Send email: MEDIUM. Submit claim: HIGH. Move/distribute funds:
// CRITICAL. Case closure: HIGH." / "Even if AI confidence is extremely
// high: HIGH and CRITICAL actions may still require human approval
// according to configuration. Do not allow confidence alone to bypass
// required controls."
//
// Extends the existing `highConsequence` boolean already used on
// `decisionTypes.ts` (APPROVE_DISTRIBUTION, APPROVE_CLAIM_PACKAGE,
// etc.) into a full four-level scale rather than replacing it -- a
// HIGH/CRITICAL action here should map to `highConsequence: true`
// there.

export type ActionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ActionReversibility = "REVERSIBLE" | "IRREVERSIBLE";

// doc 11 §77's own worked examples, verbatim.
export const DEFAULT_ACTION_RISK_TABLE: Readonly<Record<string, ActionRiskLevel>> = {
  GENERATE_INTERNAL_SUMMARY: "LOW",
  DRAFT_EMAIL: "LOW",
  SEND_EMAIL: "MEDIUM",
  SUBMIT_CLAIM: "HIGH",
  DISTRIBUTE_FUNDS: "CRITICAL",
  CLOSE_CASE: "HIGH",
};

/**
 * Pure: an action type this table has never seen is treated as
 * CRITICAL -- the highest risk level, never the lowest -- same
 * fail-closed-on-unrecognized-input discipline used everywhere else in
 * this codebase (complianceRules.ts, retryEngine.ts's UNKNOWN
 * classification, etc.).
 */
export function getActionRiskLevel(
  actionType: string,
  table: Readonly<Record<string, ActionRiskLevel>> = DEFAULT_ACTION_RISK_TABLE
): ActionRiskLevel {
  return table[actionType] ?? "CRITICAL";
}

const HIGH_RISK_LEVELS: ReadonlySet<ActionRiskLevel> = new Set(["HIGH", "CRITICAL"]);

/**
 * doc 11 §78 -- HIGH/CRITICAL actions require human approval
 * regardless of how confident the AI recommendation is. This is the
 * gate a workflow step must pass through before treating high
 * confidence as sufficient on its own.
 */
export function requiresHumanApprovalRegardlessOfConfidence(riskLevel: ActionRiskLevel): boolean {
  return HIGH_RISK_LEVELS.has(riskLevel);
}

export type OrchestrationSafetyDecision = "AUTOMATED_ACTION_ALLOWED" | "HUMAN_APPROVAL_REQUIRED";

/**
 * Pure: combines doc 11 §20's rule+confidence combination (P10-5) with
 * §78's risk override -- even an "AUTOMATED_ACTION_ALLOWED" verdict
 * from the confidence gate is downgraded to human approval when the
 * action's own risk level is HIGH or CRITICAL. Confidence alone can
 * never bypass this.
 */
export function evaluateOrchestrationSafety(
  riskLevel: ActionRiskLevel,
  ruleConfidenceDecision: "AUTOMATED_ACTION_ALLOWED" | "HUMAN_REVIEW_REQUIRED" | "BLOCKED_RULE_FAILED"
): OrchestrationSafetyDecision | "BLOCKED_RULE_FAILED" {
  if (ruleConfidenceDecision === "BLOCKED_RULE_FAILED") return "BLOCKED_RULE_FAILED";
  if (requiresHumanApprovalRegardlessOfConfidence(riskLevel)) return "HUMAN_APPROVAL_REQUIRED";
  return ruleConfidenceDecision === "AUTOMATED_ACTION_ALLOWED" ? "AUTOMATED_ACTION_ALLOWED" : "HUMAN_APPROVAL_REQUIRED";
}
