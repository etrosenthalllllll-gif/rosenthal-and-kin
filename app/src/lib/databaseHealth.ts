// Database health monitoring -- doc 12 section 5. PLAN.md P11-2.
//
// "Monitor: database availability, connection failures, query
// latency, slow queries, connection pool utilization, error rate,
// transaction failures, lock contention, replication issues if
// applicable, storage capacity, backup status. Create alerts for
// abnormal behavior."

export interface DatabaseHealthSnapshot {
  connectionFailures: number;
  totalConnections: number;
  slowQueryCount: number;
  totalQueries: number;
  poolUtilizationPercent: number;
  transactionFailures: number;
  totalTransactions: number;
  storageUsedPercent: number;
  lastSuccessfulBackupAt?: string;
}

export type DatabaseAlertType =
  | "CONNECTION_FAILURE_RATE_HIGH"
  | "SLOW_QUERY_RATE_HIGH"
  | "POOL_UTILIZATION_HIGH"
  | "TRANSACTION_FAILURE_RATE_HIGH"
  | "STORAGE_CAPACITY_CRITICAL"
  | "BACKUP_MISSING_OR_STALE";

export interface DatabaseHealthThresholds {
  connectionFailureRatePercent: number;
  slowQueryRatePercent: number;
  poolUtilizationPercent: number;
  transactionFailureRatePercent: number;
  storageUsedPercent: number;
  maxBackupAgeMs: number;
}

// Illustrative defaults, configurable -- same discipline as every
// other threshold table in this codebase.
export const DEFAULT_DATABASE_HEALTH_THRESHOLDS: DatabaseHealthThresholds = {
  connectionFailureRatePercent: 5,
  slowQueryRatePercent: 10,
  poolUtilizationPercent: 90,
  transactionFailureRatePercent: 2,
  storageUsedPercent: 85,
  maxBackupAgeMs: 24 * 60 * 60 * 1000,
};

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * Pure: doc 12 §5's own checklist, config-table style -- every
 * abnormal signal is collected, never just the first, so an operator
 * sees the full database-health picture at once (same "list every
 * blocker" discipline as filingReadiness.ts/workflowPreflight.ts).
 */
export function evaluateDatabaseHealthAlerts(
  snapshot: DatabaseHealthSnapshot,
  now: string,
  thresholds: DatabaseHealthThresholds = DEFAULT_DATABASE_HEALTH_THRESHOLDS
): DatabaseAlertType[] {
  const alerts: DatabaseAlertType[] = [];

  const connectionFailureRate = ratePercent(snapshot.connectionFailures, snapshot.totalConnections);
  if (connectionFailureRate !== null && connectionFailureRate >= thresholds.connectionFailureRatePercent) {
    alerts.push("CONNECTION_FAILURE_RATE_HIGH");
  }

  const slowQueryRate = ratePercent(snapshot.slowQueryCount, snapshot.totalQueries);
  if (slowQueryRate !== null && slowQueryRate >= thresholds.slowQueryRatePercent) {
    alerts.push("SLOW_QUERY_RATE_HIGH");
  }

  if (snapshot.poolUtilizationPercent >= thresholds.poolUtilizationPercent) {
    alerts.push("POOL_UTILIZATION_HIGH");
  }

  const transactionFailureRate = ratePercent(snapshot.transactionFailures, snapshot.totalTransactions);
  if (transactionFailureRate !== null && transactionFailureRate >= thresholds.transactionFailureRatePercent) {
    alerts.push("TRANSACTION_FAILURE_RATE_HIGH");
  }

  if (snapshot.storageUsedPercent >= thresholds.storageUsedPercent) {
    alerts.push("STORAGE_CAPACITY_CRITICAL");
  }

  const backupAgeMs = snapshot.lastSuccessfulBackupAt
    ? new Date(now).getTime() - new Date(snapshot.lastSuccessfulBackupAt).getTime()
    : Infinity;
  if (backupAgeMs > thresholds.maxBackupAgeMs) {
    alerts.push("BACKUP_MISSING_OR_STALE");
  }

  return alerts;
}
