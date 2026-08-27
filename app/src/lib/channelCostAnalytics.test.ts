import { describe, it, expect } from "vitest";
import {
  groupAiSpendBy,
  computeRevenueGeneratedPerAiCent,
  computeTotalCommunicationCost,
  computeCommunicationCostPerContact,
  computeTotalFilingCost,
  computeCostPerFiling,
  computeCostPerSuccessfulFiling,
} from "./channelCostAnalytics";

describe("AI spend grouping", () => {
  it("sums AI spend by model", () => {
    const grouped = groupAiSpendBy(
      [
        { amountCents: 100, model: "claude-sonnet-5" },
        { amountCents: 50, model: "claude-sonnet-5" },
        { amountCents: 20, model: "claude-haiku" },
      ],
      "model"
    );
    expect(grouped.get("claude-sonnet-5")).toBe(150);
  });
});

describe("revenue per AI dollar", () => {
  it("computes revenue generated per AI cent spent", () => {
    expect(computeRevenueGeneratedPerAiCent(10_000, 100)).toBe(100);
  });

  it("returns null with zero AI spend", () => {
    expect(computeRevenueGeneratedPerAiCent(10_000, 0)).toBeNull();
  });
});

describe("communication cost analytics", () => {
  it("sums the four channel costs", () => {
    const total = computeTotalCommunicationCost({ emailCostCents: 100, smsCostCents: 50, voiceCostCents: 200, postageCostCents: 300 });
    expect(total).toBe(650);
  });

  it("computes cost per contact via the shared per-unit function", () => {
    expect(computeCommunicationCostPerContact(1000, 100)).toBe(10);
  });
});

describe("filing cost analytics", () => {
  it("sums the filing cost breakdown", () => {
    const total = computeTotalFilingCost({ filingFeesCents: 500, providerCostsCents: 100, resubmissionCostsCents: 50, paymentProcessingCents: 25 });
    expect(total).toBe(675);
  });

  it("computes cost per filing and cost per successful filing", () => {
    expect(computeCostPerFiling(1000, 10)).toBe(100);
    expect(computeCostPerSuccessfulFiling(1000, 8)).toBe(125);
  });
});
