import { describe, it, expect } from "vitest";
import { buildExecutiveSummaryView, buildOperationalView } from "./executiveDashboard";

describe("executive summary view", () => {
  it("assembles counts, metrics, trend, and top problems into one view", () => {
    const view = buildExecutiveSummaryView({
      counts: { leads: 1000, cases: 400, claims: 200, recoveries: 80, revenueCents: 500_000, costCents: 150_000 },
      metrics: { netContributionCents: 300_000, costPerCaseCents: 375, humanInterventionRatePercent: 22, avgTimeToRecoveryDays: 45, roiPercent: 233 },
      trend: [{ period: "2026-07", value: 70 }, { period: "2026-08", value: 80 }],
      topProblems: [{ description: "Filing rejections up 15% this month", severity: "WARNING" }],
    });
    expect(view.counts.leads).toBe(1000);
    expect(view.metrics.roiPercent).toBe(233);
    expect(view.topProblems).toHaveLength(1);
  });
});

describe("operational (today-focused) view", () => {
  it("assembles a separate view distinct from the executive summary", () => {
    const view = buildOperationalView({
      today: { leadsToday: 12, casesAdvancedToday: 8, claimsFiledToday: 3, recoveriesClosedToday: 1 },
      attentionNeeded: [{ caseId: "RK-1842", reason: "stuck in filing" }],
      operatorQueueDepth: 5,
    });
    expect(view.today.leadsToday).toBe(12);
    expect(view.attentionNeeded).toHaveLength(1);
    expect(view.operatorQueueDepth).toBe(5);
  });
});
