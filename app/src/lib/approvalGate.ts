// Human approval gates + expiration + multi-approval dependencies --
// doc 11 sections 21-25. PLAN.md P10-6.
//
// "Create reusable approval gates... Every approval request should
// appear in the existing decision dashboard. The operator should not
// need to search through individual conversations to find pending
// decisions." / "Approval requests may expire... Do not execute stale
// approvals automatically." / "Some actions require multiple
// approvals... Only proceed when all required approvals are
// satisfied."
//
// Reuses the existing Decision/DecisionStatus/decisionTypes.ts
// machinery rather than a second competing "ApprovalRequest" entity --
// same reuse discipline as every *DecisionRouting.ts module in this
// codebase. A gate is just a Decision whose decisionType is one of the
// approval-shaped entries in DECISION_TYPES; `deadline` is the
// expiration; DecisionStatus's EXPIRED value is what a stale approval
// becomes rather than being silently auto-executed.

import { getDecisionTypeConfig } from "./decisionTypes";

export interface ApprovalGateRequest {
  decisionType: string;
  claimantId: string;
  aiRecommendation?: string;
  aiConfidence?: number;
  evidenceRefs?: unknown;
  deadline?: string;
}

export interface PlannedApprovalDecision {
  claimantId: string;
  decisionType: string;
  availableActions: readonly string[];
  aiRecommendation?: string;
  aiConfidence?: number;
  evidenceRefs?: unknown;
  deadline?: string;
  status: "PENDING";
}

/**
 * Pure: builds the fields for a new Decision row representing an
 * approval gate -- available actions always come from the decision-
 * type registry (never hand-typed per call site), so a gate's action
 * set can't drift from what the dashboard already knows how to render.
 */
export function planApprovalGate(request: ApprovalGateRequest): PlannedApprovalDecision {
  const config = getDecisionTypeConfig(request.decisionType);
  return {
    claimantId: request.claimantId,
    decisionType: request.decisionType,
    availableActions: config.availableActions,
    aiRecommendation: request.aiRecommendation,
    aiConfidence: request.aiConfidence,
    evidenceRefs: request.evidenceRefs,
    deadline: request.deadline,
    status: "PENDING",
  };
}

export type DecisionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "APPROVED"
  | "REJECTED"
  | "REVISED"
  | "ESCALATED"
  | "DEFERRED"
  | "EXPIRED"
  | "CANCELLED"
  | "COMPLETED";

const OPEN_STATUSES: ReadonlySet<DecisionStatus> = new Set(["PENDING", "IN_PROGRESS"]);

/**
 * Pure: doc 11 §24 -- a still-open approval whose deadline has passed
 * has expired. Never treated as an implicit APPROVE; the caller is
 * expected to move it to EXPIRED (or ESCALATED, per the caller's own
 * escalation policy) rather than executing the gated action.
 */
export function isApprovalExpired(
  decision: { status: DecisionStatus; deadline?: string | null },
  now: string
): boolean {
  if (!decision.deadline) return false;
  if (!OPEN_STATUSES.has(decision.status)) return false;
  return decision.deadline < now;
}

// --- Multi-approval dependencies (doc 11 §25) -------------------------------

export type ApprovalDependencyOutcome = "ALL_APPROVED" | "AWAITING_APPROVALS" | "BLOCKED";

/**
 * Pure: doc 11 §25's "only proceed when all required approvals are
 * satisfied." Any REJECTED/CANCELLED/EXPIRED member blocks the whole
 * group outright -- a majority of approvals never overrides one
 * blocking decision, same never-silently-resolve discipline as this
 * codebase's conflict-detection modules.
 */
export function evaluateApprovalDependencies(
  decisions: readonly { id: string; status: DecisionStatus }[]
): { outcome: ApprovalDependencyOutcome; blockedBy: string[] } {
  const blockedStatuses: ReadonlySet<DecisionStatus> = new Set(["REJECTED", "CANCELLED", "EXPIRED"]);
  const blockedBy = decisions.filter((d) => blockedStatuses.has(d.status)).map((d) => d.id);
  if (blockedBy.length > 0) return { outcome: "BLOCKED", blockedBy };

  const allApproved = decisions.every((d) => d.status === "APPROVED" || d.status === "COMPLETED");
  return { outcome: allApproved ? "ALL_APPROVED" : "AWAITING_APPROVALS", blockedBy: [] };
}
