import { describe, it, expect } from "vitest";
import { evaluateDatabaseHealthAlerts, type DatabaseHealthSnapshot } from "./databaseHealth";

const healthySnapshot: DatabaseHealthSnapshot = {
  connectionFailures: 0,
  totalConnections: 1000,
  slowQueryCount: 1,
  totalQueries: 1000,
  poolUtilizationPercent: 40,
  transactionFailures: 0,
  totalTransactions: 1000,
  storageUsedPercent: 50,
  lastSuccessfulBackupAt: "2026-08-26T00:00:00.000Z",
};

describe("database health alerts", () => {
  it("raises no alerts when everything is within thresholds", () => {
    expect(evaluateDatabaseHealthAlerts(healthySnapshot, "2026-08-26T01:00:00.000Z")).toEqual([]);
  });

  it("collects every abnormal signal, not just the first", () => {
    const alerts = evaluateDatabaseHealthAlerts(
      {
        ...healthySnapshot,
        connectionFailures: 100,
        poolUtilizationPercent: 95,
        storageUsedPercent: 90,
      },
      "2026-08-26T01:00:00.000Z"
    );
    expect(alerts).toEqual(["CONNECTION_FAILURE_RATE_HIGH", "POOL_UTILIZATION_HIGH", "STORAGE_CAPACITY_CRITICAL"]);
  });

  it("flags a missing backup as stale", () => {
    const alerts = evaluateDatabaseHealthAlerts(
      { ...healthySnapshot, lastSuccessfulBackupAt: undefined },
      "2026-08-26T01:00:00.000Z"
    );
    expect(alerts).toContain("BACKUP_MISSING_OR_STALE");
  });

  it("flags a backup older than the configured max age", () => {
    const alerts = evaluateDatabaseHealthAlerts(
      { ...healthySnapshot, lastSuccessfulBackupAt: "2026-08-24T00:00:00.000Z" },
      "2026-08-26T00:00:00.000Z"
    );
    expect(alerts).toContain("BACKUP_MISSING_OR_STALE");
  });
});
