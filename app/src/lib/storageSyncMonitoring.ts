// DB/storage monitoring + synchronization monitoring + stale-data
// detection -- doc 12 sections 39-41. PLAN.md P11-14.
//
// "Monitor: storage utilization, file-processing backlog, database
// size, connection usage, backup health, failed backups, storage
// errors. Alert before capacity becomes critical." / "Monitor
// synchronization between case/communication/document/verification/
// claim/filing/payment systems. Track: sync attempts, successful
// syncs, failed syncs, conflicts, stale records, last synchronization
// time." / "Detect data that hasn't synchronized within an expected
// interval... STALE_EXTERNAL_STATUS."

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// --- Storage monitoring (doc 12 §39) ----------------------------------------

export interface StorageMonitoringSnapshot {
  storageUsedPercent: number;
  fileProcessingBacklog: number;
  failedBackupCount: number;
}

export type StorageAlertType = "STORAGE_CAPACITY_WARNING" | "FILE_PROCESSING_BACKLOG" | "BACKUP_FAILURES";

/**
 * Pure: "alert before capacity becomes critical" -- checked against a
 * configurable warning threshold (deliberately lower than
 * databaseHealth.ts's own critical threshold, since this is the
 * earlier warning stage).
 */
export function evaluateStorageAlerts(
  snapshot: StorageMonitoringSnapshot,
  thresholds: { storageWarningPercent: number; backlogWarningCount: number } = {
    storageWarningPercent: 70,
    backlogWarningCount: 1000,
  }
): StorageAlertType[] {
  const alerts: StorageAlertType[] = [];
  if (snapshot.storageUsedPercent >= thresholds.storageWarningPercent) alerts.push("STORAGE_CAPACITY_WARNING");
  if (snapshot.fileProcessingBacklog >= thresholds.backlogWarningCount) alerts.push("FILE_PROCESSING_BACKLOG");
  if (snapshot.failedBackupCount > 0) alerts.push("BACKUP_FAILURES");
  return alerts;
}

// --- Synchronization monitoring (doc 12 §40) --------------------------------

export interface SyncMonitoringCounts {
  syncAttempts: number;
  successfulSyncs: number;
  failedSyncs: number;
  conflicts: number;
  staleRecords: number;
}

export interface SyncMonitoringMetrics extends SyncMonitoringCounts {
  syncSuccessRatePercent: number | null;
}

export function computeSyncMonitoringMetrics(counts: SyncMonitoringCounts): SyncMonitoringMetrics {
  return { ...counts, syncSuccessRatePercent: ratePercent(counts.successfulSyncs, counts.syncAttempts) };
}

// --- Stale-data detection (doc 12 §41) --------------------------------------

/**
 * Pure: doc 12 §41's own worked example (provider status last synced
 * 30 hours ago, expected within 6 hours -> STALE_EXTERNAL_STATUS).
 */
export function isDataStale(lastSynchronizedAt: string, now: string, expectedIntervalMs: number): boolean {
  return new Date(now).getTime() - new Date(lastSynchronizedAt).getTime() > expectedIntervalMs;
}
