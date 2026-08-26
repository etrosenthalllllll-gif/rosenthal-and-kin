// Workflow definition + versioning -- doc 11 sections 2-4. PLAN.md P10-1.
//
// "Workflows must be versioned... Existing executions must continue
// using the version they started with unless explicitly migrated.
// Never silently change an active workflow underneath an existing
// execution." / Statuses: DRAFT, ACTIVE, PAUSED, DISABLED, ARCHIVED.
//
// Mirrors schema.prisma's WorkflowStatus enum (P10-1) as a plain TS
// union, same no-Prisma-dependency discipline as filingStateMachine.ts/
// claimPreparationStateMachine.ts. Versioning follows the same
// append-only, never-overwrite discipline as RecoveryEstimateVersion/
// Distribution: publishing a new version is always a new
// WorkflowVersion row, never an edit to a prior one.

export type WorkflowStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "DISABLED" | "ARCHIVED";

const TERMINAL_WORKFLOW_STATES: ReadonlySet<WorkflowStatus> = new Set(["ARCHIVED"]);

// doc 11 doesn't spell out an exhaustive transition table the way the
// case/filing state machines do, but it does establish the shape:
// DRAFT is where a workflow starts; ACTIVE is where it actually runs;
// PAUSED/DISABLED are reversible off-states; ARCHIVED is the one
// terminal state. Kept explicit and validated rather than left as a
// free-form enum, matching every other status model in this codebase.
const ALLOWED_TRANSITIONS: Record<WorkflowStatus, ReadonlySet<WorkflowStatus>> = {
  DRAFT: new Set(["ACTIVE", "ARCHIVED"]),
  ACTIVE: new Set(["PAUSED", "DISABLED", "ARCHIVED"]),
  PAUSED: new Set(["ACTIVE", "DISABLED", "ARCHIVED"]),
  DISABLED: new Set(["ACTIVE", "ARCHIVED"]),
  ARCHIVED: new Set([]),
};

export function isTerminalWorkflowStatus(status: WorkflowStatus): boolean {
  return TERMINAL_WORKFLOW_STATES.has(status);
}

export function canTransitionWorkflowStatus(from: WorkflowStatus, to: WorkflowStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].has(to);
}

export class InvalidWorkflowTransitionError extends Error {
  constructor(public from: WorkflowStatus, public to: WorkflowStatus) {
    super(`Invalid workflow status transition: ${from} -> ${to}`);
    this.name = "InvalidWorkflowTransitionError";
  }
}

export function assertValidWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus): void {
  if (!canTransitionWorkflowStatus(from, to)) {
    throw new InvalidWorkflowTransitionError(from, to);
  }
}

// --- Workflow definition + versioning (doc 11 §3-4) ------------------------

export type WorkflowStepType =
  | "TRIGGER"
  | "CONDITION"
  | "AI_ANALYSIS"
  | "DATA_LOOKUP"
  | "API_CALL"
  | "DOCUMENT_GENERATION"
  | "EMAIL"
  | "SMS"
  | "PHONE_CALL"
  | "DATABASE_UPDATE"
  | "WAIT"
  | "SCHEDULE"
  | "HUMAN_APPROVAL"
  | "ESCALATION"
  | "RETRY"
  | "END";

export interface WorkflowStepDefinition {
  stepId: string;
  type: WorkflowStepType;
  config?: Record<string, unknown>;
}

export interface WorkflowDefinitionInput {
  name: string;
  description?: string;
  triggerType: string;
  steps: readonly WorkflowStepDefinition[];
  conditions?: Record<string, unknown>;
  approvalRequirements?: readonly string[];
}

export interface WorkflowVersionRecord {
  workflowId: string;
  version: number;
  definition: WorkflowDefinitionInput;
  triggerType: string;
  author: string;
  reason?: string;
  changes?: string;
  effectiveDate: string;
}

/**
 * Pure: builds the next WorkflowVersion record to persist. Never
 * mutates a prior version -- the caller always inserts this as a new
 * row (doc 11 §4's "never silently change an active workflow
 * underneath an existing execution").
 */
export function planNextWorkflowVersion(params: {
  workflowId: string;
  currentVersion: number;
  definition: WorkflowDefinitionInput;
  author: string;
  reason?: string;
  changes?: string;
  now: string;
}): WorkflowVersionRecord {
  return {
    workflowId: params.workflowId,
    version: params.currentVersion + 1,
    definition: params.definition,
    triggerType: params.definition.triggerType,
    author: params.author,
    reason: params.reason,
    changes: params.changes,
    effectiveDate: params.now,
  };
}

export interface WorkflowStructuralIssue {
  code:
    | "NO_STEPS"
    | "DUPLICATE_STEP_ID"
    | "NO_TRIGGER_TYPE"
    | "MISSING_END_STEP";
  detail: string;
}

/**
 * Pure: structural validation of a workflow definition before it's
 * published as a new version -- catches the kinds of mistakes that
 * would otherwise only surface at execution time (doc 11 §92's
 * pre-flight-check discipline, applied one level up at definition
 * time).
 */
export function validateWorkflowDefinition(definition: WorkflowDefinitionInput): WorkflowStructuralIssue[] {
  const issues: WorkflowStructuralIssue[] = [];

  if (definition.steps.length === 0) {
    issues.push({ code: "NO_STEPS", detail: "A workflow must declare at least one step." });
  }

  const seenIds = new Set<string>();
  for (const step of definition.steps) {
    if (seenIds.has(step.stepId)) {
      issues.push({ code: "DUPLICATE_STEP_ID", detail: `Step id "${step.stepId}" is declared more than once.` });
    }
    seenIds.add(step.stepId);
  }

  if (!definition.triggerType || definition.triggerType.trim().length === 0) {
    issues.push({ code: "NO_TRIGGER_TYPE", detail: "A workflow must declare a trigger type." });
  }

  if (definition.steps.length > 0 && !definition.steps.some((s) => s.type === "END")) {
    issues.push({ code: "MISSING_END_STEP", detail: "A workflow must declare a terminating END step." });
  }

  return issues;
}

/**
 * Pure: which version an in-flight WorkflowExecution should be pinned
 * to when it starts -- always the workflow's currentVersion at start
 * time, never re-resolved later. Consumed by workflowExecution.ts
 * (P10-2) when a new execution is created.
 */
export function resolveExecutionVersion(workflow: { currentVersion: number }): number {
  return workflow.currentVersion;
}
