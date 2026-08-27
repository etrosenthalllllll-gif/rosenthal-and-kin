import { describe, it, expect } from "vitest";
import { computeTotalCaseCost, computeCaseEconomics, computeCostPerUnit, classifyCostNature, splitFixedVariableCosts } from "./caseEconomics";

const breakdown = {
  acquisitionCents: 1000,
  researchCents: 500,
  aiCents: 200,
  communicationCents: 300,
  documentCents: 100,
  filingCents: 400,
  paymentProcessingCents: 50,
  operatorLaborCents: 2000,
  otherCents: 0,
};

describe("case cost total", () => {
  it("sums every cost category", () => {
    expect(computeTotalCaseCost(breakdown)).toBe(4550);
  });
});

describe("case economics", () => {
  it("computes total cost, gross profit, and ROI", () => {
    const economics = computeCaseEconomics(breakdown, 10_000);
    expect(economics.totalCostCents).toBe(4550);
    expect(economics.grossProfitCents).toBe(5450);
    expect(economics.roiPercent).toBeCloseTo(119.8, 1);
  });
});

describe("cost per unit", () => {
  it("generalizes cost-per-X to any unit count", () => {
    expect(computeCostPerUnit(10_000, 20)).toBe(500);
  });

  it("returns null rather than dividing by zero units", () => {
    expect(computeCostPerUnit(10_000, 0)).toBeNull();
  });
});

describe("cost nature classification", () => {
  it("classifies AI spend as variable and software as fixed", () => {
    expect(classifyCostNature("AI")).toBe("VARIABLE");
    expect(classifyCostNature("SOFTWARE")).toBe("FIXED");
  });
});

describe("fixed/variable split", () => {
  it("separates fixed and variable cost totals", () => {
    const split = splitFixedVariableCosts([
      { category: "SOFTWARE", amountCents: 500 },
      { category: "INFRASTRUCTURE", amountCents: 300 },
      { category: "AI", amountCents: 200 },
    ]);
    expect(split.fixedCents).toBe(800);
    expect(split.variableCents).toBe(200);
  });
});
