// Observability: workflow trace + execution log + automation error
// dashboard -- doc 11 sections 59-63. PLAN.md P10-14.
//
// "Every case should have a workflow trace... This should be visible
// from the case." / "Every workflow step should record: execution id,
// step, start time, end time, status, input reference, output
// reference, error, retry count, actor, workflow version. Do not store
// enormous duplicated payloads unnecessarily. Reference stored objects
// where appropriate." / Error dashboard columns: workflow, case, step,
// error type, attempts, last attempt, next retry, priority, status. /
// "The operator dashboard should prioritize: 1. Critical failures, 2.
// Human approvals, 3. Conflicting data, 4. Low-confidence decisions,
// 5. Deadline issues, 6. External provider failures, 7. Synchronization
// problems, 8. Other exceptions."

// --- Workflow trace (doc 11 §60) --------------------------------------------

export interface WorkflowTraceStep {
  label: string;
  timestamp: string;
}

/**
 * Pure: builds an ordered, human-readable trace from a case's raw
 * event history -- doc 11 §60's own worked example (CASE CREATED ->
 * RESEARCH STARTED -> ... -> CLAIM WORKFLOW STARTED). Sorted by
 * timestamp so caller-supplied events don't need to already be in
 * order.
 */
export function buildWorkflowTrace(events: readonly { eventType: string; timestamp: string }[]): WorkflowTraceStep[] {
  return [...events]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((e) => ({ label: e.eventType, timestamp: e.timestamp }));
}

// --- Execution log (doc 11 §61) ---------------------------------------------

export interface ExecutionLogEntry {
  executionId: string;
  step: string;
  startTime: string;
  endTime?: string;
  status: string;
  inputRef?: string;
  outputRef?: string;
  error?: string;
  retryCount: number;
  actor: string;
  workflowVersion: number;
}

/**
 * Pure: builds one execution-log row. Deliberately takes *references*
 * (inputRef/outputRef -- ids into wherever the actual payload lives),
 * never the raw payload itself, per doc 11 §61's "do not store
 * enormous duplicated payloads" instruction.
 */
export function buildExecutionLogEntry(params: {
  executionId: string;
  step: string;
  startTime: string;
  endTime?: string;
  status: string;
  inputRef?: string;
  outputRef?: string;
  error?: string;
  retryCount?: number;
  actor: string;
  workflowVersion: number;
}): ExecutionLogEntry {
  return { ...params, retryCount: params.retryCount ?? 0 };
}

// --- Automation error dashboard, exception-first ordering (doc 11 §62-63) ---

export type ExceptionCategory =
  | "CRITICAL_FAILURE"
  | "HUMAN_APPROVAL"
  | "CONFLICTING_DATA"
  | "LOW_CONFIDENCE"
  | "DEADLINE_ISSUE"
  | "PROVIDER_FAILURE"
  | "SYNC_PROBLEM"
  | "OTHER";

// doc 11 §63's own numbered priority list, verbatim order.
const CATEGORY_PRIORITY: readonly ExceptionCategory[] = [
  "CRITICAL_FAILURE",
  "HUMAN_APPROVAL",
  "CONFLICTING_DATA",
  "LOW_CONFIDENCE",
  "DEADLINE_ISSUE",
  "PROVIDER_FAILURE",
  "SYNC_PROBLEM",
  "OTHER",
];

export interface AutomationErrorRow {
  workflow: string;
  caseId?: string;
  step: string;
  errorType: string;
  category: ExceptionCategory;
  attempts: number;
  lastAttempt: string;
  nextRetry?: string;
  status: string;
}

/**
 * Pure: doc 11 §63 -- "normal successful automation should not
 * overwhelm the operator" is satisfied by the caller only ever
 * passing exception rows here, and this function orders those rows so
 * critical failures always surface before routine sync noise,
 * regardless of how many of each exist.
 */
export function sortByExceptionPriority(rows: readonly AutomationErrorRow[]): AutomationErrorRow[] {
  return [...rows].sort((a, b) => CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category));
}
