// Operator dashboard assembly: health summary + prioritized queue +
// alert detail -- doc 12 sections 55-58. PLAN.md P11-19.
//
// "OVERALL SYSTEM: HEALTHY/DEGRADED/DOWN. Critical: 2. Warnings: 7.
// Stuck cases: 14. Failed workflows: 8. Queue backlog: 1,240.
// Provider issues: 1." / "Sort issues by: 1. Safety/financial risk,
// 2. Critical system failure, 3. External provider failure, 4. Filing
// issue, 5. Deadline risk, 6. Large-scale workflow failure, 7.
// Individual case issue, 8. Warning." / Alert detail page: what
// happened / when / why flagged / affected component / affected
// workflows / affected cases / recent events / errors / retries /
// related alerts / likely root cause / recommended action.

export interface TopLevelHealthSummary {
  overallStatus: "HEALTHY" | "DEGRADED" | "DOWN";
  criticalCount: number;
  warningCount: number;
  stuckCasesCount: number;
  failedWorkflowsCount: number;
  queueBacklogCount: number;
  providerIssuesCount: number;
}

export function buildTopLevelHealthSummary(summary: TopLevelHealthSummary): TopLevelHealthSummary {
  return { ...summary };
}

// --- Prioritized operator queue (doc 12 §57) --------------------------------

export type OperatorQueuePriority =
  | "SAFETY_FINANCIAL_RISK"
  | "CRITICAL_SYSTEM_FAILURE"
  | "EXTERNAL_PROVIDER_FAILURE"
  | "FILING_ISSUE"
  | "DEADLINE_RISK"
  | "LARGE_SCALE_WORKFLOW_FAILURE"
  | "INDIVIDUAL_CASE_ISSUE"
  | "WARNING";

// doc 12 §57's own numbered list, verbatim order.
const OPERATOR_QUEUE_PRIORITY_ORDER: readonly OperatorQueuePriority[] = [
  "SAFETY_FINANCIAL_RISK",
  "CRITICAL_SYSTEM_FAILURE",
  "EXTERNAL_PROVIDER_FAILURE",
  "FILING_ISSUE",
  "DEADLINE_RISK",
  "LARGE_SCALE_WORKFLOW_FAILURE",
  "INDIVIDUAL_CASE_ISSUE",
  "WARNING",
];

export interface OperatorQueueItem {
  priority: OperatorQueuePriority;
  description: string;
}

/**
 * Pure: "the operator should see the most important issue first" --
 * sorts by the doc's own 8-level priority ladder.
 */
export function sortOperatorQueue<T extends OperatorQueueItem>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => OPERATOR_QUEUE_PRIORITY_ORDER.indexOf(a.priority) - OPERATOR_QUEUE_PRIORITY_ORDER.indexOf(b.priority)
  );
}

// --- Alert detail page (doc 12 §58) -----------------------------------------

export interface AlertDetailView {
  whatHappened: string;
  when: string;
  whyFlagged: string;
  affectedComponent: string;
  affectedWorkflows: readonly string[];
  affectedCases: readonly string[];
  recentEvents: readonly string[];
  errors: readonly string[];
  retries: number;
  relatedAlertTypes: readonly string[];
  likelyRootCause?: string;
  recommendedAction?: string;
}

export function buildAlertDetailView(view: AlertDetailView): AlertDetailView {
  return { ...view };
}
