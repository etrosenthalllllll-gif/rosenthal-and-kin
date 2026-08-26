// PostFilingCase state machine -- doc 09 sections 1-2. PLAN.md P8-1.
//
// "Create a PostFilingCase entity with its own status list (FILED
// through ESCALATED/ON_HOLD). Build an explicit state machine: FILED
// -> RECEIVED -> PROCESSING -> UNDER_REVIEW -> (ADDITIONAL_INFORMATION_REQUIRED
// or HEARING_SCHEDULED or DECISION_PENDING or APPROVED or DENIED).
// Every state transition must create an event."
//
// Mirrors stateMachine.ts's/claimPreparationStateMachine.ts's/
// filingStateMachine.ts's validated-transition discipline exactly
// (P0-3/P6-16/P7-13). The "every transition creates an event" half of
// doc 09 section 2 is a calling-convention requirement on whatever
// wires this into real data (write a PostFilingEvent row alongside
// every successful transition, same pattern as
// ClaimantStateTransition/AuditEvent) -- not something a pure
// transition-validity function can enforce on its own.

// doc 09 section 1's own status list, verbatim.
export type PostFilingCaseStatus =
  | "FILED"
  | "RECEIVED"
  | "PROCESSING"
  | "UNDER_REVIEW"
  | "ADDITIONAL_INFORMATION_REQUIRED"
  | "HEARING_SCHEDULED"
  | "COURT_EVENT_PENDING"
  | "DECISION_PENDING"
  | "APPROVED"
  | "DENIED"
  | "SETTLEMENT_PENDING"
  | "PAYMENT_PENDING"
  | "COMPLETED"
  | "CLOSED"
  | "ESCALATED"
  | "ON_HOLD";

const TERMINAL_STATES: ReadonlySet<PostFilingCaseStatus> = new Set(["CLOSED"]);

// Reachable from any non-terminal state -- ESCALATED/ON_HOLD are the
// doc's own two "something needs attention, pause the normal flow"
// states. Neither has a fixed forward path defined here beyond CLOSED
// -- an operator resolves an escalation/hold by moving the case to
// whatever status is appropriate, the same "app layer decides at
// runtime" shape as stateMachine.ts's ESCALATED.
const UNIVERSAL_EXITS: ReadonlySet<PostFilingCaseStatus> = new Set(["ESCALATED", "ON_HOLD"]);

const FORWARD_PATH: readonly PostFilingCaseStatus[] = [
  "FILED",
  "RECEIVED",
  "PROCESSING",
  "UNDER_REVIEW",
  "DECISION_PENDING",
  "APPROVED",
  "SETTLEMENT_PENDING",
  "PAYMENT_PENDING",
  "COMPLETED",
  "CLOSED",
];

function buildAllowedTransitions(): Map<PostFilingCaseStatus, Set<PostFilingCaseStatus>> {
  const map = new Map<PostFilingCaseStatus, Set<PostFilingCaseStatus>>();

  for (const state of FORWARD_PATH) {
    map.set(state, new Set(UNIVERSAL_EXITS));
  }
  for (let i = 0; i < FORWARD_PATH.length - 1; i++) {
    map.get(FORWARD_PATH[i])!.add(FORWARD_PATH[i + 1]);
  }

  // doc 09 section 2's own branches out of UNDER_REVIEW.
  map.get("UNDER_REVIEW")!.add("ADDITIONAL_INFORMATION_REQUIRED");
  map.get("UNDER_REVIEW")!.add("HEARING_SCHEDULED");
  map.get("UNDER_REVIEW")!.add("COURT_EVENT_PENDING");
  map.get("UNDER_REVIEW")!.add("DENIED");

  // ADDITIONAL_INFORMATION_REQUIRED's own sub-flow (document
  // request/receive/validate/response-submitted) collapses back to
  // PROCESSING at the PostFilingCase-status level -- those finer
  // stages live on DocumentRequest (P8-9), not this status field.
  map.set("ADDITIONAL_INFORMATION_REQUIRED", new Set([...UNIVERSAL_EXITS, "PROCESSING"]));

  // HEARING_SCHEDULED's/COURT_EVENT_PENDING's own sub-flows
  // (preparation/completed) similarly live on Hearing/Event records
  // (P8-6), collapsing back to DECISION_PENDING here.
  map.set("HEARING_SCHEDULED", new Set([...UNIVERSAL_EXITS, "DECISION_PENDING"]));
  map.set("COURT_EVENT_PENDING", new Set([...UNIVERSAL_EXITS, "DECISION_PENDING"]));

  map.get("DECISION_PENDING")!.add("DENIED");
  map.set("DENIED", new Set([...UNIVERSAL_EXITS, "CLOSED"]));

  // Approved doesn't always need a settlement step.
  map.get("APPROVED")!.add("PAYMENT_PENDING");
  map.get("APPROVED")!.add("COMPLETED");

  for (const exit of UNIVERSAL_EXITS) {
    if (!map.has(exit)) map.set(exit, new Set());
    map.get(exit)!.add("CLOSED");
  }

  return map;
}

const ALLOWED_TRANSITIONS = buildAllowedTransitions();

export function isTerminalPostFilingStatus(status: PostFilingCaseStatus): boolean {
  return TERMINAL_STATES.has(status);
}

export function canTransitionPostFilingCase(from: PostFilingCaseStatus, to: PostFilingCaseStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}

export class InvalidPostFilingTransitionError extends Error {
  constructor(public from: PostFilingCaseStatus, public to: PostFilingCaseStatus) {
    super(`Invalid post-filing case transition: ${from} -> ${to}`);
    this.name = "InvalidPostFilingTransitionError";
  }
}

export function assertValidPostFilingTransition(from: PostFilingCaseStatus, to: PostFilingCaseStatus): void {
  if (!canTransitionPostFilingCase(from, to)) {
    throw new InvalidPostFilingTransitionError(from, to);
  }
}
