// Data quality + metric definitions + metric versioning -- doc 13
// sections 69-71. PLAN.md P12-25.
//
// "Run analytics-specific data-quality checks: missing timestamps,
// missing IDs, duplicate events, impossible state transitions,
// negative durations, missing cost or revenue data, unreconciled
// payments, inconsistent statuses across systems." / "Maintain a
// central, formal registry of every metric's exact definition --
// don't let 'conversion rate' mean five different things across five
// dashboards." / "Version metric definitions. A formula change is a
// new version, never a silent redefinition of the old one."

// --- Analytics-specific data-quality checks (doc 13 §69) --------------------

export type DataQualityIssueType =
  | "MISSING_TIMESTAMP"
  | "MISSING_ID"
  | "DUPLICATE_EVENT"
  | "IMPOSSIBLE_TRANSITION"
  | "NEGATIVE_DURATION"
  | "MISSING_COST_OR_REVENUE"
  | "UNRECONCILED_PAYMENT"
  | "INCONSISTENT_STATUS";

export interface DataQualityIssue {
  type: DataQualityIssueType;
  recordId: string;
  detail: string;
}

export interface AnalyticsRecordForQualityCheck {
  recordId: string;
  timestamp?: string;
  eventId?: string;
  seenEventIds: readonly string[];
  fromStatus?: string;
  toStatus?: string;
  allowedTransitions?: ReadonlyMap<string, readonly string[]>;
  durationMs?: number;
  costCents?: number;
  revenueCents?: number;
  hasExpectedCostOrRevenue?: boolean;
  isPaymentReconciled?: boolean;
  statusInSystemA?: string;
  statusInSystemB?: string;
}

/**
 * Pure: doc 13 §69's own checklist -- never a bare "is this record
 * valid" boolean; every issue found is returned with its type and
 * detail so operators can see exactly what's wrong.
 */
export function runAnalyticsDataQualityChecks(record: AnalyticsRecordForQualityCheck): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  if (!record.timestamp) issues.push({ type: "MISSING_TIMESTAMP", recordId: record.recordId, detail: "no timestamp on record" });
  if (!record.recordId) issues.push({ type: "MISSING_ID", recordId: record.recordId, detail: "no record ID" });
  if (record.eventId && record.seenEventIds.includes(record.eventId)) {
    issues.push({ type: "DUPLICATE_EVENT", recordId: record.recordId, detail: `event ${record.eventId} already seen` });
  }
  if (record.fromStatus && record.toStatus && record.allowedTransitions) {
    const allowed = record.allowedTransitions.get(record.fromStatus) ?? [];
    if (!allowed.includes(record.toStatus)) {
      issues.push({ type: "IMPOSSIBLE_TRANSITION", recordId: record.recordId, detail: `${record.fromStatus} -> ${record.toStatus} not allowed` });
    }
  }
  if (record.durationMs !== undefined && record.durationMs < 0) {
    issues.push({ type: "NEGATIVE_DURATION", recordId: record.recordId, detail: `duration ${record.durationMs}ms is negative` });
  }
  if (record.hasExpectedCostOrRevenue && record.costCents === undefined && record.revenueCents === undefined) {
    issues.push({ type: "MISSING_COST_OR_REVENUE", recordId: record.recordId, detail: "expected cost or revenue data, found neither" });
  }
  if (record.isPaymentReconciled === false) {
    issues.push({ type: "UNRECONCILED_PAYMENT", recordId: record.recordId, detail: "payment not reconciled" });
  }
  if (record.statusInSystemA !== undefined && record.statusInSystemB !== undefined && record.statusInSystemA !== record.statusInSystemB) {
    issues.push({
      type: "INCONSISTENT_STATUS",
      recordId: record.recordId,
      detail: `system A says "${record.statusInSystemA}", system B says "${record.statusInSystemB}"`,
    });
  }
  return issues;
}

// --- Central metric-definition registry (doc 13 §70) ------------------------

export interface MetricDefinition {
  metricName: string;
  formula: string;
  description: string;
  version: number;
}

export type MetricDefinitionRegistry = ReadonlyMap<string, MetricDefinition>;

/**
 * Pure: doc 13 §70 -- "don't let 'conversion rate' mean five
 * different things across five dashboards." A single lookup keyed by
 * metric name; every consumer reads from this one registry.
 */
export function getMetricDefinition(registry: MetricDefinitionRegistry, metricName: string): MetricDefinition | null {
  return registry.get(metricName) ?? null;
}

// --- Versioned metric definitions (doc 13 §71) ------------------------------

/**
 * Pure: doc 13 §71 -- "a formula change is a new version, never a
 * silent redefinition of the old one." Returns a brand-new
 * MetricDefinition with version incremented; never mutates the prior
 * definition in place.
 */
export function reviseMetricDefinition(previous: MetricDefinition, newFormula: string, newDescription: string): MetricDefinition {
  return {
    metricName: previous.metricName,
    formula: newFormula,
    description: newDescription,
    version: previous.version + 1,
  };
}
