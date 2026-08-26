// Dry-run/test mode + manual execution controls -- doc 11 sections
// 70-75. PLAN.md P10-17.
//
// "Build a dry-run mode. A workflow should be able to simulate 'what
// would the system do?' without actually sending messages, filing
// claims, moving money, or creating irreversible external actions." /
// Test mode: external providers sandboxed. / "Authorized operators
// should be able to manually run a workflow for a case... before
// execution: show workflow, version, inputs, expected actions; require
// confirmation." / "Authorized operators may skip a workflow step
// where permitted... never allow skipping mandatory safety/compliance
// gates without explicit elevated permission." / Restart options:
// RESTART_FROM_BEGINNING, RETRY_FAILED_STEP,
// RESUME_FROM_LAST_SUCCESSFUL_STEP. / "Before cancellation: show
// current step, pending actions, external actions already completed,
// potential consequences."

export type ExecutionMode = "LIVE" | "DRY_RUN" | "TEST";

export interface DryRunReport {
  wouldTrigger: boolean;
  wouldApprove: boolean;
  wouldSend: boolean;
  wouldRequireHuman: boolean;
}

/**
 * Pure: doc 11 §70's own worked example format
 * ("Would trigger: YES / Would approve: YES / Would send: YES / Would
 * require human: NO"). Takes the same rule/confidence outputs the real
 * pipeline would use and reports what it would decide -- this never
 * performs the actual send/file/payment side effect; the caller is
 * responsible for routing ExecutionMode "DRY_RUN"/"TEST" away from any
 * real action entirely.
 */
export function buildDryRunReport(input: {
  triggerFired: boolean;
  ruleAndConfidenceDecision: "AUTOMATED_ACTION_ALLOWED" | "HUMAN_REVIEW_REQUIRED" | "BLOCKED_RULE_FAILED";
}): DryRunReport {
  const wouldApprove = input.ruleAndConfidenceDecision !== "BLOCKED_RULE_FAILED";
  return {
    wouldTrigger: input.triggerFired,
    wouldApprove,
    wouldSend: input.triggerFired && input.ruleAndConfidenceDecision === "AUTOMATED_ACTION_ALLOWED",
    wouldRequireHuman: input.triggerFired && input.ruleAndConfidenceDecision === "HUMAN_REVIEW_REQUIRED",
  };
}

/**
 * doc 11 §71 -- a mode's action-execution behavior. LIVE performs the
 * real side effect; both DRY_RUN and TEST must not (test mode's
 * "sandboxed" providers vs. dry-run's "don't even call the provider"
 * are a caller-level distinction, but neither is ever LIVE).
 */
export function canPerformRealAction(mode: ExecutionMode): boolean {
  return mode === "LIVE";
}

// --- Manual execution (doc 11 §72) ------------------------------------------

export interface ManualExecutionPreview {
  workflowId: string;
  workflowVersion: number;
  inputs: Record<string, unknown>;
  expectedActions: readonly string[];
  requiresConfirmation: true;
}

export function buildManualExecutionPreview(params: {
  workflowId: string;
  workflowVersion: number;
  inputs: Record<string, unknown>;
  expectedActions: readonly string[];
}): ManualExecutionPreview {
  return { ...params, requiresConfirmation: true };
}

// --- Skip step (doc 11 §73) -------------------------------------------------

export type SkipStepOutcome =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Pure: doc 11 §73 -- a mandatory safety/compliance gate step can
 * never be skipped without elevated permission, regardless of the
 * reason given; a non-mandatory step can be skipped once a reason is
 * supplied.
 */
export function evaluateSkipStep(params: {
  isMandatoryComplianceGate: boolean;
  hasElevatedPermission: boolean;
  reason: string;
}): SkipStepOutcome {
  if (!params.reason.trim()) {
    return { allowed: false, reason: "A reason is required to skip a workflow step." };
  }
  if (params.isMandatoryComplianceGate && !params.hasElevatedPermission) {
    return { allowed: false, reason: "Mandatory compliance gates require elevated permission to skip." };
  }
  return { allowed: true };
}

// --- Restart workflow (doc 11 §74) ------------------------------------------

export type WorkflowRestartOption = "RESTART_FROM_BEGINNING" | "RETRY_FAILED_STEP" | "RESUME_FROM_LAST_SUCCESSFUL_STEP";

/**
 * Pure: resolves which step index execution should resume from for
 * each restart option -- the caller shows this to the operator before
 * they choose, per doc 11 §74's "the operator should see the
 * consequences before choosing."
 */
export function resolveRestartStepIndex(
  option: WorkflowRestartOption,
  params: { failedStepIndex: number; lastSuccessfulStepIndex: number }
): number {
  switch (option) {
    case "RESTART_FROM_BEGINNING":
      return 0;
    case "RETRY_FAILED_STEP":
      return params.failedStepIndex;
    case "RESUME_FROM_LAST_SUCCESSFUL_STEP":
      return params.lastSuccessfulStepIndex + 1;
  }
}

// --- Workflow cancellation (doc 11 §75) -------------------------------------

export interface CancellationConsequences {
  currentStep: string;
  pendingActions: readonly string[];
  externalActionsCompleted: readonly string[];
}

export function buildCancellationConsequences(params: CancellationConsequences): CancellationConsequences {
  return { ...params };
}
