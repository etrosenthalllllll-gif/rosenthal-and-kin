import { describe, it, expect } from "vitest";
import { buildFunnelDashboard, buildAnalyticsFinancialDashboard, buildAutomationDashboard } from "./analyticsDashboardAssembly";
import { buildFunnelReport } from "./leadFunnelAnalytics";
import { computeContributionMargin, computeProfitRollup } from "./profitAnalytics";
import { computeAutomationRateReport, computeInterventionReasonBreakdown } from "./automationRateAnalytics";
import { computeHoursSaved, computeAutomationValue } from "./automationValueAnalytics";

describe("funnel dashboard assembly", () => {
  it("assembles the funnel report and largest drop-off with no new logic", () => {
    const funnelReport = buildFunnelReport({
      SOURCED: 1000,
      SCORED: 900,
      QUALIFIED: 800,
      OUTREACH: 700,
      DELIVERED: 650,
      RESPONDED: 400,
      ENGAGED: 350,
      VERIFIED: 300,
      CASE_CREATED: 250,
      CLAIM_PREPARED: 200,
      CLAIM_FILED: 190,
      RECOVERY: 140,
    });
    const view = buildFunnelDashboard({ funnelReport, largestDropOff: null });
    expect(view.funnelReport).toBe(funnelReport);
  });
});

describe("analytics financial dashboard assembly", () => {
  it("assembles revenue/cost/margin/profit/roi into one view", () => {
    const margin = computeContributionMargin({ revenueCents: 10_000, variableCostsCents: 4_000 });
    const rollup = computeProfitRollup({ revenueCents: 10_000, directVariableCostsCents: 4_000, allocatedFixedCostsCents: 1_000, overheadCents: 500 });
    const view = buildAnalyticsFinancialDashboard({ revenueCents: 10_000, costCents: 5_500, contributionMargin: margin, profitRollup: rollup, roiBreakout: [] });
    expect(view.contributionMargin.contributionMarginCents).toBe(6_000);
    expect(view.profitRollup.netProfitCents).toBe(4_500);
  });
});

describe("automation dashboard assembly", () => {
  it("assembles automation rate, intervention reasons, hours saved, and value", () => {
    const automationRate = computeAutomationRateReport({
      FULLY_AUTOMATED: 8000,
      AI_ASSISTED: 1200,
      HUMAN_APPROVED: 500,
      HUMAN_REVIEWED: 200,
      MANUAL: 80,
      EXCEPTION: 20,
    });
    const reasons = computeInterventionReasonBreakdown({ LOW_AI_CONFIDENCE: 10 });
    const hoursSaved = computeHoursSaved({ baselineManualHoursPerCase: 3, actualOperatorHoursPerCase: 0.5, casesProcessed: 100, baselineIsMeasured: true });
    const value = computeAutomationValue({ laborCostAvoidedCents: 1000, throughputGainValueCents: 0, additionalCasesValueCents: 0, automationCostCents: 100 });
    const view = buildAutomationDashboard({ automationRate, interventionReasons: reasons, hoursSaved, automationValue: value });
    expect(view.automationRate.fullyAutomatedRatePercent).toBe(80);
    expect(view.hoursSaved.totalHoursSaved).toBe(250);
  });
});
