// Metrics retention + performance/throughput/reliability dashboards --
// doc 12 sections 63-66. PLAN.md P11-22.
//
// "Store historical metrics sufficiently to support: 24-hour, 7-day,
// 30-day, longer-term trend analysis. Avoid storing excessive high-
// cardinality data unnecessarily." / Performance dashboard: average/
// P95 workflow duration, queue processing time, API/AI latency,
// document/filing processing time, communication delivery time, case
// cycle time. / Throughput dashboard: leads/documents/AI requests/
// emails/SMS/calls/claims-prepared/claims-filed/payments-reconciled/
// cases-closed per hour/day/week/month. / Automation reliability
// dashboard: success rate, human intervention rate, retry rate,
// failure rate, exception rate, duplicate prevention count, SLA
// compliance, average recovery time.
//
// This is deliberately assembly-only for the reliability dashboard --
// it composes automationAnalytics.ts's (P10-15) health-score/
// intervention-metrics functions and workflowReconciliation.ts's
// (P10-24) SLA-compliance function rather than recomputing any of
// them a second way.

export type MetricsRetentionWindow = "24h" | "7d" | "30d" | "LONG_TERM_TREND";

// doc 12 §63's own instruction, encoded as a constant rather than left
// as prose -- callers use this to decide what to keep, not this
// module (no storage logic belongs here).
export const METRICS_RETENTION_WINDOWS: readonly MetricsRetentionWindow[] = ["24h", "7d", "30d", "LONG_TERM_TREND"];

// --- Performance dashboard (doc 12 §64) -------------------------------------

export interface PerformanceDashboard {
  avgWorkflowDurationMs: number | null;
  p95WorkflowDurationMs: number | null;
  queueProcessingTimeMs: number | null;
  apiLatencyMs: number | null;
  aiLatencyMs: number | null;
  documentProcessingTimeMs: number | null;
  filingProcessingTimeMs: number | null;
  communicationDeliveryTimeMs: number | null;
  caseCycleTimeMs: number | null;
}

export function buildPerformanceDashboard(dashboard: PerformanceDashboard): PerformanceDashboard {
  return { ...dashboard };
}

// --- Throughput dashboard (doc 12 §65) ---------------------------------------

export type ThroughputPeriod = "HOUR" | "DAY" | "WEEK" | "MONTH";

export interface ThroughputCounts {
  leadsProcessed: number;
  documentsProcessed: number;
  aiRequests: number;
  emailsSent: number;
  smsSent: number;
  callsCompleted: number;
  claimsPrepared: number;
  claimsFiled: number;
  paymentsReconciled: number;
  casesClosed: number;
}

export interface ThroughputDashboard extends ThroughputCounts {
  period: ThroughputPeriod;
}

export function buildThroughputDashboard(counts: ThroughputCounts, period: ThroughputPeriod): ThroughputDashboard {
  return { ...counts, period };
}

// --- Automation reliability dashboard (doc 12 §66) --------------------------

import { computeAutomationHealthScore, computeWorkflowInterventionMetrics } from "./automationAnalytics";
import { computeSlaComplianceRate, type SlaOutcome } from "./workflowReconciliation";

export interface AutomationReliabilityInput {
  healthCounts: Parameters<typeof computeAutomationHealthScore>[0];
  interventionCounts: Parameters<typeof computeWorkflowInterventionMetrics>[0];
  slaOutcomes: readonly SlaOutcome[];
  duplicatePreventionCount: number;
  averageRecoveryTimeMs: number | null;
}

export interface AutomationReliabilityDashboard {
  successRatePercent: number | null;
  failureRatePercent: number | null;
  retryRatePercent: number | null;
  humanInterventionRatePercent: number | null;
  slaCompliancePercent: number | null;
  duplicatePreventionCount: number;
  averageRecoveryTimeMs: number | null;
}

export function buildAutomationReliabilityDashboard(input: AutomationReliabilityInput): AutomationReliabilityDashboard {
  const health = computeAutomationHealthScore(input.healthCounts);
  const intervention = computeWorkflowInterventionMetrics(input.interventionCounts);
  return {
    successRatePercent: health.successRate,
    failureRatePercent: health.failureRate,
    retryRatePercent: health.retryRate,
    humanInterventionRatePercent: intervention.humanInterventionRate,
    slaCompliancePercent: computeSlaComplianceRate(input.slaOutcomes),
    duplicatePreventionCount: input.duplicatePreventionCount,
    averageRecoveryTimeMs: input.averageRecoveryTimeMs,
  };
}
