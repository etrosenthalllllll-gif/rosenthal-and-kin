// Claim preparation state machine -- doc 07 sections 49-53. PLAN.md P6-16.
//
// "No arbitrary status changes for a claim preparation. A jurisdiction,
// rule, or form-version change invalidates the affected package pieces
// and requires a new preparation version -- never silently patch the
// existing one in place."
//
// Mirrors stateMachine.ts's (P0-3) validated-transition discipline
// exactly, over ClaimPreparationStatus (schema.prisma, P6-1) instead of
// ClaimantStatus: an explicit forward path, universal exits reachable
// from any non-terminal state, and a thrown error rather than a silent
// no-op on an invalid transition.

export type ClaimPreparationStatus =
  | "NOT_STARTED"
  | "INITIALIZING"
  | "JURISDICTION_REVIEW"
  | "REQUIREMENTS_DETERMINED"
  | "FORMS_SELECTED"
  | "FORM_POPULATION"
  | "DOCUMENT_GENERATION"
  | "EXHIBIT_ASSEMBLY"
  | "SIGNATURE_PENDING"
  | "COMPLETENESS_REVIEW"
  | "REQUIRES_OPERATOR_REVIEW"
  | "READY_FOR_APPROVAL"
  | "APPROVED_FOR_FILING"
  | "FILED"
  | "REJECTED"
  | "SUPERSEDED"
  | "CANCELLED";

const TERMINAL_STATES: ReadonlySet<ClaimPreparationStatus> = new Set([
  "FILED",
  "REJECTED",
  "SUPERSEDED",
  "CANCELLED",
]);

// Reachable from any non-terminal state. SUPERSEDED specifically models
// doc 07's "a jurisdiction/rule/form-version change invalidates this
// preparation" -- the correct response is a brand-new
// ClaimPreparation row/version, not resuming this one, so SUPERSEDED is
// terminal for THIS preparation just like REJECTED/CANCELLED.
const UNIVERSAL_EXITS: ReadonlySet<ClaimPreparationStatus> = new Set(["REJECTED", "CANCELLED", "SUPERSEDED"]);

const FORWARD_PATH: readonly ClaimPreparationStatus[] = [
  "NOT_STARTED",
  "INITIALIZING",
  "JURISDICTION_REVIEW",
  "REQUIREMENTS_DETERMINED",
  "FORMS_SELECTED",
  "FORM_POPULATION",
  "DOCUMENT_GENERATION",
  "EXHIBIT_ASSEMBLY",
  "SIGNATURE_PENDING",
  "COMPLETENESS_REVIEW",
  "READY_FOR_APPROVAL",
  "APPROVED_FOR_FILING",
  "FILED",
];

function buildAllowedTransitions(): Map<ClaimPreparationStatus, Set<ClaimPreparationStatus>> {
  const map = new Map<ClaimPreparationStatus, Set<ClaimPreparationStatus>>();

  for (const state of FORWARD_PATH) {
    map.set(state, new Set(UNIVERSAL_EXITS));
  }

  for (let i = 0; i < FORWARD_PATH.length - 1; i++) {
    map.get(FORWARD_PATH[i])!.add(FORWARD_PATH[i + 1]);
  }

  // doc 07 section 34/37: the completeness engine can land on
  // REQUIRES_REVIEW instead of clean COMPLETE -- COMPLETENESS_REVIEW is
  // the only place this state is entered from, and once an operator
  // resolves it, the natural next step is READY_FOR_APPROVAL. Like
  // ESCALATED in stateMachine.ts, no other forward transitions are
  // defined here besides that resolution and the universal exits --
  // anything else is an app-layer decision.
  map.get("COMPLETENESS_REVIEW")!.add("REQUIRES_OPERATOR_REVIEW");
  map.set("REQUIRES_OPERATOR_REVIEW", new Set([...UNIVERSAL_EXITS, "READY_FOR_APPROVAL"]));

  return map;
}

const ALLOWED_TRANSITIONS = buildAllowedTransitions();

export function isTerminalPreparationStatus(status: ClaimPreparationStatus): boolean {
  return TERMINAL_STATES.has(status);
}

export function canTransitionPreparation(from: ClaimPreparationStatus, to: ClaimPreparationStatus): boolean {
  if (from === to) return false;
  const allowed = ALLOWED_TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}

export class InvalidClaimPreparationTransitionError extends Error {
  constructor(public from: ClaimPreparationStatus, public to: ClaimPreparationStatus) {
    super(`Invalid claim preparation transition: ${from} -> ${to}`);
    this.name = "InvalidClaimPreparationTransitionError";
  }
}

export function assertValidPreparationTransition(from: ClaimPreparationStatus, to: ClaimPreparationStatus): void {
  if (!canTransitionPreparation(from, to)) {
    throw new InvalidClaimPreparationTransitionError(from, to);
  }
}
