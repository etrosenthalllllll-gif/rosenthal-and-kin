import { describe, it, expect } from "vitest";
import { buildTrendSeries, detectKpiAnomaly, buildKpiAlert } from "./trendAnomalyAnalytics";

describe("trend series", () => {
  it("keeps a series per KPI per granularity", () => {
    const series = buildTrendSeries("recovery_rate", "WEEKLY", [
      { period: "2026-W30", value: 12 },
      { period: "2026-W31", value: 14 },
    ]);
    expect(series.kpiName).toBe("recovery_rate");
    expect(series.points).toHaveLength(2);
  });
});

describe("KPI anomaly detection", () => {
  it("flags a fixed-threshold breach", () => {
    const result = detectKpiAnomaly({ currentValue: 150, recentHistory: [], fixedThreshold: { max: 100 } });
    expect(result.isAnomaly).toBe(true);
    expect(result.method).toBe("FIXED_THRESHOLD");
  });

  it("flags a statistical outlier relative to recent history", () => {
    const result = detectKpiAnomaly({ currentValue: 500, recentHistory: [10, 12, 11, 9, 10], stdDevThreshold: 3 });
    expect(result.isAnomaly).toBe(true);
    expect(result.method).toBe("STATISTICAL_OUTLIER");
  });

  it("does not flag a value within normal range", () => {
    const result = detectKpiAnomaly({ currentValue: 11, recentHistory: [10, 12, 11, 9, 10] });
    expect(result.isAnomaly).toBe(false);
  });

  it("skips statistical detection with fewer than two historical points", () => {
    const result = detectKpiAnomaly({ currentValue: 500, recentHistory: [10] });
    expect(result.isAnomaly).toBe(false);
  });
});

describe("KPI alert integration", () => {
  it("routes an anomaly through the shared alert engine", () => {
    const anomaly = detectKpiAnomaly({ currentValue: 150, recentHistory: [], fixedThreshold: { max: 100 } });
    const alert = buildKpiAlert({ kpiName: "recovery_rate", anomaly, severity: "WARNING", currentValue: 150, now: "2026-08-26T00:00:00.000Z" });
    expect(alert?.source).toBe("KPI_THRESHOLD");
    expect(alert?.type).toBe("KPI_ANOMALY");
    expect(alert?.status).toBe("OPEN");
  });

  it("returns null when there's no anomaly", () => {
    const anomaly = detectKpiAnomaly({ currentValue: 11, recentHistory: [10, 12, 11, 9, 10] });
    const alert = buildKpiAlert({ kpiName: "recovery_rate", anomaly, severity: "WARNING", currentValue: 11, now: "2026-08-26T00:00:00.000Z" });
    expect(alert).toBeNull();
  });
});
