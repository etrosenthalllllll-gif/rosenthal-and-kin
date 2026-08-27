import { describe, it, expect } from "vitest";
import {
  rankSourceComparison,
  buildCaseProfitabilityView,
  classifyEconomicStatus,
  evaluateNegativeEconomicsFlag,
} from "./caseEconomicStatus";

describe("ranked source comparison", () => {
  it("ranks sources by ROI descending", () => {
    const ranked = rankSourceComparison([
      { source: "referral", conversionRatePercent: 20, recoveryRatePercent: 10, roiPercent: 150, costPerLeadCents: 500 },
      { source: "cold-mail", conversionRatePercent: 5, recoveryRatePercent: 2, roiPercent: 400, costPerLeadCents: 100 },
      { source: "unknown", conversionRatePercent: null, recoveryRatePercent: null, roiPercent: null, costPerLeadCents: null },
    ]);
    expect(ranked[0].source).toBe("cold-mail");
    expect(ranked[1].source).toBe("referral");
    expect(ranked[2].source).toBe("unknown");
    expect(ranked[2].rank).toBe(3);
  });
});

describe("case profitability view", () => {
  it("computes profit and margin for a case", () => {
    const view = buildCaseProfitabilityView("RK-1", 10_000, 4_000);
    expect(view.profitCents).toBe(6_000);
    expect(view.marginPercent).toBe(60);
  });
});

describe("economic status classification", () => {
  it("classifies against the default thresholds", () => {
    expect(classifyEconomicStatus(60)).toBe("HIGHLY_PROFITABLE");
    expect(classifyEconomicStatus(30)).toBe("PROFITABLE");
    expect(classifyEconomicStatus(10)).toBe("MARGINAL");
    expect(classifyEconomicStatus(0)).toBe("BREAK_EVEN");
    expect(classifyEconomicStatus(-10)).toBe("NEGATIVE");
  });

  it("respects a custom threshold table", () => {
    expect(classifyEconomicStatus(15, { highlyProfitableMarginPercent: 80, profitableMarginPercent: 10, marginalMarginPercent: 0 })).toBe("PROFITABLE");
  });

  it("treats a null margin as NEGATIVE rather than guessing", () => {
    expect(classifyEconomicStatus(null)).toBe("NEGATIVE");
  });
});

describe("negative-economics flag", () => {
  it("flags a case with negative expected profit and requires human review, never auto-terminates", () => {
    const flag = evaluateNegativeEconomicsFlag("RK-2", -500);
    expect(flag.flagged).toBe(true);
    expect(flag.requiresHumanReview).toBe(true);
  });

  it("does not flag a case with non-negative expected profit", () => {
    const flag = evaluateNegativeEconomicsFlag("RK-3", 500);
    expect(flag.flagged).toBe(false);
    expect(flag.requiresHumanReview).toBe(false);
  });
});
