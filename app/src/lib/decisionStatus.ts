// Decision status state machine -- doc 02 section 2.
//
// "Do not allow arbitrary state changes." Same discipline as the
// claimant state machine (src/lib/stateMachine.ts), applied to Decision
// records instead of Claimant records.

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

const TERMINAL: ReadonlySet<DecisionStatus> = new Set([
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
]);

const ALLOWED: Record<DecisionStatus, ReadonlySet<DecisionStatus>> = {
  PENDING: new Set([
    "IN_PROGRESS",
    "APPROVED",
    "REJECTED",
    "REVISED",
    "ESCALATED",
    "DEFERRED",
    "EXPIRED",
    "CANCELLED",
  ]),
  IN_PROGRESS: new Set([
    "APPROVED",
    "REJECTED",
    "REVISED",
    "ESCALATED",
    "DEFERRED",
    "EXPIRED",
    "CANCELLED",
  ]),
  // A deferred decision comes back into the active queue later; it does
  // not jump straight to a final outcome without being reconsidered.
  DEFERRED: new Set(["PENDING", "IN_PROGRESS", "EXPIRED", "CANCELLED"]),
  // An escalated decision is handed to another operator/reviewer, who
  // either sends it back into the active queue or cancels it -- it
  // cannot resolve itself straight to APPROVED/REJECTED, because the
  // whole point of escalation is that someone else needs to look at it.
  ESCALATED: new Set(["PENDING", "IN_PROGRESS", "CANCELLED"]),
  // A revised decision (operator edited an AI draft) goes back to
  // PENDING for the operator to act on the edited version -- it does not
  // silently self-approve.
  REVISED: new Set(["PENDING", "CANCELLED"]),
  APPROVED: new Set(["COMPLETED"]),
  REJECTED: new Set(["COMPLETED"]),
  COMPLETED: new Set([]),
  EXPIRED: new Set([]),
  CANCELLED: new Set([]),
};

export function isTerminalDecisionStatus(status: DecisionStatus): boolean {
  return TERMINAL.has(status);
}

export function canTransitionDecision(
  from: DecisionStatus,
  to: DecisionStatus
): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.has(to) ?? false;
}

export class InvalidDecisionTransitionError extends Error {
  constructor(public from: DecisionStatus, public to: DecisionStatus) {
    super(`Invalid decision transition: ${from} -> ${to}`);
    this.name = "InvalidDecisionTransitionError";
  }
}

export function assertValidDecisionTransition(
  from: DecisionStatus,
  to: DecisionStatus
): void {
  if (!canTransitionDecision(from, to)) {
    throw new InvalidDecisionTransitionError(from, to);
  }
}
