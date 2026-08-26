import { describe, it, expect } from "vitest";
import {
  computeLatencyPercentile,
  computeLatencyDistribution,
  evaluateLatencyStatus,
  computeAvailabilityReports,
} from "./apiLatencyMonitoring";

describe("latency percentiles", () => {
  it("computes P50/P95 over a sample set", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(computeLatencyPercentile(samples, 50)).toBe(50);
    expect(computeLatencyPercentile(samples, 95)).toBe(95);
  });

  it("returns null for an empty sample set rather than 0", () => {
    expect(computeLatencyPercentile([], 95)).toBeNull();
  });

  it("computes the full P50/P90/P95/P99 distribution", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    const distribution = computeLatencyDistribution(samples);
    expect(distribution.p50).toBe(50);
    expect(distribution.p99).toBe(99);
  });
});

describe("latency status", () => {
  const thresholds = { p95WarningMs: 300, p95DegradedMs: 500 };

  it("is NORMAL under the degraded threshold", () => {
    expect(evaluateLatencyStatus(200, thresholds)).toBe("NORMAL");
  });

  it("is DEGRADED at or above the degraded threshold", () => {
    expect(evaluateLatencyStatus(500, thresholds)).toBe("DEGRADED");
  });

  it("is NORMAL with no data rather than falsely DEGRADED", () => {
    expect(evaluateLatencyStatus(null, thresholds)).toBe("NORMAL");
  });
});

describe("availability reporting", () => {
  it("computes each window's availability independently", () => {
    const reports = computeAvailabilityReports([
      { windowLabel: "24h", totalChecks: 1000, successfulChecks: 999 },
      { windowLabel: "7d", totalChecks: 0, successfulChecks: 0 },
    ]);
    expect(reports[0].availabilityPercent).toBe(99.9);
    expect(reports[1].availabilityPercent).toBeNull();
  });
});
