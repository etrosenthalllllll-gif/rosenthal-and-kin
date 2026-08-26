// Event ordering + state-transition + workflow concurrency protection
// -- doc 11 sections 50-53. PLAN.md P10-12.
//
// "Events may arrive out of order. Example: FILING.ACCEPTED arrives
// before FILING.SUBMITTED. The system must detect impossible state
// transitions. Create EVENT_ORDER_EXCEPTION rather than corrupting
// state." / "Every automated state transition must validate: current
// state -> allowed next state." / "Prevent conflicting workflows from
// modifying the same case simultaneously... The system should detect
// conflict and block the invalid operation." / Race protection:
// concurrent approvals, duplicate sends, duplicate jobs, duplicate
// payments, duplicate filings.

// --- Event ordering (doc 11 §50) --------------------------------------------

/**
 * Pure: given a named stage sequence (e.g. a filing's
 * SUBMITTED -> RECEIVED -> PROCESSING -> ACCEPTED chain) and the set
 * of stages already observed for this entity, decides whether a newly
 * arrived stage is admissible. A stage is only admissible once every
 * stage before it in the sequence has already been seen -- an unknown
 * stage (not in the sequence at all) is never blocked by this check,
 * since ordering only applies to stages this module knows about.
 */
export function detectEventOrderException(
  sequence: readonly string[],
  seenStages: ReadonlySet<string>,
  newStage: string
): boolean {
  const index = sequence.indexOf(newStage);
  if (index <= 0) return false;
  const requiredPriorStages = sequence.slice(0, index);
  return requiredPriorStages.some((stage) => !seenStages.has(stage));
}

// --- State-transition protection (doc 11 §51) -------------------------------

export type StateTransitionCheck = (from: string, to: string) => boolean;

export type StateTransitionOutcome = "ALLOWED" | "BLOCKED_INVALID_TRANSITION";

/**
 * Every automated transition in this codebase already has its own
 * dedicated state machine (filingStateMachine.ts,
 * claimPreparationStateMachine.ts, postFilingStateMachine.ts, etc.).
 * This is deliberately a thin, generic wrapper -- it does not
 * reimplement any of those tables, it just gives the workflow engine
 * one uniform way to call whichever domain-specific `canTransition*`
 * function applies, and to treat "not allowed" as a block rather than
 * as a transition that happens anyway.
 */
export function validateAutomatedTransition(
  from: string,
  to: string,
  isAllowed: StateTransitionCheck
): StateTransitionOutcome {
  return isAllowed(from, to) ? "ALLOWED" : "BLOCKED_INVALID_TRANSITION";
}

// --- Workflow concurrency / race protection (doc 11 §52-53) -----------------

// Config table, not a hardcoded if/else -- which workflow types are
// mutually exclusive on the same case. Symmetric: declaring A conflicts
// with B also means B conflicts with A.
export type WorkflowConflictTable = Readonly<Record<string, readonly string[]>>;

export const DEFAULT_WORKFLOW_CONFLICTS: WorkflowConflictTable = {
  CLAIM_PREPARATION: ["CASE_CLOSURE"],
  CASE_CLOSURE: ["CLAIM_PREPARATION", "CLAIM_FILING", "DISTRIBUTION_APPROVAL"],
  CLAIM_FILING: ["CASE_CLOSURE"],
  DISTRIBUTION_APPROVAL: ["CASE_CLOSURE"],
};

export interface WorkflowConflict {
  activeWorkflowType: string;
}

/**
 * Pure: doc 11 §52's own worked example (preparing a claim vs. closing
 * the case) generalized to a config table. Returns every currently
 * active workflow type on this case that conflicts with the one about
 * to start -- an empty array means it's safe to start.
 */
export function detectWorkflowConflicts(
  activeWorkflowTypesOnCase: readonly string[],
  candidateWorkflowType: string,
  conflicts: WorkflowConflictTable = DEFAULT_WORKFLOW_CONFLICTS
): WorkflowConflict[] {
  const conflictingTypes = new Set(conflicts[candidateWorkflowType] ?? []);
  return activeWorkflowTypesOnCase
    .filter((active) => conflictingTypes.has(active))
    .map((active) => ({ activeWorkflowType: active }));
}

/**
 * Pure: doc 11 §53's race-condition list generalized -- a proposed
 * action is race-unsafe when another actor already claimed the exact
 * same lock key (approval id, send action id, payment idempotency
 * key, filing submission id, etc.). Optimistic concurrency: the caller
 * supplies the set of keys already locked/claimed this instant.
 */
export function isRaceProtected(lockKey: string, alreadyClaimedKeys: ReadonlySet<string>): boolean {
  return !alreadyClaimedKeys.has(lockKey);
}
