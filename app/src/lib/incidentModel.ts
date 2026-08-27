// Alert dedup + correlation + incident model + root-cause grouping --
// doc 12 sections 45-48. PLAN.md P11-16.
//
// "Do not create 10,000 identical alerts for the same underlying
// problem. Group repeated alerts... instead of 10,000 alerts, create 1
// incident, occurrences 10,000." / "Correlate related failures...
// filing API unavailable -> submissions fail -> workflow failures
// increase -> queue grows -> cases become stuck. The dashboard should
// identify LIKELY ROOT CAUSE rather than showing five unrelated
// crises." / Incident fields: id/severity/root component/start-end
// time/affected systems/workflows/cases/alerts/status/resolution/
// operator/timeline. / "Group downstream failures under a parent
// incident."

import type { Alert, AlertSeverity } from "./alertEngine";

/**
 * Pure: doc 12 §45 -- finds whether an incoming alert matches an
 * already-open alert of the same type+component. The caller uses this
 * to decide whether to bump an existing alert's occurrence count
 * (dedup) rather than insert a new row.
 */
export function findMatchingOpenAlert(
  existingAlerts: readonly Alert[],
  incoming: { type: string; component: string }
): Alert | undefined {
  return existingAlerts.find(
    (a) => a.type === incoming.type && a.component === incoming.component && a.status !== "RESOLVED" && a.status !== "SUPPRESSED"
  );
}

/**
 * Pure: doc 12 §45's own worked example -- bumps occurrenceCount and
 * lastDetected rather than creating a duplicate alert row.
 */
export function dedupAlertOccurrence(existing: Alert, now: string): Alert {
  return { ...existing, occurrenceCount: existing.occurrenceCount + 1, lastDetected: now };
}

// --- Incident model + root-cause grouping (doc 12 §47-48) -------------------

export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED";

export interface Incident {
  severity: AlertSeverity;
  rootComponent: string;
  startTime: string;
  endTime?: string;
  affectedSystems: readonly string[];
  affectedWorkflows: readonly string[];
  affectedCases: readonly string[];
  alertTypes: readonly string[];
  status: IncidentStatus;
  resolution?: string;
  operator?: string;
}

/**
 * Pure: doc 12 §48's own worked example (SMS provider outage affects
 * SMS workflow, follow-up workflow, claimant notification workflow,
 * operator notifications) -- groups a batch of related alerts under
 * one parent incident rather than one alert per affected system,
 * "preventing alert overload."
 */
export function buildIncidentFromAlerts(params: {
  rootComponent: string;
  severity: AlertSeverity;
  alerts: readonly Alert[];
  startTime: string;
}): Incident {
  const affectedSystems = [...new Set(params.alerts.map((a) => a.component))];
  const affectedWorkflows = [...new Set(params.alerts.map((a) => a.workflowId).filter((w): w is string => !!w))];
  const affectedCases = [...new Set(params.alerts.map((a) => a.caseId).filter((c): c is string => !!c))];
  const alertTypes = [...new Set(params.alerts.map((a) => a.type))];
  return {
    rootComponent: params.rootComponent,
    severity: params.severity,
    startTime: params.startTime,
    affectedSystems,
    affectedWorkflows,
    affectedCases,
    alertTypes,
    status: "OPEN",
  };
}

/**
 * Pure: doc 12 §46's own correlation-chain example collapses to one
 * question -- is a downstream alert's timestamp within a plausible
 * cascade window of the root alert? If so it belongs under the same
 * incident rather than being reported as an unrelated crisis.
 */
export function isLikelyCascadeAlert(rootAlertDetectedAt: string, downstreamAlertDetectedAt: string, maxCascadeWindowMs: number): boolean {
  const delta = new Date(downstreamAlertDetectedAt).getTime() - new Date(rootAlertDetectedAt).getTime();
  return delta >= 0 && delta <= maxCascadeWindowMs;
}
