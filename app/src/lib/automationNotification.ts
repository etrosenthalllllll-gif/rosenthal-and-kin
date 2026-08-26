// Notification + escalation engine (automation control plane) -- doc
// 11 sections 86-87. PLAN.md P10-21.
//
// "Create notifications for: approval required, workflow failure,
// critical exception, deadline approaching, provider outage, payment
// issue, filing rejection, sync conflict, automation paused,
// automation emergency stop. Notifications should be configurable." /
// "If an issue remains unresolved: escalate. Example: Approval
// pending: 24 hours -> reminder, 48 hours -> escalation, 72 hours ->
// manager/high-priority queue. Times must be configurable."
//
// This is the control plane's own generic time-based escalation ladder
// for *automation* issues (an approval sitting unresolved, a workflow
// stuck) -- distinct from postFilingEscalation.ts's per-case,
// trigger-classified ladder (doc 09), which already covers case-level
// escalation. Same shape (config table, configurable thresholds,
// nothing hardcoded), applied to a different scope.

export type AutomationNotificationTrigger =
  | "APPROVAL_REQUIRED"
  | "WORKFLOW_FAILURE"
  | "CRITICAL_EXCEPTION"
  | "DEADLINE_APPROACHING"
  | "PROVIDER_OUTAGE"
  | "PAYMENT_ISSUE"
  | "FILING_REJECTION"
  | "SYNC_CONFLICT"
  | "AUTOMATION_PAUSED"
  | "AUTOMATION_EMERGENCY_STOP";

export type NotificationConfigTable = Readonly<Partial<Record<AutomationNotificationTrigger, boolean>>>;

/**
 * Pure: doc 11 §86 -- "notifications should be configurable." A
 * trigger with no explicit entry defaults to enabled (notify), since
 * the doc's own posture is "the operator should not need to
 * manually discover" problems -- silence is the thing to opt out of,
 * not opt into.
 */
export function shouldNotify(trigger: AutomationNotificationTrigger, config: NotificationConfigTable): boolean {
  return config[trigger] ?? true;
}

export interface AutomationNotification {
  trigger: AutomationNotificationTrigger;
  message: string;
  timestamp: string;
}

export function buildAutomationNotification(
  trigger: AutomationNotificationTrigger,
  message: string,
  now: string
): AutomationNotification {
  return { trigger, message, timestamp: now };
}

// --- Escalation ladder (doc 11 §87) ------------------------------------------

export type EscalationLadderAction = "REMINDER" | "ESCALATION" | "HIGH_PRIORITY_QUEUE";

export interface EscalationLadderStep {
  afterHours: number;
  action: EscalationLadderAction;
}

// doc 11 §87's own worked example, verbatim.
export const DEFAULT_APPROVAL_ESCALATION_LADDER: readonly EscalationLadderStep[] = [
  { afterHours: 24, action: "REMINDER" },
  { afterHours: 48, action: "ESCALATION" },
  { afterHours: 72, action: "HIGH_PRIORITY_QUEUE" },
];

/**
 * Pure: given how long an issue has been pending and a configurable
 * ladder, returns the most-escalated action whose threshold has been
 * reached (or null if none has). The ladder is expected sorted
 * ascending by afterHours -- this always returns the LAST matching
 * step, never the first, so a 50-hour-old approval gets ESCALATION,
 * not a repeat REMINDER.
 */
export function resolveEscalationAction(
  pendingSince: string,
  now: string,
  ladder: readonly EscalationLadderStep[] = DEFAULT_APPROVAL_ESCALATION_LADDER
): EscalationLadderAction | null {
  const elapsedHours = (new Date(now).getTime() - new Date(pendingSince).getTime()) / (1000 * 60 * 60);
  let result: EscalationLadderAction | null = null;
  for (const step of ladder) {
    if (elapsedHours >= step.afterHours) {
      result = step.action;
    }
  }
  return result;
}
