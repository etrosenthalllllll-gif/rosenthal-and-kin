import { describe, it, expect } from "vitest";
import { computeCapacityReport, computeRevenuePerOperatorHour, computePerCaseFinancialStats } from "./throughputCapacityAnalytics";

describe("capacity report", () => {
  it("identifies the bottleneck stage as the one with highest utilization", () => {
    const report = computeCapacityReport([
      { stage: "LEAD", maxUnitsPerPeriod: 1000, currentUnitsPerPeriod: 400 },
      { stage: "FILING", maxUnitsPerPeriod: 200, currentUnitsPerPeriod: 190 },
      { stage: "RECOVERY", maxUnitsPerPeriod: 500, currentUnitsPerPeriod: 100 },
    ]);
    expect(report.bottleneckStage).toBe("FILING");
    expect(report.systemCapacityUnitsPerPeriod).toBe(200);
  });

  it("returns an empty report with no stages", () => {
    const report = computeCapacityReport([]);
    expect(report.bottleneckStage).toBeNull();
    expect(report.systemCapacityUnitsPerPeriod).toBeNull();
  });
});

describe("revenue per operator hour", () => {
  it("computes revenue and gross profit per operator hour", () => {
    const result = computeRevenuePerOperatorHour({ revenueCents: 100_000, grossProfitCents: 60_000, operatorHours: 40 });
    expect(result.revenuePerOperatorHourCents).toBe(2_500);
    expect(result.grossProfitPerOperatorHourCents).toBe(1_500);
  });

  it("returns null with zero operator hours", () => {
    const result = computeRevenuePerOperatorHour({ revenueCents: 100, grossProfitCents: 50, operatorHours: 0 });
    expect(result.revenuePerOperatorHourCents).toBeNull();
  });
});

describe("per-case financial stats", () => {
  it("computes both average and median, which diverge when skewed by a large case", () => {
    const stats = computePerCaseFinancialStats([
      { revenueCents: 100, costCents: 20, profitCents: 80 },
      { revenueCents: 200, costCents: 30, profitCents: 170 },
      { revenueCents: 10_000, costCents: 40, profitCents: 9_960 },
    ]);
    expect(stats.averageRevenueCents).toBeCloseTo(3433.33, 1);
    expect(stats.medianRevenueCents).toBe(200);
  });

  it("returns null stats with no cases", () => {
    const stats = computePerCaseFinancialStats([]);
    expect(stats.averageRevenueCents).toBeNull();
    expect(stats.medianRevenueCents).toBeNull();
  });
});
