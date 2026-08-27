import { describe, it, expect } from "vitest";
import { computeHoursSaved, computeAutomationValue } from "./automationValueAnalytics";

describe("operator hours saved", () => {
  it("computes hours saved per case and in total, labeled as measured", () => {
    const report = computeHoursSaved({
      baselineManualHoursPerCase: 3,
      actualOperatorHoursPerCase: 0.5,
      casesProcessed: 200,
      baselineIsMeasured: true,
    });
    expect(report.hoursSavedPerCase).toBe(2.5);
    expect(report.totalHoursSaved).toBe(500);
    expect(report.isModeledEstimate).toBe(false);
  });

  it("flags the result as a modeled estimate when the baseline was not measured", () => {
    const report = computeHoursSaved({
      baselineManualHoursPerCase: 3,
      actualOperatorHoursPerCase: 0.5,
      casesProcessed: 200,
      baselineIsMeasured: false,
    });
    expect(report.isModeledEstimate).toBe(true);
  });
});

describe("automation value model", () => {
  it("sums the components into a net value and carries assumptions through", () => {
    const report = computeAutomationValue(
      {
        laborCostAvoidedCents: 500_000,
        throughputGainValueCents: 200_000,
        additionalCasesValueCents: 100_000,
        automationCostCents: 150_000,
      },
      [{ label: "manual hours baseline", value: "3 hours/case, measured Q1 2026" }]
    );
    expect(report.netValueCents).toBe(650_000);
    expect(report.assumptions).toHaveLength(1);
  });

  it("defaults assumptions to an empty list rather than requiring the caller to pass one", () => {
    const report = computeAutomationValue({
      laborCostAvoidedCents: 100,
      throughputGainValueCents: 0,
      additionalCasesValueCents: 0,
      automationCostCents: 0,
    });
    expect(report.assumptions).toEqual([]);
  });
});
