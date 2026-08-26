// Ties an operator action (Approve/Reject/Revise/Escalate, etc.) to both
// the Decision status machine and, where applicable, the Claimant
// lifecycle state machine -- doc 02: "Operator clicks YES / NO / REVISE
// / APPROVE / REJECT / ESCALATE -> the system executes the selected
// action -> the case advances automatically."
//
// This module never touches a database -- it's pure decision logic,
// dependency-free, so it's fully unit-testable before P0-10 unblocks a
// real Postgres instance. The API layer that eventually calls this is
// responsible for loading the current state, calling these functions,
// persisting the result, and calling recordAuditEvent (src/lib/audit.ts)
// for both the decision and (if one occurred) the claimant transition --
// as one atomic operation, per doc 02 section 6's numbered list.

import { getDecisionTypeConfig, isActionAvailable } from "./decisionTypes";
import {
  assertValidDecisionTransition,
  canTransitionDecision,
  type DecisionStatus,
} from "./decisionStatus";
import { assertValidTransition, type ClaimantStatus } from "./stateMachine";

// Generic action -> resulting decision status. Not every decision type
// uses every action, but the mapping is action-semantics-based rather
// than duplicated per decision type -- see decisionTypes.ts for which
// actions are actually available on which type.
const ACTION_STATUS_MAP: Record<string, DecisionStatus> = {
  SEND: "APPROVED",
  APPROVE: "APPROVED",
  APPROVE_AND_FILE: "APPROVED",
  VERIFY: "APPROVED",
  CLOSE_CASE: "APPROVED",
  REJECT: "REJECTED",
  REJECT_CASE: "REJECTED",
  REVISE: "REVISED",
  REVISE_PACKAGE: "REVISED",
  ESCALATE: "ESCALATED",
  REQUEST_MORE_EVIDENCE: "DEFERRED",
  REQUEST_DOCUMENT: "DEFERRED",
  CANCEL: "CANCELLED",
  KEEP_OPEN: "DEFERRED",
};

export class MissingRequiredCommentError extends Error {
  constructor(decisionType: string, action: string) {
    super(
      `Decision type "${decisionType}" requires a comment/reason for action "${action}"`
    );
    this.name = "MissingRequiredCommentError";
  }
}

export class UnavailableActionError extends Error {
  constructor(decisionType: string, action: string) {
    super(`Action "${action}" is not available for decision type "${decisionType}"`);
    this.name = "UnavailableActionError";
  }
}

export interface ApplyDecisionActionInput {
  decisionType: string;
  currentStatus: DecisionStatus;
  action: string;
  reason?: string;
}

export interface ApplyDecisionActionResult {
  newStatus: DecisionStatus;
}

/**
 * Validates and applies one operator action to one decision. Throws
 * before returning anything if the action isn't configured for this
 * decision type, if a required comment is missing, or if the resulting
 * status transition isn't legal -- never silently no-ops or guesses.
 */
export function applyDecisionAction(
  input: ApplyDecisionActionInput
): ApplyDecisionActionResult {
  const config = getDecisionTypeConfig(input.decisionType);

  if (!isActionAvailable(input.decisionType, input.action)) {
    throw new UnavailableActionError(input.decisionType, input.action);
  }

  if (config.requiresComment && !input.reason?.trim()) {
    throw new MissingRequiredCommentError(input.decisionType, input.action);
  }

  const newStatus = ACTION_STATUS_MAP[input.action];
  if (!newStatus) {
    throw new Error(`No status mapping defined for action "${input.action}"`);
  }

  assertValidDecisionTransition(input.currentStatus, newStatus);

  return { newStatus };
}

// --- Concrete wiring example: APPROVE_CLAIMANT -----------------------------
//
// Demonstrates the actual doc 02 <-> doc 00 wiring requirement (PLAN.md
// P1-2) rather than leaving the two state machines merely
// theoretically compatible. Real per-workflow wiring (outreach ->
// CONTACTED, document received -> DOCUMENTS_COMPLETE, etc.) gets built
// out as each pipeline phase (04-10) is implemented; this is the pattern
// they'll all follow.

export interface ApproveClaimantResult extends ApplyDecisionActionResult {
  claimantStatus: ClaimantStatus;
}

/**
 * Applies an APPROVE_CLAIMANT decision action, and -- only when the
 * decision resolves to APPROVED -- advances the linked claimant from
 * POTENTIAL_HEIR to VERIFIED via the claimant state machine. Any other
 * action (REJECT, REQUEST_MORE_EVIDENCE, ESCALATE) updates the decision
 * only; the claimant's state machine is only ever touched on approval,
 * since request-more-evidence/reject don't mean "verified."
 */
export function applyApproveClaimantDecision(input: {
  currentDecisionStatus: DecisionStatus;
  currentClaimantStatus: ClaimantStatus;
  action: string;
  reason?: string;
}): ApproveClaimantResult {
  const { newStatus } = applyDecisionAction({
    decisionType: "APPROVE_CLAIMANT",
    currentStatus: input.currentDecisionStatus,
    action: input.action,
    reason: input.reason,
  });

  let claimantStatus = input.currentClaimantStatus;
  if (newStatus === "APPROVED") {
    assertValidTransition(input.currentClaimantStatus, "VERIFIED");
    claimantStatus = "VERIFIED";
  }

  return { newStatus, claimantStatus };
}

export { ACTION_STATUS_MAP, canTransitionDecision };
