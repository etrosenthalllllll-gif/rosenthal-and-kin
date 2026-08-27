import { describe, it, expect } from "vitest";
import { buildMetricWithTrend, buildCentralAnalyticsDashboard, type CentralAnalyticsCounts } from "./centralAnalyticsDashboard";

describe("metric-with-trend construction", () => {
  it("shows UP when current exceeds previous", () => {
    const metric = buildMetricWithTrend(120, 100);
    expect(metric.trend).toBe("UP");
    expect(metric.percentChange).toBe(20);
  });

  it("shows UP even from a zero baseline, despite percentChange being null", () => {
    const metric = buildMetricWithTrend(5, 0);
    expect(metric.trend).toBe("UP");
    expect(metric.percentChange).toBeNull();
  });

  it("shows FLAT when current equals previous", () => {
    expect(buildMetricWithTrend(50, 50).trend).toBe("FLAT");
  });

  it("shows DOWN when current is below previous", () => {
    expect(buildMetricWithTrend(80, 100).trend).toBe("DOWN");
  });
});

const counts: CentralAnalyticsCounts = {
  leads: 25_400,
  qualifiedLeads: 10_000,
  responses: 2_000,
  activeCases: 1_240,
  claimsFiled: 840,
  recoveries: 520,
  grossRevenueCents: 500_000_00,
  totalCostCents: 100_000_00,
  netRevenueCents: 400_000_00,
  costPerCaseCents: 8_000_00,
  operatorHours: 400,
  humanInterventionRatePercent: 8.4,
  avgTimeToRecoveryDays: 90,
  roiPercent: 300,
};

describe("central analytics dashboard assembly", () => {
  it("assembles the doc's own 14-metric top-level dashboard", () => {
    const dashboard = buildCentralAnalyticsDashboard(counts, { ...counts, leads: 20_000 });
    expect(dashboard.leads.current).toBe(25_400);
    expect(dashboard.leads.trend).toBe("UP");
    expect(dashboard.recoveries.trend).toBe("FLAT");
  });
});
