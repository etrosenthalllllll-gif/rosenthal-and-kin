import { describe, it, expect } from "vitest";
import { computeRecoveryAnalyticsSummary, computeExpectedVsActualRecovery, computeTimeToRecoveryDistribution } from "./recoveryAnalyticsExtended";

describe("recovery analytics summary", () => {
  it("computes average/median recovery and recovery rate", () => {
    const summary = computeRecoveryAnalyticsSummary({
      expectedRecoveries: 200,
      actualRecoveries: 150,
      pendingRecoveries: 50,
      recoveredAmountCents: [100_000, 200_000, 300_000],
    });
    expect(summary.averageRecoveryCents).toBe(200_000);
    expect(summary.medianRecoveryCents).toBe(200_000);
    expect(summary.recoveryRatePercent).toBe(75);
  });

  it("returns null averages with no completed recoveries yet", () => {
    const summary = computeRecoveryAnalyticsSummary({
      expectedRecoveries: 0,
      actualRecoveries: 0,
      pendingRecoveries: 5,
      recoveredAmountCents: [],
    });
    expect(summary.averageRecoveryCents).toBeNull();
    expect(summary.recoveryRatePercent).toBeNull();
  });
});

describe("expected vs. actual recovery", () => {
  it("reuses recoveryVariance.ts's evaluateRecoveryVariance()", () => {
    const result = computeExpectedVsActualRecovery(1_000_000_00, 850_000_00);
    expect(result.differenceCents).toBe(-150_000_00);
    expect(result.level).toBe("MANDATORY_REVIEW");
  });
});

describe("time-to-recovery distribution", () => {
  it("computes average/median/P75/P90/P95 over a batch of per-case days", () => {
    const days = Array.from({ length: 100 }, (_, i) => i + 1);
    const distribution = computeTimeToRecoveryDistribution(days);
    expect(distribution.medianDays).toBe(50.5);
    expect(distribution.p95Days).toBe(95);
  });

  it("returns all-null with no data yet", () => {
    const distribution = computeTimeToRecoveryDistribution([]);
    expect(distribution.averageDays).toBeNull();
    expect(distribution.p90Days).toBeNull();
  });
});
