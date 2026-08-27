import { describe, it, expect } from "vitest";
import { computeContributionMargin, computeProfitRollup } from "./profitAnalytics";

describe("contribution margin", () => {
  it("computes margin in cents and as a percentage of revenue", () => {
    const result = computeContributionMargin({ revenueCents: 10_000, variableCostsCents: 4_000 });
    expect(result.contributionMarginCents).toBe(6_000);
    expect(result.contributionMarginPercent).toBe(60);
  });

  it("returns a null percentage with zero revenue", () => {
    const result = computeContributionMargin({ revenueCents: 0, variableCostsCents: 0 });
    expect(result.contributionMarginPercent).toBeNull();
  });
});

describe("profit rollup", () => {
  it("computes gross profit, net contribution, and net profit with explicit cost labels", () => {
    const rollup = computeProfitRollup({
      revenueCents: 10_000,
      directVariableCostsCents: 3_000,
      allocatedFixedCostsCents: 2_000,
      overheadCents: 1_000,
    });
    expect(rollup.grossProfitCents).toBe(7_000);
    expect(rollup.netContributionCents).toBe(5_000);
    expect(rollup.netProfitCents).toBe(4_000);
    expect(rollup.costsSubtracted.netProfit).toContain("overhead");
  });
});
