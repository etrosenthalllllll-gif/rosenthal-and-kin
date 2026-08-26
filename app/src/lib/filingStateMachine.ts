// Filing state machine -- doc 08 section 6. PLAN.md P7-13.
//
// "Implement an explicit filing state machine: PACKAGE_APPROVED ->
// FILING_READINESS_CHECK -> FILING_METHOD_SELECTED ->
// FILING_CONNECTOR_SELECTED -> FILING_DATA_VALIDATED -> FEE_CALCULATED
// -> PAYMENT_REQUIRED? (yes -> PAYMENT, no -> continue) ->
// SUBMISSION_AUTHORIZATION -> SUBMISSION -> PROVIDER_RESPONSE ->
// RECEIVED -> PROCESSING -> ACCEPTED/PENDING/REJECTED. If rejected:
// REJECTION_ANALYSIS -> CORRECTION_REQUIRED? (yes -> correction
// workflow, no -> human review) -> new package version if necessary ->
// new approval -> RESUBMISSION."
//
// This governs the schema's `FilingStatus` enum (P7-1) -- mirrors
// stateMachine.ts's/claimPreparationStateMachine.ts's
// validated-transition discipline (P0-3/P6-16) exactly: an explicit
// forward path, universal exits reachable from any non-terminal state,
// and a thrown typed error on any transition not in the allowed table.

// Mirrors schema.prisma's FilingStatus enum (P7-1) exactly -- kept as
// a plain TS union here (rather than importing the generated Prisma
// enum) so this module has no Prisma/DB dependency, same as every
// other pure state-machine module in this codebase.
export type FilingStatus =
  | "NOT_READY"
  | "READY_FOR_FILING"
  | "AWAITING_APPROVAL"
  | "APPROVED_TO_FILE"
  | "PREPARING_SUBMISSION"
  | "AWAITING_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "PAYMENT_COMPLETE"
  | "SUBMITTING"
  | "SUBMITTED"
  | "RECEIVED"
  | "PROCESSING"
  | "ACCEPTED"
  | "PENDING"
  | "REJECTED"
  | "CORRECTION_REQUIRED"
  | "RESUBMISSION_REQUIRED"
  | "RESUBMITTED"
  | "FAILED"
  | "CANCELLED"
  | "CLOSED";

const TERMINAL_STATES: ReadonlySet<FilingStatus> = new Set(["FAILED", "CANCELLED", "CLOSED"]);

// Reachable from any non-terminal state -- doc 08 doesn't give filing
// an explicit REJECTED-is-terminal statement the way claim preparation
// has SUPERSEDED; instead REJECTED is a real forward branch (rejection
// -> correction -> resubmission), so it stays on the forward path
// below rather than being a universal exit. CANCELLED and FAILED are
// the two states doc 08 treats as unconditional stop points.
const UNIVERSAL_EXITS: ReadonlySet<FilingStatus> = new Set(["CANCELLED", "FAILED"]);

const FORWARD_PATH: readonly FilingStatus[] = [
  "NOT_READY",
  "READY_FOR_FILING",
  "AWAITING_APPROVAL",
  "APPROVED_TO_FILE",
  "PREPARING_SUBMISSION",
  "AWAITING_PAYMENT",
  "PAYMENT_PROCESSING",
  "PAYMENT_COMPLETE",
  "SUBMITTING",
  "SUBMITTED",
  "RECEIVED",
  "PROCESSING",
  "ACCEPTED",
  "CLOSED",
];

function buildAllowedTransitions(): Map<FilingStatus, Set<FilingStatus>> {
  const map = new Map<FilingStatus, Set<FilingStatus>>();

  for (const state of FORWARD_PATH) {
    map.set(state, new Set(UNIVERSAL_EXITS));
  }

  for (let i = 0; i < FORWARD_PATH.length - 1; i++) {
    map.get(FORWARD_PATH[i])!.add(FORWARD_PATH[i + 1]);
  }

  // doc 08 section 6: PREPARING_SUBMISSION can skip straight past the
  // payment branch when no payment is required ("PAYMENT_REQUIRED? NO
  // -> CONTINUE"), landing directly on SUBMITTING.
  map.get("PREPARING_SUBMISSION")!.add("SUBMITTING");

  // PROCESSING can resolve to PENDING or REJECTED as well as ACCEPTED
  // -- doc 08's own three-way branch.
  map.get("PROCESSING")!.add("PENDING");
  map.get("PROCESSING")!.add("REJECTED");
  map.set("PENDING", new Set([...UNIVERSAL_EXITS, "ACCEPTED", "REJECTED", "PROCESSING"]));

  // Rejection branch: REJECTED -> (CORRECTION_REQUIRED? yes/no) ->
  // CORRECTION_REQUIRED or straight to RESUBMISSION_REQUIRED (doc 08's
  // "no -> HUMAN REVIEW" is represented as staying in
  // RESUBMISSION_REQUIRED pending an operator decision, not a distinct
  // status this enum has). RESUBMITTED is a genuinely new attempt
  // (P7-1's FilingAttempt), not a revisit of SUBMITTED.
  map.set("REJECTED", new Set([...UNIVERSAL_EXITS, "CORRECTION_REQUIRED", "RESUBMISSION_REQUIRED"]));
  map.set("CORRECTION_REQUIRED", new Set([...UNIVERSAL_EXITS, "RESUBMISSION_REQUIRED"]));
  map.set("RESUBMISSION_REQUIRED", new Set([...UNIVERSAL_EXITS, "RESUBMITTED"]));
  map.set("RESUBMITTED", new Set([...UNIVERSAL_EXITS, "RECEIVED", "PROCESSING"]));

  map.get("ACCEPTED")!.add("CLOSED");

  for (const exit of UNIVERSAL_EXITS) {
    if (!map.has(exit)) map.set(exit, new Set());
  }

  return map;
}

const ALLOWED_TRANSITIONS = buildAllowedTransitions();

export function isTerminalFilingStatus(status: FilingStatus): boolean {
  return TERMINAL_STATES.has(status);
}

export function canTransitionFiling(from: FilingStatus, to: FilingStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}

export class InvalidFilingTransitionError extends Error {
  constructor(public from: FilingStatus, public to: FilingStatus) {
    super(`Invalid filing transition: ${from} -> ${to}`);
    this.name = "InvalidFilingTransitionError";
  }
}

export function assertValidFilingTransition(from: FilingStatus, to: FilingStatus): void {
  if (!canTransitionFiling(from, to)) {
    throw new InvalidFilingTransitionError(from, to);
  }
}
