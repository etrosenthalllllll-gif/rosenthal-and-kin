import { describe, it, expect } from "vitest";
import {
  computeInterventionRateByStage,
  computeAutomationRateReport,
  computeInterventionReasonBreakdown,
  isAutomationImproving,
} from "./automationRateAnalytics";

describe("intervention rate by stage", () => {
  it("computes a rate per pipeline stage independently", () => {
    const rates = computeInterventionRateByStage([
      { stage: "LEAD", totalCases: 1000, interventionCases: 100 },
      { stage: "FILING", totalCases: 500, interventionCases: 250 },
      { stage: "RECOVERY", totalCases: 0, interventionCases: 0 },
    ]);
    expect(rates[0].interventionRatePercent).toBe(10);
    expect(rates[1].interventionRatePercent).toBe(50);
    expect(rates[2].interventionRatePercent).toBeNull();
  });
});

describe("automation rate report", () => {
  it("matches doc 13 section 38's own worked example", () => {
    const report = computeAutomationRateReport({
      FULLY_AUTOMATED: 8000,
      AI_ASSISTED: 1200,
      HUMAN_APPROVED: 500,
      HUMAN_REVIEWED: 200,
      MANUAL: 80,
      EXCEPTION: 20,
    });
    expect(report.totalCases).toBe(10_000);
    expect(report.fullyAutomatedRatePercent).toBe(80);
  });
});

describe("intervention reason breakdown", () => {
  it("sorts reasons by count descending and computes share", () => {
    const breakdown = computeInterventionReasonBreakdown({
      LOW_AI_CONFIDENCE: 40,
      MISSING_DOCUMENT: 60,
      SYSTEM_FAILURE: 10,
    });
    expect(breakdown[0].reason).toBe("MISSING_DOCUMENT");
    expect(breakdown[0].sharePercent).toBe(54.5);
    expect(breakdown[2].reason).toBe("SYSTEM_FAILURE");
  });
});

describe("automation improvement over time", () => {
  it("matches doc 13 section 40's own worked example: 32% -> 25% -> 18% is improving", () => {
    expect(
      isAutomationImproving([
        { month: "January", interventionRatePercent: 32 },
        { month: "February", interventionRatePercent: 25 },
        { month: "March", interventionRatePercent: 18 },
      ])
    ).toBe(true);
  });

  it("is not improving when the rate ticks back up", () => {
    expect(
      isAutomationImproving([
        { month: "January", interventionRatePercent: 18 },
        { month: "February", interventionRatePercent: 25 },
      ])
    ).toBe(false);
  });

  it("returns null with fewer than two periods -- nothing to compare", () => {
    expect(isAutomationImproving([{ month: "January", interventionRatePercent: 32 }])).toBeNull();
  });
});
