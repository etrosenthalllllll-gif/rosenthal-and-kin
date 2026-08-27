// Alert fatigue protection + automated remediation -- doc 12 sections
// 69-74. PLAN.md P11-24.
//
// "Do not alert on every insignificant anomaly. Support thresholds,
// debouncing, grouping, cooldowns, deduplication, escalation,
// severity." / "API fails once: no major alert. Fails continuously
// for 5 minutes: WARNING. Fails for 15 minutes: CRITICAL." / "Where
// safe, allow monitoring events to trigger automated remediation...
// Do NOT automatically remediate high-risk business actions." /
// "Every automatic remediation must be logged." / "Automatic
// remediation must be idempotent, limited, audited, reversible where
// possible, protected against loops... Maximum 3 automated
// restarts/hour. After that: ESCALATE_TO_OPERATOR."
//
// Safe-remediation gating reuses orchestrationRisk.ts's (P10-18)
// action-risk classification -- a remediation action is only ever
// auto-executed when its risk level is LOW or MEDIUM; HIGH/CRITICAL
// business actions are excluded by the very same table that already
// gates human-approval requirements, not a second risk list.

import { getActionRiskLevel, type ActionRiskLevel } from "./orchestrationRisk";

export type DebouncedAlertSeverity = "NONE" | "WARNING" | "CRITICAL";

export interface DebounceThresholds {
  warningAfterMs: number;
  criticalAfterMs: number;
}

// doc 12 §70's own worked example, illustrative defaults.
export const DEFAULT_DEBOUNCE_THRESHOLDS: DebounceThresholds = {
  warningAfterMs: 5 * 60 * 1000,
  criticalAfterMs: 15 * 60 * 1000,
};

/**
 * Pure: doc 12 §70 -- a single failure never raises a major alert; the
 * severity escalates only once the failure has been sustained past
 * the configured thresholds.
 */
export function evaluateDebouncedSeverity(
  sustainedFailureDurationMs: number,
  thresholds: DebounceThresholds = DEFAULT_DEBOUNCE_THRESHOLDS
): DebouncedAlertSeverity {
  if (sustainedFailureDurationMs >= thresholds.criticalAfterMs) return "CRITICAL";
  if (sustainedFailureDurationMs >= thresholds.warningAfterMs) return "WARNING";
  return "NONE";
}

// --- Automated remediation (doc 12 §71-73) ----------------------------------

export type RemediationActionType = "RESTART_WORKER" | "RESTART_WORKER_POOL" | "RETRY_REQUEST" | "PAUSE_CIRCUIT_BREAKER";

// doc 12 §71's own worked examples, verbatim mapping.
export const DEFAULT_REMEDIATION_MAP: Readonly<Record<string, RemediationActionType>> = {
  WORKER_CRASH: "RESTART_WORKER",
  QUEUE_STALL: "RESTART_WORKER_POOL",
  TEMPORARY_API_FAILURE: "RETRY_REQUEST",
  CIRCUIT_BREAKER_OPEN: "PAUSE_CIRCUIT_BREAKER",
};

export type RemediationDecision =
  | { action: "AUTO_REMEDIATE"; remediation: RemediationActionType }
  | { action: "NO_SAFE_REMEDIATION" };

// Every remediation this module knows about is itself LOW/MEDIUM risk
// (infrastructure-level retries/restarts, never a business action) --
// this is the table orchestrationRisk.ts's fail-closed-to-CRITICAL
// default would otherwise reject everything through, so it's supplied
// explicitly rather than left to that default.
const REMEDIATION_ACTION_RISK: Readonly<Record<RemediationActionType, ActionRiskLevel>> = {
  RESTART_WORKER: "LOW",
  RESTART_WORKER_POOL: "LOW",
  RETRY_REQUEST: "LOW",
  PAUSE_CIRCUIT_BREAKER: "MEDIUM",
};

/**
 * Pure: doc 12 §71's mapping, gated by doc 12 §73's "never
 * automatically remediate high-risk business actions" -- reuses
 * orchestrationRisk.ts's risk classification so a remediation is only
 * proposed when the underlying action type is LOW/MEDIUM risk. A
 * caller-supplied risk table can override an action to HIGH/CRITICAL
 * (e.g. a business deploys a stricter policy) to block auto-execution
 * even for an action in the default map.
 */
export function planAutomatedRemediation(
  failureType: string,
  remediationMap: Readonly<Record<string, RemediationActionType>> = DEFAULT_REMEDIATION_MAP,
  actionRiskTable: Readonly<Record<string, ActionRiskLevel>> = REMEDIATION_ACTION_RISK
): RemediationDecision {
  const remediation = remediationMap[failureType];
  if (!remediation) return { action: "NO_SAFE_REMEDIATION" };
  const risk = getActionRiskLevel(remediation, actionRiskTable);
  if (risk === "HIGH" || risk === "CRITICAL") return { action: "NO_SAFE_REMEDIATION" };
  return { action: "AUTO_REMEDIATE", remediation };
}

// --- Remediation logging (doc 12 §72) ---------------------------------------

export interface RemediationLogEntry {
  incidentType: string;
  action: RemediationActionType;
  result: "SUCCESS" | "FAILURE";
  timestamp: string;
}

export function buildRemediationLogEntry(
  incidentType: string,
  action: RemediationActionType,
  result: "SUCCESS" | "FAILURE",
  now: string
): RemediationLogEntry {
  return { incidentType, action, result, timestamp: now };
}

// --- Remediation loop protection (doc 12 §74) -------------------------------

export type RemediationLoopDecision = "ALLOW" | "ESCALATE_TO_OPERATOR";

/**
 * Pure: doc 12 §74's own worked example (max 3 automated restarts/
 * hour). Prevents failure -> remediation -> failure -> remediation
 * from continuing indefinitely.
 */
export function evaluateRemediationLoopProtection(attemptsInWindow: number, maxAttemptsPerWindow = 3): RemediationLoopDecision {
  return attemptsInWindow >= maxAttemptsPerWindow ? "ESCALATE_TO_OPERATOR" : "ALLOW";
}
