import { describe, it, expect } from "vitest";
import { computeRoiPercent, computeRoiBreakout, buildSourceRoiTable, buildCampaignRoiTable } from "./roiAnalytics";

describe("configurable ROI formula", () => {
  const inputs = { revenueCents: 10_000, netProfitCents: 6_000, costCents: 4_000 };

  it("computes (revenue - cost) / cost when that formula is selected", () => {
    expect(computeRoiPercent(inputs, "REVENUE_MINUS_COST_OVER_COST")).toBe(150);
  });

  it("computes net profit / cost when that formula is selected", () => {
    expect(computeRoiPercent(inputs, "NET_PROFIT_OVER_COST")).toBe(150);
  });

  it("returns null with zero cost", () => {
    expect(computeRoiPercent({ revenueCents: 100, netProfitCents: 100, costCents: 0 }, "NET_PROFIT_OVER_COST")).toBeNull();
  });
});

describe("ROI breakout by dimension", () => {
  it("computes ROI independently per dimension group", () => {
    const rows = computeRoiBreakout(
      [
        { dimension: "SOURCE", key: "referral", roi: { revenueCents: 10_000, netProfitCents: 8_000, costCents: 2_000 } },
        { dimension: "JURISDICTION", key: "CA", roi: { revenueCents: 5_000, netProfitCents: 1_000, costCents: 1_000 } },
      ],
      "NET_PROFIT_OVER_COST"
    );
    expect(rows[0].roiPercent).toBe(400);
    expect(rows[1].roiPercent).toBe(100);
  });
});

describe("per-source ROI table", () => {
  it("computes ROI and cost per lead per source", () => {
    const table = buildSourceRoiTable(
      [{ source: "referral", leadsAcquired: 50, acquisitionCostCents: 5_000, revenueCents: 20_000, netProfitCents: 15_000 }],
      "NET_PROFIT_OVER_COST"
    );
    expect(table[0].roiPercent).toBe(300);
    expect(table[0].costPerLeadCents).toBe(100);
  });
});

describe("per-campaign ROI table", () => {
  it("computes ROI per campaign", () => {
    const table = buildCampaignRoiTable(
      [{ campaign: "spring-mailer", spendCents: 1_000, revenueCents: 5_000, netProfitCents: 3_000 }],
      "NET_PROFIT_OVER_COST"
    );
    expect(table[0].roiPercent).toBe(300);
  });
});
