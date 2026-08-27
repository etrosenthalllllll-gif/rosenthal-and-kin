// Alert acknowledgment + suppression + maintenance mode -- doc 12
// sections 52-54. PLAN.md P11-18.
//
// "Operator can: ACKNOWLEDGE, INVESTIGATE, RESOLVE, SUPPRESS,
// ESCALATE. Record: operator, timestamp, action, notes." / "Allow
// authorized suppression... require reason, duration, operator. Do
// not permanently suppress critical alerts accidentally." / "Allow
// components to be marked MAINTENANCE during planned downtime.
// Monitoring should distinguish expected downtime from unexpected
// outage."

import type { Alert, AlertStatus } from "./alertEngine";

export type OperatorAlertAction = "ACKNOWLEDGE" | "INVESTIGATE" | "RESOLVE" | "SUPPRESS" | "ESCALATE";

const ACTION_TO_STATUS: Record<OperatorAlertAction, AlertStatus> = {
  ACKNOWLEDGE: "ACKNOWLEDGED",
  INVESTIGATE: "INVESTIGATING",
  RESOLVE: "RESOLVED",
  SUPPRESS: "SUPPRESSED",
  ESCALATE: "OPEN", // doc 12 doesn't map ESCALATE to a terminal alert status -- it stays open but escalated via automationNotification.ts's ladder (P10-21)
};

export interface OperatorAlertActionRecord {
  action: OperatorAlertAction;
  operator: string;
  timestamp: string;
  notes?: string;
}

/**
 * Pure: applies an operator action to an alert, always recording who/
 * when/what per doc 12 §52 -- never a silent status flip.
 */
export function applyOperatorAlertAction(
  alert: Alert,
  action: OperatorAlertAction,
  operator: string,
  now: string,
  notes?: string
): Alert & { lastAction: OperatorAlertActionRecord } {
  return {
    ...alert,
    status: ACTION_TO_STATUS[action],
    lastAction: { action, operator, timestamp: now, notes },
  };
}

// --- Alert suppression (doc 12 §53) -----------------------------------------

import type { AlertSeverity } from "./alertEngine";

export interface SuppressionRequest {
  reason: string;
  durationMs: number;
  operator: string;
}

export type SuppressionOutcome =
  | { status: "SUPPRESSED"; suppressedUntil: string }
  | { status: "REJECTED_MISSING_AUTHORIZATION" }
  | { status: "REJECTED_INDEFINITE_CRITICAL_SUPPRESSION" };

// doc 12 §53's own "do not permanently suppress critical alerts
// accidentally" -- enforced structurally: EMERGENCY-severity alerts
// may never be suppressed with an unbounded/zero duration.
export function requestAlertSuppression(
  severity: AlertSeverity,
  request: SuppressionRequest,
  now: string
): SuppressionOutcome {
  if (!request.reason.trim() || !request.operator.trim()) {
    return { status: "REJECTED_MISSING_AUTHORIZATION" };
  }
  if (severity === "EMERGENCY" && request.durationMs <= 0) {
    return { status: "REJECTED_INDEFINITE_CRITICAL_SUPPRESSION" };
  }
  return { status: "SUPPRESSED", suppressedUntil: new Date(new Date(now).getTime() + request.durationMs).toISOString() };
}

// --- Maintenance mode (doc 12 §54) ------------------------------------------

export type ComponentOperationalMode = "NORMAL" | "MAINTENANCE";

/**
 * Pure: doc 12 §54 -- while a component is explicitly in MAINTENANCE
 * mode, an observed failure is expected downtime, not an unexpected
 * outage, and should not raise the same alert it otherwise would.
 */
export function isExpectedDowntime(mode: ComponentOperationalMode): boolean {
  return mode === "MAINTENANCE";
}
