// Submission authorization + automation levels + human override -- doc
// 08 sections 28, 52-53. PLAN.md P7-11.
//
// "Implement configurable filing authorization: MANUAL_APPROVAL_REQUIRED
// or AUTOMATIC_SUBMISSION_AFTER_CONFIGURED_APPROVAL. Support 4
// automation levels (manual, operator-clicks-submit, automatic after
// case-level approval, automatic for low-risk configured filings).
// Any filing involving configured high-risk conditions must require
// human approval regardless of level. Authorized operators may
// override certain automated states, but the override must require a
// reason/operator/timestamp/affected rule, and must never silently
// override a hard blocker."
//
// Pure decision layer, same shape as claimCompletenessEngine.ts's
// (P6-13) hard-blocker-vs-soft-signal split: BLOCKED_NOT_READY is
// never overridable when the underlying reason is a hard blocker,
// mirroring "no score can override a hard blocker" there.

export type FilingAuthorizationMode = "MANUAL_APPROVAL_REQUIRED" | "AUTOMATIC_SUBMISSION_AFTER_CONFIGURED_APPROVAL";

// doc 08 section 52's own 4-level ladder, verbatim.
export type AutomationLevel = 1 | 2 | 3 | 4;

export const AUTOMATION_LEVEL_DESCRIPTIONS: Record<AutomationLevel, string> = {
  1: "Manual filing.",
  2: "System prepares submission, operator clicks submit.",
  3: "System submits automatically after explicit case-level approval.",
  4: "Configured low-risk filings may automatically submit after all deterministic requirements are satisfied.",
};

export interface SubmissionAuthorizationInput {
  mode: FilingAuthorizationMode;
  automationLevel: AutomationLevel;
  // doc 08 section 52: "Any filing involving configured high-risk
  // conditions must require human approval" -- regardless of level or
  // mode.
  isHighRiskCondition: boolean;
  readinessOutcome: "READY" | "NOT_READY";
  operatorExplicitlyClickedSubmit: boolean;
  caseLevelApprovalGranted: boolean;
}

export type SubmissionAuthorizationDecision =
  | "AUTHORIZED"
  | "REQUIRES_OPERATOR_SUBMIT"
  | "REQUIRES_CASE_APPROVAL"
  | "BLOCKED_NOT_READY";

/**
 * Pure: doc 08 sections 28, 52. A filing that isn't READY is never
 * authorized regardless of mode/level -- readiness always wins.
 * High-risk conditions always require an explicit operator submit,
 * even at automation level 4. Otherwise the mode/level determine what
 * still needs a human action before submission proceeds.
 */
export function evaluateSubmissionAuthorization(
  input: SubmissionAuthorizationInput
): SubmissionAuthorizationDecision {
  if (input.readinessOutcome !== "READY") return "BLOCKED_NOT_READY";
  if (input.isHighRiskCondition) {
    return input.operatorExplicitlyClickedSubmit ? "AUTHORIZED" : "REQUIRES_OPERATOR_SUBMIT";
  }

  if (input.mode === "MANUAL_APPROVAL_REQUIRED") {
    return input.operatorExplicitlyClickedSubmit ? "AUTHORIZED" : "REQUIRES_OPERATOR_SUBMIT";
  }

  switch (input.automationLevel) {
    case 1:
    case 2:
      return input.operatorExplicitlyClickedSubmit ? "AUTHORIZED" : "REQUIRES_OPERATOR_SUBMIT";
    case 3:
      return input.caseLevelApprovalGranted ? "AUTHORIZED" : "REQUIRES_CASE_APPROVAL";
    case 4:
      return "AUTHORIZED";
  }
}

// --- Human override (doc 08 section 53) -------------------------------

export interface HumanOverride {
  reason: string;
  operatorId: string;
  timestamp: string;
  affectedRule: string;
  note?: string;
}

export interface OverrideResult {
  authorized: boolean;
  reason?: string;
}

function isCompleteOverride(override: HumanOverride): boolean {
  return Boolean(override.reason && override.operatorId && override.timestamp && override.affectedRule);
}

/**
 * Pure: doc 08 section 53. A hard blocker can never be silently
 * overridden -- no override record, however complete, changes that.
 * For a soft (non-hard-blocker) decision, the override must still
 * supply reason/operator/timestamp/affected rule in full; a partial
 * override record is rejected rather than accepted with gaps.
 */
export function applyHumanOverride(
  decision: SubmissionAuthorizationDecision,
  override: HumanOverride,
  isHardBlocker: boolean
): OverrideResult {
  if (decision === "AUTHORIZED") return { authorized: true };

  if (isHardBlocker) {
    return { authorized: false, reason: "A hard blocker can never be silently overridden." };
  }

  if (!isCompleteOverride(override)) {
    return { authorized: false, reason: "Override requires a reason, operator, timestamp, and affected rule." };
  }

  return { authorized: true };
}
