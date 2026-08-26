// Control dashboard assembly -- doc 11 sections 97-99. PLAN.md P10-25.
//
// "Create a central AUTOMATION CONTROL CENTER. Top-level metrics:
// active workflows, waiting approvals, failed jobs, retrying,
// dead-letter jobs, sync exceptions, stale workflows, critical alerts,
// scheduled jobs, automation success rate, human intervention rate.
// Then sections: approvals, exceptions, failures, scheduled, active
// workflows, system health." / "Every case should show: automation
// status, current workflow, current step, waiting for, next action,
// confidence, last event, last error." / "After YES: system
// automatically executes action, records decision, verifies result,
// advances workflow, creates next task, updates case state, logs
// event. The operator should not need to manually perform every
// intermediate technical step."
//
// This is deliberately an assembly module, not new logic -- it takes
// counts/records already produced by P10-1 through P10-24's modules
// (workflow execution status, retryEngine's dead-letter entries,
// crossSystemSync's exceptions, workflowReconciliation's staleness
// checks, automationAnalytics's health score) and packages them into
// the two dashboard shapes the doc describes.

export interface AutomationControlCenterSummary {
  activeWorkflows: number;
  waitingApprovals: number;
  failedJobs: number;
  retrying: number;
  deadLetterJobs: number;
  syncExceptions: number;
  staleWorkflows: number;
  criticalAlerts: number;
  scheduledJobs: number;
  automationSuccessRate: number | null;
  humanInterventionRate: number | null;
}

export function buildAutomationControlCenterSummary(counts: AutomationControlCenterSummary): AutomationControlCenterSummary {
  return { ...counts };
}

// --- Per-case automation panel (doc 11 §98) ---------------------------------

export interface CaseAutomationPanel {
  automationStatus: "ACTIVE" | "PAUSED" | "BLOCKED" | "IDLE";
  currentWorkflow?: string;
  currentStep?: string;
  waitingFor?: string;
  nextAction?: string;
  confidencePercent?: number;
  lastEvent?: string;
  lastError?: string;
}

export function buildCaseAutomationPanel(panel: CaseAutomationPanel): CaseAutomationPanel {
  return { ...panel };
}

// --- One-click operator flow (doc 11 §99) -----------------------------------

export type OperatorFlowStep =
  | "EXECUTE_ACTION"
  | "RECORD_DECISION"
  | "VERIFY_RESULT"
  | "ADVANCE_WORKFLOW"
  | "CREATE_NEXT_TASK"
  | "UPDATE_CASE_STATE"
  | "LOG_EVENT";

// doc 11 §99's own worked example, verbatim order -- exposed as a
// constant so the caller wiring an operator's [YES] click always
// performs the same sequence rather than each caller re-deriving it.
export const OPERATOR_APPROVAL_FLOW: readonly OperatorFlowStep[] = [
  "EXECUTE_ACTION",
  "RECORD_DECISION",
  "VERIFY_RESULT",
  "ADVANCE_WORKFLOW",
  "CREATE_NEXT_TASK",
  "UPDATE_CASE_STATE",
  "LOG_EVENT",
];
