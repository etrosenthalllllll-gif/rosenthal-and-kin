import { describe, it, expect } from "vitest";
import { buildFunnelReport, FUNNEL_STAGES, type FunnelStageCounts } from "./leadFunnelAnalytics";

describe("funnel stage list", () => {
  it("matches the doc's own 12-stage funnel in order", () => {
    expect(FUNNEL_STAGES).toEqual([
      "SOURCED",
      "SCORED",
      "QUALIFIED",
      "OUTREACH",
      "DELIVERED",
      "RESPONDED",
      "ENGAGED",
      "VERIFIED",
      "CASE_CREATED",
      "CLAIM_PREPARED",
      "CLAIM_FILED",
      "RECOVERY",
    ]);
  });
});

describe("funnel report", () => {
  const counts: FunnelStageCounts = {
    SOURCED: 100_000,
    SCORED: 80_000,
    QUALIFIED: 40_000,
    OUTREACH: 20_000,
    DELIVERED: 19_000,
    RESPONDED: 2_000,
    ENGAGED: 1_500,
    VERIFIED: 600,
    CASE_CREATED: 300,
    CLAIM_PREPARED: 250,
    CLAIM_FILED: 220,
    RECOVERY: 150,
  };

  it("computes each stage's conversion relative to the immediately-preceding stage", () => {
    const report = buildFunnelReport(counts);
    const qualified = report.find((r) => r.stage === "QUALIFIED")!;
    expect(qualified.conversionRatePercent).toBe(50); // 40,000 / 80,000
    expect(qualified.dropOffRatePercent).toBe(50);
  });

  it("has no conversion/drop-off rate for the first stage (nothing precedes it)", () => {
    const report = buildFunnelReport(counts);
    const sourced = report.find((r) => r.stage === "SOURCED")!;
    expect(sourced.conversionRatePercent).toBeNull();
    expect(sourced.dropOffRatePercent).toBeNull();
  });

  it("passes through the exact counts given, never inventing or estimating", () => {
    const report = buildFunnelReport(counts);
    expect(report.find((r) => r.stage === "RECOVERY")!.count).toBe(150);
  });

  it("attaches average time-to-stage when supplied", () => {
    const report = buildFunnelReport(counts, { QUALIFIED: 3_600_000 });
    expect(report.find((r) => r.stage === "QUALIFIED")!.avgTimeToStageMs).toBe(3_600_000);
    expect(report.find((r) => r.stage === "RESPONDED")!.avgTimeToStageMs).toBeNull();
  });
});
