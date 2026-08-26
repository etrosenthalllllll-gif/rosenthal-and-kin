// Claimant lifecycle state machine — doc 00 "THE STATE MACHINE" / doc 01 Phase 4.
//
// Hard rules (do not relax these when extending):
//   - No arbitrary transitions. Every transition must be in ALLOWED_TRANSITIONS.
//   - REJECTED, WITHDRAWN, ESCALATED are reachable from any non-terminal state.
//   - Callers are responsible for recording a ClaimantStateTransition row and
//     an AuditEvent for every successful transition (see src/lib/claimants.ts).

export type ClaimantStatus =
  | "LEAD"
  | "CONTACTED"
  | "RESPONDED"
  | "POTENTIAL_HEIR"
  | "VERIFIED"
  | "ENGAGED"
  | "DOCUMENTS_REQUESTED"
  | "DOCUMENTS_COMPLETE"
  | "CLAIM_READY"
  | "AWAITING_OPERATOR_APPROVAL"
  | "APPROVED"
  | "FILED"
  | "PENDING"
  | "RECOVERY"
  | "PAID"
  | "CLOSED"
  | "REJECTED"
  | "WITHDRAWN"
  | "ESCALATED";

const TERMINAL_STATES: ReadonlySet<ClaimantStatus> = new Set([
  "PAID",
  "CLOSED",
  "REJECTED",
  "WITHDRAWN",
]);

// Escape hatches reachable from any non-terminal state (doc 00: "REJECTED,
// WITHDRAWN, and ESCALATED reachable from any state").
const UNIVERSAL_EXITS: ReadonlySet<ClaimantStatus> = new Set([
  "REJECTED",
  "WITHDRAWN",
  "ESCALATED",
]);

// The forward "happy path" from doc 00. ESCALATED can also transition back
// into the state it was escalated from once resolved (handled by the
// `canTransition` special case below, not encoded per-state to avoid
// duplicating every state as a valid ESCALATED->X target).
const FORWARD_PATH: ReadonlyArray<ClaimantStatus> = [
  "LEAD",
  "CONTACTED",
  "RESPONDED",
  "POTENTIAL_HEIR",
  "VERIFIED",
  "ENGAGED",
  "DOCUMENTS_REQUESTED",
  "DOCUMENTS_COMPLETE",
  "CLAIM_READY",
  "AWAITING_OPERATOR_APPROVAL",
  "APPROVED",
  "FILED",
  "PENDING",
  "RECOVERY",
  "PAID",
];

function buildAllowedTransitions(): Map<ClaimantStatus, Set<ClaimantStatus>> {
  const map = new Map<ClaimantStatus, Set<ClaimantStatus>>();

  for (const state of FORWARD_PATH) {
    map.set(state, new Set(UNIVERSAL_EXITS));
  }

  for (let i = 0; i < FORWARD_PATH.length - 1; i++) {
    map.get(FORWARD_PATH[i])!.add(FORWARD_PATH[i + 1]);
  }

  // CLOSED is reachable from PAID (normal close) and from any terminal-ish
  // rejection/withdrawal state (administrative closure), per doc 00's
  // "CLOSED (all claimants terminal)" framing at the estate level.
  map.get("PAID")!.add("CLOSED");
  for (const exit of UNIVERSAL_EXITS) {
    if (!map.has(exit)) map.set(exit, new Set());
    map.get(exit)!.add("CLOSED");
  }

  // ESCALATED has no outgoing transitions defined here except CLOSED — an
  // escalation is resolved by an operator moving the claimant to whatever
  // state is appropriate, which the app layer decides at runtime; the state
  // machine only guarantees ESCALATED can't be *entered* from CLOSED/PAID
  // and can always exit to CLOSED once resolved administratively.
  if (!map.has("ESCALATED")) map.set("ESCALATED", new Set());
  map.get("ESCALATED")!.add("CLOSED");

  return map;
}

const ALLOWED_TRANSITIONS = buildAllowedTransitions();

export function isTerminal(status: ClaimantStatus): boolean {
  return TERMINAL_STATES.has(status);
}

export function canTransition(from: ClaimantStatus, to: ClaimantStatus): boolean {
  if (from === to) return false; // no-op transitions are never valid — a
  // caller that wants to "record activity without changing state" should
  // write an AuditEvent directly, not fake a transition.
  const allowed = ALLOWED_TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}

export class InvalidClaimantTransitionError extends Error {
  constructor(public from: ClaimantStatus, public to: ClaimantStatus) {
    super(`Invalid claimant transition: ${from} -> ${to}`);
    this.name = "InvalidClaimantTransitionError";
  }
}

/**
 * Throws InvalidClaimantTransitionError if the transition isn't allowed.
 * Callers must catch this rather than let a bad transition through —
 * per doc 01 Phase 4: "Do not allow arbitrary status changes."
 */
export function assertValidTransition(from: ClaimantStatus, to: ClaimantStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidClaimantTransitionError(from, to);
  }
}
