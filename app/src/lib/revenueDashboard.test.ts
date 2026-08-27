import { describe, it, expect } from "vitest";
import { buildRevenueRecognitionBreakdown, groupRevenueBy } from "./revenueDashboard";

describe("revenue recognition breakdown", () => {
  it("keeps expected/earned/invoiced/collected/outstanding as separate fields", () => {
    const breakdown = buildRevenueRecognitionBreakdown({
      expectedCents: 1_000_000,
      earnedCents: 800_000,
      invoicedCents: 700_000,
      collectedCents: 500_000,
      outstandingCents: 200_000,
    });
    expect(breakdown.expectedCents).toBe(1_000_000);
    expect(breakdown.collectedCents).toBe(500_000);
    // never blended into one number
    expect(Object.keys(breakdown)).toHaveLength(5);
  });
});

describe("revenue grouping by dimension", () => {
  it("sums revenue by source", () => {
    const grouped = groupRevenueBy(
      [
        { amountCents: 1000, source: "Source A" },
        { amountCents: 2000, source: "Source A" },
        { amountCents: 500, source: "Source B" },
      ],
      "source"
    );
    expect(grouped.get("Source A")).toBe(3000);
    expect(grouped.get("Source B")).toBe(500);
  });

  it("sums revenue by month independently of source", () => {
    const grouped = groupRevenueBy(
      [
        { amountCents: 1000, month: "2026-08" },
        { amountCents: 500, month: "2026-09" },
      ],
      "month"
    );
    expect(grouped.get("2026-08")).toBe(1000);
    expect(grouped.get("2026-09")).toBe(500);
  });
});
