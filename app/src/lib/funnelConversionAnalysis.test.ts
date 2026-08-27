import { describe, it, expect } from "vitest";
import { computeNamedFunnelConversionRates, findLargestFunnelDropOff, buildFunnelDropOffReport } from "./funnelConversionAnalysis";
import { buildFunnelReport, type FunnelStageCounts } from "./leadFunnelAnalytics";

const counts: FunnelStageCounts = {
  SOURCED: 100_000,
  SCORED: 50_000,
  QUALIFIED: 40_000,
  OUTREACH: 20_000,
  DELIVERED: 19_000,
  RESPONDED: 3_000,
  ENGAGED: 1_500,
  VERIFIED: 1_000,
  CASE_CREATED: 700,
  CLAIM_PREPARED: 600,
  CLAIM_FILED: 400,
  RECOVERY: 350,
};

describe("named funnel conversion rates", () => {
  it("computes the doc's own named rates against their exact stage pairs", () => {
    const rates = computeNamedFunnelConversionRates(counts);
    expect(rates.qualificationRatePercent).toBe(80); // 40,000 / 50,000
    expect(rates.overallLeadToRecoveryRatePercent).toBe(0.4); // 350 / 100,000
  });
});

describe("largest drop-off identification", () => {
  it("matches the doc's own worked example: qualified -> response is the biggest loss", () => {
    const report = buildFunnelReport(counts);
    const largest = findLargestFunnelDropOff(report);
    // DELIVERED -> RESPONDED: 19,000 -> 3,000 is by far the largest single-stage loss here.
    expect(largest?.fromStage).toBe("DELIVERED");
    expect(largest?.toStage).toBe("RESPONDED");
  });

  it("returns null when no transition has a computable rate", () => {
    const zeroCounts: FunnelStageCounts = { ...counts, SOURCED: 0 };
    const report = buildFunnelReport({ ...zeroCounts, SCORED: 0, QUALIFIED: 0, OUTREACH: 0, DELIVERED: 0, RESPONDED: 0, ENGAGED: 0, VERIFIED: 0, CASE_CREATED: 0, CLAIM_PREPARED: 0, CLAIM_FILED: 0, RECOVERY: 0 });
    expect(findLargestFunnelDropOff(report)).toBeNull();
  });
});

describe("combined drop-off report", () => {
  it("assembles the full report plus the largest drop-off in one call", () => {
    const result = buildFunnelDropOffReport(counts);
    expect(result.report).toHaveLength(12);
    expect(result.largestDropOff?.fromStage).toBe("DELIVERED");
  });
});
