import { describe, it, expect } from "vitest";
import { evaluateStorageAlerts, computeSyncMonitoringMetrics, isDataStale } from "./storageSyncMonitoring";

describe("storage alerts", () => {
  it("raises no alerts when everything is within thresholds", () => {
    expect(evaluateStorageAlerts({ storageUsedPercent: 40, fileProcessingBacklog: 10, failedBackupCount: 0 })).toEqual([]);
  });

  it("collects every abnormal storage signal", () => {
    const alerts = evaluateStorageAlerts({ storageUsedPercent: 90, fileProcessingBacklog: 5000, failedBackupCount: 2 });
    expect(alerts).toEqual(["STORAGE_CAPACITY_WARNING", "FILE_PROCESSING_BACKLOG", "BACKUP_FAILURES"]);
  });
});

describe("synchronization monitoring metrics", () => {
  it("computes the sync success rate", () => {
    const metrics = computeSyncMonitoringMetrics({ syncAttempts: 1000, successfulSyncs: 990, failedSyncs: 10, conflicts: 2, staleRecords: 3 });
    expect(metrics.syncSuccessRatePercent).toBe(99);
  });
});

describe("stale-data detection", () => {
  it("matches the doc's own worked example (30h since sync, expected 6h)", () => {
    expect(isDataStale("2026-08-25T00:00:00.000Z", "2026-08-26T06:00:00.000Z", 6 * 60 * 60 * 1000)).toBe(true);
  });

  it("is not stale within the expected interval", () => {
    expect(isDataStale("2026-08-26T00:00:00.000Z", "2026-08-26T03:00:00.000Z", 6 * 60 * 60 * 1000)).toBe(false);
  });
});
