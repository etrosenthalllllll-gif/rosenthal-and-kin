// Alert engine + severity + alert model -- doc 12 sections 42-44.
// PLAN.md P11-15.
//
// "Build a centralized alert engine. Alerts can originate from: health
// checks, API monitoring, workflow failures, queue failures, AI
// failures, communication failures, filing failures, sync failures,
// SLA violations, stuck cases, cost thresholds, security events." /
// "Support INFO, WARNING, ERROR, CRITICAL, EMERGENCY. Severity must be
// configurable." / Alert model fields: id/type/severity/source/
// component/case/workflow/message/details/first-detected/last-
// detected/occurrence-count/status/assigned-operator/resolution/
// resolved-timestamp. Statuses: OPEN, ACKNOWLEDGED, INVESTIGATING,
// RESOLVED, SUPPRESSED.

export type AlertSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL" | "EMERGENCY";

// doc 12 §42's own origin list, non-exhaustive/extensible like the
// event-type catalogs elsewhere in this codebase.
export type AlertSource =
  | "HEALTH_CHECK"
  | "API_MONITORING"
  | "WORKFLOW_FAILURE"
  | "QUEUE_FAILURE"
  | "AI_FAILURE"
  | "COMMUNICATION_FAILURE"
  | "FILING_FAILURE"
  | "SYNC_FAILURE"
  | "SLA_VIOLATION"
  | "STUCK_CASE"
  | "COST_THRESHOLD"
  | "SECURITY_EVENT";

export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "INVESTIGATING" | "RESOLVED" | "SUPPRESSED";

export interface Alert {
  type: string;
  severity: AlertSeverity;
  source: AlertSource;
  component: string;
  caseId?: string;
  workflowId?: string;
  message: string;
  details?: Record<string, unknown>;
  firstDetected: string;
  lastDetected: string;
  occurrenceCount: number;
  status: AlertStatus;
  assignedOperator?: string;
  resolution?: string;
  resolvedAt?: string;
}

/**
 * Pure: builds a brand-new Alert -- always starts OPEN,
 * occurrenceCount 1, firstDetected == lastDetected == now.
 */
export function buildNewAlert(params: {
  type: string;
  severity: AlertSeverity;
  source: AlertSource;
  component: string;
  caseId?: string;
  workflowId?: string;
  message: string;
  details?: Record<string, unknown>;
  now: string;
}): Alert {
  return {
    ...params,
    firstDetected: params.now,
    lastDetected: params.now,
    occurrenceCount: 1,
    status: "OPEN",
  };
}

// --- Configurable severity mapping (doc 12 §43) -----------------------------

// doc 12 §43's own worked examples, verbatim -- configurable per
// source/type, never a hardcoded switch statement scattered through
// every monitoring module.
export type SeverityRuleTable = Readonly<Record<string, AlertSeverity>>;

export const DEFAULT_SEVERITY_RULES: SeverityRuleTable = {
  SINGLE_FAILED_REQUEST: "INFO",
  REPEATED_PROVIDER_FAILURE: "ERROR",
  PROVIDER_UNAVAILABLE: "CRITICAL",
  DUPLICATE_FINANCIAL_ACTION_SUSPECTED: "EMERGENCY",
};

export function resolveAlertSeverity(alertType: string, rules: SeverityRuleTable = DEFAULT_SEVERITY_RULES): AlertSeverity {
  return rules[alertType] ?? "WARNING";
}
