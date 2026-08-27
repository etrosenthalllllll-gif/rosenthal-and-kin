import { describe, it, expect } from "vitest";
import { computeClaimConversionRates, computeSegmentPerformance } from "./claimConversionAnalytics";

describe("claim conversion rates", () => {
  it("matches the doc's own 6-step conversion chain", () => {
    const rates = computeClaimConversionRates({
      leads: 1000,
      cases: 300,
      verified: 250,
      claimsPrepared: 220,
      claimsFiled: 200,
      claimsApproved: 150,
      recoveries: 140,
    });
    expect(rates.leadToCaseRatePercent).toBe(30);
    expect(rates.filedToApprovedRatePercent).toBe(75);
    expect(rates.approvedToRecoveryRatePercent).toBeCloseTo(93.3, 1);
  });
});

describe("segment (jurisdiction/case-type) performance", () => {
  it("computes filing-success/recovery rates, average recovery, and ROI for one segment", () => {
    const metrics = computeSegmentPerformance({
      cases: 100,
      claims: 90,
      filingSuccesses: 80,
      rejections: 10,
      resubmissions: 5,
      avgProcessingTimeMs: 86_400_000,
      recoveries: 60,
      totalRecoveredCents: 6_000_000,
      revenueCents: 600_000,
      costCents: 100_000,
    });
    expect(metrics.filingSuccessRatePercent).toBeCloseTo(88.9, 1);
    expect(metrics.recoveryRatePercent).toBeCloseTo(66.7, 1);
    expect(metrics.avgRecoveryCents).toBe(100_000);
    expect(metrics.roiPercent).toBe(500);
  });

  it("never divides recovery total by zero recoveries", () => {
    const metrics = computeSegmentPerformance({
      cases: 10,
      claims: 5,
      filingSuccesses: 0,
      rejections: 5,
      resubmissions: 0,
      avgProcessingTimeMs: null,
      recoveries: 0,
      totalRecoveredCents: 0,
      revenueCents: 0,
      costCents: 1000,
    });
    expect(metrics.avgRecoveryCents).toBeNull();
  });
});
