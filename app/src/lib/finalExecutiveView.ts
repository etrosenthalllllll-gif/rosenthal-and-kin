// Final executive view assembly -- doc 13 section 95. PLAN.md P12-30
// (part 1 of 2, alongside the end-to-end test in
// analyticsEndToEnd.test.ts).
//
// "The finished system should provide one page where I can open the
// platform and immediately understand" the doc's own 13 questions,
// verbatim below. Deliberately assembly-only, same discipline as
// `executiveDashboard.ts` (P12-21) and `analyticsDashboardAssembly.ts`
// (P12-22) -- every figure here is computed elsewhere (funnel, cost,
// revenue, ROI, automation-rate, source-comparison, scale-analysis
// modules built across this phase); this module only packages them
// into the doc's own one-page answer set, no new arithmetic.

// doc 13 §95's own 13 questions, verbatim and in order.
export const FINAL_EXECUTIVE_VIEW_QUESTIONS = [
  "HOW MUCH BUSINESS IS ENTERING?",
  "HOW MUCH IS CONVERTING?",
  "HOW MUCH IS BEING RECOVERED?",
  "HOW MUCH MONEY IS BEING GENERATED?",
  "HOW MUCH DOES EACH CASE COST?",
  "HOW MANY HUMAN HOURS ARE REQUIRED?",
  "HOW OFTEN DOES THE SYSTEM NEED HUMAN INTERVENTION?",
  "HOW FAST ARE CASES RECOVERING?",
  "WHICH SOURCES ARE MOST PROFITABLE?",
  "WHICH WORKFLOWS ARE MOST EFFICIENT?",
  "IS THE SYSTEM SCALING?",
  "IS AUTOMATION IMPROVING?",
  "WHAT IS THE ACTUAL ROI?",
] as const;

export interface FinalExecutiveViewInputs {
  /** doc 13 §97's own success-criteria wording maps directly onto
   * these fields -- "how many leads did we source" etc. */
  leadsEntering: number;
  conversionRatePercent: number | null;
  totalRecoveredCents: number;
  totalRevenueCents: number;
  costPerCaseCents: number | null;
  totalOperatorHours: number;
  humanInterventionRatePercent: number | null;
  avgTimeToRecoveryDays: number | null;
  bestSourceId: string | null;
  bestSourceRoiPercent: number | null;
  bestWorkflowId: string | null;
  bestWorkflowRoiPercent: number | null;
  isScaling: boolean | null;
  isAutomationImproving: boolean | null;
  roiPercent: number | null;
}

export interface FinalExecutiveViewAnswer {
  question: string;
  value: unknown;
}

export interface FinalExecutiveView {
  answers: readonly FinalExecutiveViewAnswer[];
}

/**
 * Pure: doc 13 §95's one-page assembly. Each of the 13 questions is
 * paired with its already-computed answer, in the doc's own order --
 * never recomputed here, and every question the doc lists is present
 * even when the underlying answer is null (an unanswerable question is
 * surfaced as null, not silently dropped from the page).
 */
export function buildFinalExecutiveView(inputs: FinalExecutiveViewInputs): FinalExecutiveView {
  const bestSource =
    inputs.bestSourceId === null ? null : { sourceId: inputs.bestSourceId, roiPercent: inputs.bestSourceRoiPercent };
  const bestWorkflow =
    inputs.bestWorkflowId === null ? null : { workflowId: inputs.bestWorkflowId, roiPercent: inputs.bestWorkflowRoiPercent };

  return {
    answers: [
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[0], value: inputs.leadsEntering },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[1], value: inputs.conversionRatePercent },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[2], value: inputs.totalRecoveredCents },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[3], value: inputs.totalRevenueCents },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[4], value: inputs.costPerCaseCents },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[5], value: inputs.totalOperatorHours },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[6], value: inputs.humanInterventionRatePercent },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[7], value: inputs.avgTimeToRecoveryDays },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[8], value: bestSource },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[9], value: bestWorkflow },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[10], value: inputs.isScaling },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[11], value: inputs.isAutomationImproving },
      { question: FINAL_EXECUTIVE_VIEW_QUESTIONS[12], value: inputs.roiPercent },
    ],
  };
}
