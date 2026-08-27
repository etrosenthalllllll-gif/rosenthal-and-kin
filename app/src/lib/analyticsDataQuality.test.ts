import { describe, it, expect } from "vitest";
import { runAnalyticsDataQualityChecks, getMetricDefinition, reviseMetricDefinition } from "./analyticsDataQuality";

describe("analytics data-quality checks", () => {
  it("flags multiple issues on one record without collapsing to a boolean", () => {
    const issues = runAnalyticsDataQualityChecks({
      recordId: "rec-1",
      seenEventIds: [],
      durationMs: -5000,
      isPaymentReconciled: false,
      statusInSystemA: "OPEN",
      statusInSystemB: "CLOSED",
    });
    const types = issues.map((i) => i.type);
    expect(types).toContain("MISSING_TIMESTAMP");
    expect(types).toContain("NEGATIVE_DURATION");
    expect(types).toContain("UNRECONCILED_PAYMENT");
    expect(types).toContain("INCONSISTENT_STATUS");
  });

  it("flags a duplicate event", () => {
    const issues = runAnalyticsDataQualityChecks({
      recordId: "rec-2",
      timestamp: "2026-08-26T00:00:00.000Z",
      eventId: "evt-1",
      seenEventIds: ["evt-1"],
    });
    expect(issues.some((i) => i.type === "DUPLICATE_EVENT")).toBe(true);
  });

  it("flags an impossible state transition", () => {
    const issues = runAnalyticsDataQualityChecks({
      recordId: "rec-3",
      timestamp: "2026-08-26T00:00:00.000Z",
      seenEventIds: [],
      fromStatus: "CLOSED",
      toStatus: "OPEN",
      allowedTransitions: new Map([["CLOSED", []]]),
    });
    expect(issues.some((i) => i.type === "IMPOSSIBLE_TRANSITION")).toBe(true);
  });

  it("returns no issues for a clean record", () => {
    const issues = runAnalyticsDataQualityChecks({
      recordId: "rec-4",
      timestamp: "2026-08-26T00:00:00.000Z",
      seenEventIds: [],
    });
    expect(issues).toEqual([]);
  });
});

describe("metric-definition registry", () => {
  it("looks up a metric definition by name", () => {
    const registry = new Map([["conversion_rate", { metricName: "conversion_rate", formula: "converted / leads", description: "d", version: 1 }]]);
    expect(getMetricDefinition(registry, "conversion_rate")?.version).toBe(1);
  });

  it("returns null for an unregistered metric", () => {
    expect(getMetricDefinition(new Map(), "unknown_metric")).toBeNull();
  });
});

describe("versioned metric definitions", () => {
  it("increments the version and never mutates the previous definition", () => {
    const original = { metricName: "roi", formula: "(revenue - cost) / cost", description: "original", version: 1 };
    const revised = reviseMetricDefinition(original, "net_profit / cost", "revised to use net profit");
    expect(revised.version).toBe(2);
    expect(original.version).toBe(1);
    expect(original.formula).toBe("(revenue - cost) / cost");
  });
});
