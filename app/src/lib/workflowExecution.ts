// WorkflowExecution model + step types -- doc 11 sections 5-6. PLAN.md P10-2.
//
// Statuses: QUEUED, RUNNING, WAITING, WAITING_FOR_APPROVAL, RETRYING,
// FAILED, COMPLETED, CANCELLED, PAUSED, TIMED_OUT. "The engine should
// be extensible so additional step types can be added later."
//
// Mirrors schema.prisma's WorkflowExecutionStatus enum (P10-2) as a
// plain TS union, same no-Prisma-dependency discipline as
// filingStateMachine.ts. An execution is pinned to the workflowVersion
// it started with (P10-1) -- nothing here ever re-resolves that.

import type { WorkflowStepType } from "./workflowDefinition";
export type { WorkflowStepType };

export type WorkflowExecutionStatus =
  | "QUEUED"
  | "RUNNING"
  | "WAITING"
  | "WAITING_FOR_APPROVAL"
  | "RETRYING"
  | "FAILED"
  | "COMPLETED"
  | "CANCELLED"
  | "PAUSED"
  | "TIMED_OUT";

const TERMINAL_EXECUTION_STATES: ReadonlySet<WorkflowExecutionStatus> = new Set(["COMPLETED", "CANCELLED"]);

// FAILED and TIMED_OUT are deliberately NOT terminal here -- doc 11's
// retry engine (P10-8) can move either back to RETRYING/RUNNING. Only
// COMPLETED and CANCELLED are true dead ends; everything else can
// still move.
const ALLOWED_TRANSITIONS: Record<WorkflowExecutionStatus, ReadonlySet<WorkflowExecutionStatus>> = {
  QUEUED: new Set(["RUNNING", "CANCELLED"]),
  RUNNING: new Set(["WAITING", "WAITING_FOR_APPROVAL", "PAUSED", "FAILED", "COMPLETED", "CANCELLED", "TIMED_OUT"]),
  WAITING: new Set(["RUNNING", "PAUSED", "FAILED", "CANCELLED", "TIMED_OUT"]),
  WAITING_FOR_APPROVAL: new Set(["RUNNING", "FAILED", "CANCELLED", "TIMED_OUT"]),
  RETRYING: new Set(["RUNNING", "FAILED", "CANCELLED"]),
  FAILED: new Set(["RETRYING", "CANCELLED"]),
  TIMED_OUT: new Set(["RETRYING", "FAILED", "CANCELLED"]),
  PAUSED: new Set(["RUNNING", "CANCELLED"]),
  COMPLETED: new Set([]),
  CANCELLED: new Set([]),
};

export function isTerminalExecutionStatus(status: WorkflowExecutionStatus): boolean {
  return TERMINAL_EXECUTION_STATES.has(status);
}

export function canTransitionExecutionStatus(
  from: WorkflowExecutionStatus,
  to: WorkflowExecutionStatus
): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].has(to);
}

export class InvalidExecutionTransitionError extends Error {
  constructor(public from: WorkflowExecutionStatus, public to: WorkflowExecutionStatus) {
    super(`Invalid workflow execution transition: ${from} -> ${to}`);
    this.name = "InvalidExecutionTransitionError";
  }
}

export function assertValidExecutionTransition(
  from: WorkflowExecutionStatus,
  to: WorkflowExecutionStatus
): void {
  if (!canTransitionExecutionStatus(from, to)) {
    throw new InvalidExecutionTransitionError(from, to);
  }
}

export interface WorkflowExecutionRecord {
  workflowId: string;
  workflowVersion: number;
  caseId?: string;
  entityId?: string;
  correlationId: string;
  parentExecutionId?: string;
}

/**
 * Pure: builds the fields for a brand-new WorkflowExecution row.
 * Always starts QUEUED, always pinned to the version passed in (the
 * caller resolves that via workflowDefinition.ts's
 * resolveExecutionVersion() before calling this).
 */
export function planNewWorkflowExecution(params: WorkflowExecutionRecord): {
  workflowId: string;
  workflowVersion: number;
  caseId?: string;
  entityId?: string;
  correlationId: string;
  parentExecutionId?: string;
  status: WorkflowExecutionStatus;
  retryCount: number;
} {
  return {
    ...params,
    status: "QUEUED",
    retryCount: 0,
  };
}

// doc 11 §6's own step-type vocabulary, defined once and re-exported
// from workflowDefinition.ts so both modules agree on the same set.
export const WORKFLOW_STEP_TYPES: readonly WorkflowStepType[] = [
  "TRIGGER",
  "CONDITION",
  "AI_ANALYSIS",
  "DATA_LOOKUP",
  "API_CALL",
  "DOCUMENT_GENERATION",
  "EMAIL",
  "SMS",
  "PHONE_CALL",
  "DATABASE_UPDATE",
  "WAIT",
  "SCHEDULE",
  "HUMAN_APPROVAL",
  "ESCALATION",
  "RETRY",
  "END",
];

export function isKnownWorkflowStepType(type: string): type is WorkflowStepType {
  return (WORKFLOW_STEP_TYPES as readonly string[]).includes(type);
}
