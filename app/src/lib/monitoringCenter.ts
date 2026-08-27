// Final Monitoring Center assembly -- doc 12 sections 85-91. PLAN.md
// P11-28.
//
// "The finished UI should have a central page: MONITORING CENTER --
// SYSTEM HEALTH / ACTIVE INCIDENTS / ATTENTION REQUIRED / QUEUES /
// SYSTEM METRICS." / "Do NOT build this as a collection of unrelated
// dashboards. Build one unified observability system... SYSTEM ->
// COMPONENT -> WORKFLOW -> JOB -> EVENT -> CASE -> EXTERNAL PROVIDER
// -> ALERT -> INCIDENT -> RESOLUTION."
//
// Deliberately assembly-only -- packages what P11-1 through P11-27
// already produce into the doc's own mockup shape, no new logic.

import type { TopLevelHealthSummary } from "./operatorMonitoringDashboard";
import type { SystemHealthRecord } from "./healthStatus";

export interface MonitoringCenterIncidentSummary {
  severity: string;
  description: string;
  affectedCases: number;
  affectedWorkflows: number;
}

export interface MonitoringCenterAttentionSummary {
  failedWorkflows: number;
  stuckCases: number;
  syncConflicts: number;
  pendingCriticalApprovals: number;
}

export interface MonitoringCenterQueueSummary {
  queueName: string;
  depth: number;
}

export interface MonitoringCenterSystemMetrics {
  automationSuccessRatePercent: number | null;
  apiSuccessRatePercent: number | null;
  queueProcessingPerHour: number | null;
  aiSuccessRatePercent: number | null;
  slaCompliancePercent: number | null;
}

export interface MonitoringCenterView {
  systemHealth: readonly SystemHealthRecord[];
  topLevelSummary: TopLevelHealthSummary;
  activeIncidents: readonly MonitoringCenterIncidentSummary[];
  attentionRequired: MonitoringCenterAttentionSummary;
  queues: readonly MonitoringCenterQueueSummary[];
  systemMetrics: MonitoringCenterSystemMetrics;
}

/**
 * Pure: assembles the doc's own final MONITORING CENTER mockup
 * (§88) from pieces already produced elsewhere in this phase --
 * system health per component (P11-1), the top-level summary
 * (P11-19), incidents (P11-16), the attention-required counts (P11-20),
 * queue depths (P11-7), and the reliability metrics (P11-22).
 */
export function buildMonitoringCenterView(view: MonitoringCenterView): MonitoringCenterView {
  return { ...view };
}
