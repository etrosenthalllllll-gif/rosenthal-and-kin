import { describe, it, expect } from "vitest";
import { buildAttributionChain, assignCostToObject, allocateSharedCost } from "./attributionAnalytics";

describe("attribution chain", () => {
  it("builds a clean chain with a known originating source", () => {
    const chain = buildAttributionChain({ leadId: "lead-1", caseId: "case-1", originatingSource: "referral" });
    expect(chain.isAttributionUncertain).toBe(false);
  });

  it("flags the chain uncertain rather than inventing a source", () => {
    const chain = buildAttributionChain({ leadId: "lead-2", originatingSource: null });
    expect(chain.isAttributionUncertain).toBe(true);
  });

  it("flags the chain uncertain when an explicit uncertainty reason is given, even with a source", () => {
    const chain = buildAttributionChain({ leadId: "lead-3", originatingSource: "referral", uncertaintyReason: "lead was merged from two records" });
    expect(chain.isAttributionUncertain).toBe(true);
  });
});

describe("cost-to-object assignment", () => {
  it("assigns a cost to a specific object", () => {
    const assignment = assignCostToObject(500, "CASE", "RK-1842");
    expect(assignment.objectType).toBe("CASE");
    expect(assignment.objectId).toBe("RK-1842");
  });
});

describe("shared-cost allocation", () => {
  const targets = [
    { objectId: "a", weight: 3 },
    { objectId: "b", weight: 1 },
  ];

  it("splits equally regardless of weight when EQUAL_SPLIT is selected", () => {
    const rows = allocateSharedCost(1000, targets, "EQUAL_SPLIT");
    expect(rows[0].allocatedCostCents).toBe(500);
    expect(rows[1].allocatedCostCents).toBe(500);
  });

  it("allocates proportionally to weight for BY_USAGE", () => {
    const rows = allocateSharedCost(1000, targets, "BY_USAGE");
    expect(rows[0].allocatedCostCents).toBe(750);
    expect(rows[1].allocatedCostCents).toBe(250);
  });

  it("allocates zero to every target when EXCLUDED", () => {
    const rows = allocateSharedCost(1000, targets, "EXCLUDED");
    expect(rows.every((r) => r.allocatedCostCents === 0)).toBe(true);
  });

  it("returns zero allocation rather than dividing by zero when total weight is zero", () => {
    const rows = allocateSharedCost(1000, [{ objectId: "a", weight: 0 }], "BY_REVENUE");
    expect(rows[0].allocatedCostCents).toBe(0);
  });
});
