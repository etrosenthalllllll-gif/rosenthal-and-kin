import { describe, it, expect } from "vitest";
import { buildDrillDown, authorizeExport, renderScheduledReport, evaluateDataFreshness } from "./dashboardOperations";

describe("drill-down", () => {
  it("carries the underlying records alongside the aggregate", () => {
    const drillDown = buildDrillDown("recoveries this month", 140, [{ caseId: "RK-1" }, { caseId: "RK-2" }]);
    expect(drillDown.underlyingRecords).toHaveLength(2);
    expect(drillDown.aggregateValue).toBe(140);
  });
});

describe("export authorization", () => {
  it("authorizes an admin to export", () => {
    expect(authorizeExport({ role: "ADMIN", format: "CSV" }).isAuthorized).toBe(true);
  });

  it("denies a read-only role and states why", () => {
    const result = authorizeExport({ role: "READ_ONLY", format: "CSV" });
    expect(result.isAuthorized).toBe(false);
    expect(result.reason).toContain("EXPORT_ANALYTICS_DATA");
  });
});

describe("scheduled reports from the shared metric registry", () => {
  it("resolves every metric from the registry, never a separate formula", () => {
    const registry = new Map([["roi", { metricName: "roi", formula: "net_profit / cost", description: "d", version: 2 }]]);
    const result = renderScheduledReport({ reportName: "weekly-exec", metricNames: ["roi"], cadence: "WEEKLY" }, registry);
    expect(result.metrics[0].formula).toBe("net_profit / cost");
    expect(result.missingMetricNames).toEqual([]);
  });

  it("surfaces a metric name missing from the registry rather than silently dropping it", () => {
    const result = renderScheduledReport({ reportName: "weekly-exec", metricNames: ["unknown_metric"], cadence: "WEEKLY" }, new Map());
    expect(result.missingMetricNames).toEqual(["unknown_metric"]);
  });
});

describe("data freshness", () => {
  it("flags data as delayed when it exceeds the max-fresh window", () => {
    const check = evaluateDataFreshness("2026-08-26T00:00:00.000Z", "2026-08-26T02:00:00.000Z", 60 * 60 * 1000);
    expect(check.isDelayed).toBe(true);
  });

  it("does not flag fresh data", () => {
    const check = evaluateDataFreshness("2026-08-26T00:00:00.000Z", "2026-08-26T00:05:00.000Z", 60 * 60 * 1000);
    expect(check.isDelayed).toBe(false);
  });
});
