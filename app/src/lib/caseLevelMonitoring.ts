// Case-level monitoring + stuck-case detection -- doc 12 sections
// 59-60. PLAN.md P11-20.
//
// "Every case should include: automation health, current workflow,
// current step, last successful action, last failed action, pending
// approval, pending external action, next scheduled action, SLA
// status, potentially stuck?, recent errors, recent alerts." / "A case
// becomes suspicious when: no state change for configured duration,
// workflow waiting too long, external provider hasn't responded,
// required document missing, approval hasn't occurred, scheduled
// action missed, sync failed. Create CASE_ATTENTION_REQUIRED."

export interface CaseAutomationHealthPanel {
  caseId: string;
  currentWorkflow?: string;
  currentStep?: string;
  lastSuccessfulAction?: string;
  lastFailedAction?: string;
  pendingApproval: boolean;
  pendingExternalAction: boolean;
  nextScheduledAction?: string;
  slaStatus?: "WITHIN_SLA" | "SLA_EXCEEDED";
  potentiallyStuck: boolean;
  recentErrors: readonly string[];
  recentAlerts: readonly string[];
}

export function buildCaseAutomationHealthPanel(panel: CaseAutomationHealthPanel): CaseAutomationHealthPanel {
  return { ...panel };
}

// --- CASE_ATTENTION_REQUIRED trigger list (doc 12 §60) ----------------------

export type CaseAttentionTrigger =
  | "NO_STATE_CHANGE"
  | "WORKFLOW_WAITING_TOO_LONG"
  | "PROVIDER_NOT_RESPONDED"
  | "REQUIRED_DOCUMENT_MISSING"
  | "APPROVAL_NOT_OCCURRED"
  | "SCHEDULED_ACTION_MISSED"
  | "SYNC_FAILED";

export interface CaseAttentionInput {
  noStateChange: boolean;
  workflowWaitingTooLong: boolean;
  providerNotResponded: boolean;
  requiredDocumentMissing: boolean;
  approvalNotOccurred: boolean;
  scheduledActionMissed: boolean;
  syncFailed: boolean;
}

const TRIGGER_FIELD_MAP: Record<keyof CaseAttentionInput, CaseAttentionTrigger> = {
  noStateChange: "NO_STATE_CHANGE",
  workflowWaitingTooLong: "WORKFLOW_WAITING_TOO_LONG",
  providerNotResponded: "PROVIDER_NOT_RESPONDED",
  requiredDocumentMissing: "REQUIRED_DOCUMENT_MISSING",
  approvalNotOccurred: "APPROVAL_NOT_OCCURRED",
  scheduledActionMissed: "SCHEDULED_ACTION_MISSED",
  syncFailed: "SYNC_FAILED",
};

/**
 * Pure: doc 12 §60's own trigger list, config-table style -- every
 * trigger that fired is collected (not just the first), same "list
 * every blocker, never a bare boolean" discipline as
 * filingReadiness.ts/workflowPreflight.ts.
 */
export function evaluateCaseAttentionRequired(input: CaseAttentionInput): CaseAttentionTrigger[] {
  return (Object.keys(TRIGGER_FIELD_MAP) as Array<keyof CaseAttentionInput>)
    .filter((key) => input[key])
    .map((key) => TRIGGER_FIELD_MAP[key]);
}
