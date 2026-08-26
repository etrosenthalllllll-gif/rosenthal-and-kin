// Stuck workflow + stuck case detection + case SLA monitoring -- doc
// 12 sections 14-16. PLAN.md P11-6.
//
// "Detect workflows that have remained in a state longer than
// expected... Create STUCK_WORKFLOW event. Include: case, workflow,
// current step, duration, expected duration, last successful event,
// last activity, dependencies, recommended action." / "Monitor case
// progression... Create STUCK_CASE alert." / "Support configurable
// SLAs... Track: SLA status, time remaining, time exceeded,
// responsible workflow, responsible operator where applicable."
//
// The underlying elapsed-vs-expected-duration check is the exact same
// shape P10-24's `evaluateWorkflowStaleness()` already implements
// (doc 11's stale-workflow-detection requirement) -- reused here
// rather than reimplemented, with this module only adding the fuller
// event/alert shape doc 12 asks for on top of it.

import { evaluateWorkflowStaleness } from "./workflowReconciliation";

export interface StuckWorkflowEvent {
  caseId: string;
  workflowId: string;
  currentStep: string;
  durationMs: number;
  expectedDurationMs: number;
  lastSuccessfulEvent?: string;
  lastActivity?: string;
  dependencies?: readonly string[];
  recommendedAction?: string;
}

/**
 * Pure: returns a StuckWorkflowEvent only when the workflow is
 * actually stuck (per the shared staleness check); null otherwise, so
 * a caller can filter/build alerts without a separate boolean check.
 */
export function detectStuckWorkflow(params: {
  caseId: string;
  workflowId: string;
  currentStep: string;
  startedAt: string;
  now: string;
  expectedDurationMs: number;
  lastSuccessfulEvent?: string;
  lastActivity?: string;
  dependencies?: readonly string[];
  recommendedAction?: string;
  thresholdMultiplier?: number;
}): StuckWorkflowEvent | null {
  const staleness = evaluateWorkflowStaleness(params.startedAt, params.now, params.expectedDurationMs, params.thresholdMultiplier);
  if (!staleness.isStale) return null;
  return {
    caseId: params.caseId,
    workflowId: params.workflowId,
    currentStep: params.currentStep,
    durationMs: staleness.elapsedMs,
    expectedDurationMs: params.expectedDurationMs,
    lastSuccessfulEvent: params.lastSuccessfulEvent,
    lastActivity: params.lastActivity,
    dependencies: params.dependencies,
    recommendedAction: params.recommendedAction,
  };
}

// --- Stuck case detection (doc 12 §15) --------------------------------------

export interface StuckCaseAlert {
  caseId: string;
  currentState: string;
  durationMs: number;
  expectedTransitionMs: number;
}

export function detectStuckCase(params: {
  caseId: string;
  currentState: string;
  stateEnteredAt: string;
  now: string;
  expectedTransitionMs: number;
  thresholdMultiplier?: number;
}): StuckCaseAlert | null {
  const staleness = evaluateWorkflowStaleness(
    params.stateEnteredAt,
    params.now,
    params.expectedTransitionMs,
    params.thresholdMultiplier
  );
  if (!staleness.isStale) return null;
  return {
    caseId: params.caseId,
    currentState: params.currentState,
    durationMs: staleness.elapsedMs,
    expectedTransitionMs: params.expectedTransitionMs,
  };
}

// --- Case SLA monitoring (doc 12 §16) ---------------------------------------

export type SlaStatus = "WITHIN_SLA" | "SLA_EXCEEDED";

export interface CaseSlaReport {
  status: SlaStatus;
  timeRemainingMs: number | null;
  timeExceededMs: number | null;
  responsibleWorkflow?: string;
  responsibleOperator?: string;
}

/**
 * Pure: doc 12 §16's own SLA examples (lead processing 24h, response
 * classification 5min, etc.) reduced to one function -- an SLA is
 * either still within its window (timeRemainingMs set) or exceeded
 * (timeExceededMs set); never both at once.
 */
export function evaluateCaseSla(
  elapsedMs: number,
  slaTargetMs: number,
  attribution?: { responsibleWorkflow?: string; responsibleOperator?: string }
): CaseSlaReport {
  const withinSla = elapsedMs <= slaTargetMs;
  return {
    status: withinSla ? "WITHIN_SLA" : "SLA_EXCEEDED",
    timeRemainingMs: withinSla ? slaTargetMs - elapsedMs : null,
    timeExceededMs: withinSla ? null : elapsedMs - slaTargetMs,
    responsibleWorkflow: attribution?.responsibleWorkflow,
    responsibleOperator: attribution?.responsibleOperator,
  };
}
