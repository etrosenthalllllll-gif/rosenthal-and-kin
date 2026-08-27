// Dashboard filters + drill-down + exports + reporting + data
// freshness -- doc 13 sections 82-87. PLAN.md P12-28.
//
// "Every dashboard should share a common set of filter dimensions:
// date range, source, jurisdiction, case type, operator, workflow." /
// "Support drill-down from any aggregate number down to the
// underlying cases/events that produced it." / "Gate CSV/export
// access by permission -- not every role should be able to export raw
// case-level data." / "Support scheduled reports, built from the same
// metric registry as the live dashboards -- never a separate,
// divergent report-generation formula." / "If the underlying data is
// stale, show an explicit DATA_DELAYED indicator rather than
// silently presenting old numbers as current."

import { hasPermission, type UserRole } from "./auth";
import type { MetricDefinitionRegistry } from "./analyticsDataQuality";

// --- Shared filter dimensions (doc 13 §82) ----------------------------------

export const DASHBOARD_FILTER_DIMENSIONS = ["DATE_RANGE", "SOURCE", "JURISDICTION", "CASE_TYPE", "OPERATOR", "WORKFLOW"] as const;
export type DashboardFilterDimension = (typeof DASHBOARD_FILTER_DIMENSIONS)[number];

export type DashboardFilterSet = Partial<Record<DashboardFilterDimension, string>>;

// --- Drill-down from an aggregate to its underlying records (doc 13 §83) ---

export interface DrillDownResult<TRecord> {
  aggregateLabel: string;
  aggregateValue: number;
  underlyingRecords: readonly TRecord[];
}

/**
 * Pure: doc 13 §83 -- "support drill-down from any aggregate number
 * down to the underlying cases/events that produced it." Generic over
 * the record shape so it works for the case-level, event-level, or
 * transaction-level drill targets across every dashboard.
 */
export function buildDrillDown<TRecord>(aggregateLabel: string, aggregateValue: number, underlyingRecords: readonly TRecord[]): DrillDownResult<TRecord> {
  return { aggregateLabel, aggregateValue, underlyingRecords };
}

// --- Export gating by permission (doc 13 §84) -------------------------------

export interface ExportRequest {
  role: UserRole;
  format: "CSV" | "JSON" | "PDF";
}

export interface ExportAuthorization {
  isAuthorized: boolean;
  reason: string | null;
}

/**
 * Pure: doc 13 §84 -- "not every role should be able to export raw
 * case-level data." Reuses `auth.ts`'s `hasPermission()` rather than
 * a second, parallel permission check.
 */
export function authorizeExport(request: ExportRequest): ExportAuthorization {
  const isAuthorized = hasPermission(request.role, "EXPORT_ANALYTICS_DATA");
  return { isAuthorized, reason: isAuthorized ? null : `role ${request.role} lacks EXPORT_ANALYTICS_DATA` };
}

// --- Scheduled reports, built from the shared metric registry (doc 13 §85) -

export interface ScheduledReportDefinition {
  reportName: string;
  metricNames: readonly string[];
  cadence: "DAILY" | "WEEKLY" | "MONTHLY";
}

export interface ScheduledReportRenderResult {
  reportName: string;
  cadence: ScheduledReportDefinition["cadence"];
  metrics: readonly { metricName: string; formula: string; version: number }[];
  /** Metric names in the report definition with no entry in the
   * registry -- surfaced rather than silently dropped. */
  missingMetricNames: readonly string[];
}

/**
 * Pure: doc 13 §85 -- "never a separate, divergent report-generation
 * formula." Every metric in the report is resolved from the same
 * `MetricDefinitionRegistry` the live dashboards read from.
 */
export function renderScheduledReport(definition: ScheduledReportDefinition, registry: MetricDefinitionRegistry): ScheduledReportRenderResult {
  const metrics: { metricName: string; formula: string; version: number }[] = [];
  const missingMetricNames: string[] = [];
  for (const name of definition.metricNames) {
    const def = registry.get(name);
    if (def) metrics.push({ metricName: def.metricName, formula: def.formula, version: def.version });
    else missingMetricNames.push(name);
  }
  return { reportName: definition.reportName, cadence: definition.cadence, metrics, missingMetricNames };
}

// --- Data freshness / DATA_DELAYED flag (doc 13 §86-87) ---------------------

export interface DataFreshnessCheck {
  isDelayed: boolean;
  ageMs: number;
}

/**
 * Pure: doc 13 §87 -- "show an explicit DATA_DELAYED indicator rather
 * than silently presenting old numbers as current."
 */
export function evaluateDataFreshness(lastUpdatedAt: string, now: string, maxFreshMs: number): DataFreshnessCheck {
  const ageMs = new Date(now).getTime() - new Date(lastUpdatedAt).getTime();
  return { isDelayed: ageMs > maxFreshMs, ageMs };
}
