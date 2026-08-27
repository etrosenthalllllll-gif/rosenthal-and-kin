import { describe, it, expect } from "vitest";
import { buildFinalExecutiveView, FINAL_EXECUTIVE_VIEW_QUESTIONS } from "./finalExecutiveView";

describe("final executive view assembly", () => {
  it("answers all 13 of doc 13's questions, in order", () => {
    const view = buildFinalExecutiveView({
      leadsEntering: 500,
      conversionRatePercent: 12.4,
      totalRecoveredCents: 1_200_000,
      totalRevenueCents: 120_000,
      costPerCaseCents: 8_000,
      totalOperatorHours: 340,
      humanInterventionRatePercent: 22.5,
      avgTimeToRecoveryDays: 96,
      bestSourceId: "source-referral",
      bestSourceRoiPercent: 340,
      bestWorkflowId: "workflow-standard-probate",
      bestWorkflowRoiPercent: 210,
      isScaling: true,
      isAutomationImproving: true,
      roiPercent: 250,
    });

    expect(view.answers).toHaveLength(13);
    expect(view.answers.map((a) => a.question)).toEqual([...FINAL_EXECUTIVE_VIEW_QUESTIONS]);
    expect(view.answers[0].value).toBe(500);
    expect(view.answers[8].value).toEqual({ sourceId: "source-referral", roiPercent: 340 });
    expect(view.answers[12].value).toBe(250);
  });

  it("surfaces an unanswerable question as null rather than dropping it", () => {
    const view = buildFinalExecutiveView({
      leadsEntering: 0,
      conversionRatePercent: null,
      totalRecoveredCents: 0,
      totalRevenueCents: 0,
      costPerCaseCents: null,
      totalOperatorHours: 0,
      humanInterventionRatePercent: null,
      avgTimeToRecoveryDays: null,
      bestSourceId: null,
      bestSourceRoiPercent: null,
      bestWorkflowId: null,
      bestWorkflowRoiPercent: null,
      isScaling: null,
      isAutomationImproving: null,
      roiPercent: null,
    });

    expect(view.answers).toHaveLength(13);
    expect(view.answers[8].value).toBeNull();
    expect(view.answers[10].value).toBeNull();
  });
});
