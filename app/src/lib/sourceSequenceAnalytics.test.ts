import { describe, it, expect } from "vitest";
import {
  computeSequencePerformance,
  rankSequencesByRoi,
  computeSourcePerformance,
  computeSourceQualityScore,
} from "./sourceSequenceAnalytics";

describe("outreach sequence performance", () => {
  it("computes response rate, profit, and ROI", () => {
    const metrics = computeSequencePerformance({
      contacts: 1000,
      responses: 100,
      positiveResponses: 60,
      conversions: 20,
      cases: 15,
      claims: 10,
      recoveries: 5,
      revenueCents: 100_000,
      costCents: 50_000,
    });
    expect(metrics.responseRatePercent).toBe(10);
    expect(metrics.profitCents).toBe(50_000);
    expect(metrics.roiPercent).toBe(100);
  });
});

describe("sequence ranking", () => {
  it("ranks the higher-ROI sequence first", () => {
    const low = computeSequencePerformance({ contacts: 100, responses: 10, positiveResponses: 5, conversions: 2, cases: 1, claims: 1, recoveries: 0, revenueCents: 1000, costCents: 1000 });
    const high = computeSequencePerformance({ contacts: 100, responses: 10, positiveResponses: 5, conversions: 2, cases: 1, claims: 1, recoveries: 1, revenueCents: 5000, costCents: 1000 });
    const ranked = rankSequencesByRoi([low, high]);
    expect(ranked[0]).toBe(high);
  });
});

describe("lead source performance", () => {
  it("matches the doc's own worked stage rates", () => {
    const metrics = computeSourcePerformance({
      leads: 1000,
      qualifiedLeads: 400,
      cases: 100,
      claimsFiled: 80,
      recoveries: 50,
      revenueCents: 200_000,
      costCents: 50_000,
    });
    expect(metrics.qualificationRatePercent).toBe(40);
    expect(metrics.caseConversionRatePercent).toBe(25);
    expect(metrics.recoveryRatePercent).toBeCloseTo(62.5, 1);
  });
});

describe("source quality score", () => {
  it("matches the doc's own principle: quality beats raw volume", () => {
    const highVolumeLowQuality = computeSourcePerformance({
      leads: 10_000,
      qualifiedLeads: 500,
      cases: 50,
      claimsFiled: 30,
      recoveries: 5,
      revenueCents: 50_000,
      costCents: 40_000,
    });
    const lowVolumeHighQuality = computeSourcePerformance({
      leads: 1_000,
      qualifiedLeads: 700,
      cases: 400,
      claimsFiled: 350,
      recoveries: 300,
      revenueCents: 400_000,
      costCents: 40_000,
    });
    expect(computeSourceQualityScore(lowVolumeHighQuality)).toBeGreaterThan(computeSourceQualityScore(highVolumeLowQuality));
  });
});
