// Operator override + automation pause -- doc 11 sections 26-29.
// PLAN.md P10-7.
//
// "Authorized operators should be able to override automation...
// Require: reason, operator, timestamp. Never hide the fact that an
// override occurred." / Global kill switch: AUTOMATION_ACTIVE,
// AUTOMATION_PAUSED, AUTOMATION_EMERGENCY_STOP. "When paused: do not
// start new automated actions. Preserve queued work. Preserve existing
// executions." / Workflow-level and case-level pause are independent,
// narrower scopes of the same idea.

export type GlobalAutomationState = "AUTOMATION_ACTIVE" | "AUTOMATION_PAUSED" | "AUTOMATION_EMERGENCY_STOP";

export interface OperatorOverrideRecord {
  action: string;
  reason: string;
  operator: string;
  timestamp: string;
}

/**
 * Pure: doc 11 §26 -- an override is only ever recorded, never
 * silently applied. A missing reason or operator is a structural
 * rejection, same "authorization is structurally required" discipline
 * as financialAdjustments.ts's createAdjustment().
 */
export function recordOperatorOverride(input: {
  action: string;
  reason: string;
  operator: string;
  timestamp: string;
}): { status: "RECORDED"; override: OperatorOverrideRecord } | { status: "REJECTED_MISSING_AUTHORIZATION" } {
  if (!input.reason.trim() || !input.operator.trim()) {
    return { status: "REJECTED_MISSING_AUTHORIZATION" };
  }
  return { status: "RECORDED", override: { ...input } };
}

/**
 * Pure: doc 11 §27 -- while automation is paused or emergency-stopped,
 * no NEW automated action may start. Already-queued work and
 * already-running executions are untouched by this check (the caller
 * is responsible for not cancelling them); this only gates the start
 * of new work.
 */
export function canStartNewAutomatedAction(globalState: GlobalAutomationState): boolean {
  return globalState === "AUTOMATION_ACTIVE";
}

// --- Workflow-level and case-level pause (doc 11 §28-29) --------------------

export type PauseScope = "GLOBAL" | "WORKFLOW" | "CASE";

export interface PauseRecord {
  scope: PauseScope;
  targetId: string; // workflowId or caseId; ignored for GLOBAL
  reason: string;
  pausedBy: string;
  pausedAt: string;
}

export interface AutomationPauseState {
  global: GlobalAutomationState;
  pausedWorkflowIds: ReadonlySet<string>;
  pausedCaseIds: ReadonlySet<string>;
}

/**
 * Pure: doc 11 §29 -- "no automated outbound communication should
 * occur until resumed" for a paused case, independent of whether the
 * workflow or the whole system is otherwise active. All three scopes
 * are checked -- a workflow-level or case-level pause blocks action
 * even when the global switch is ACTIVE, and vice versa.
 */
export function isAutomationBlocked(
  state: AutomationPauseState,
  target: { workflowId?: string; caseId?: string }
): boolean {
  if (!canStartNewAutomatedAction(state.global)) return true;
  if (target.workflowId && state.pausedWorkflowIds.has(target.workflowId)) return true;
  if (target.caseId && state.pausedCaseIds.has(target.caseId)) return true;
  return false;
}
