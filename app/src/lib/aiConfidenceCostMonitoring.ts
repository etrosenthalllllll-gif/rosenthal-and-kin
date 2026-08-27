// AI confidence + model-version + cost monitoring -- doc 12 sections
// 26-28. PLAN.md P11-10.
//
// "Track confidence distributions... average confidence normally 92%,
// current 64% -> flag AI_CONFIDENCE_ANOMALY." / "Track AI model/
// version used for each result. Allow comparison between versions." /
// "Track cost per request/case/workflow, daily cost, monthly cost,
// cost by model, cost by feature. Create configurable alerts... daily
// AI cost exceeds configured budget."
//
// Cost-threshold alerting reuses automationLimits.ts's
// evaluateCostLimit() (P10-13) rather than a second budget-comparison
// mechanism -- "AI daily cost exceeds budget" is exactly that
// function's spent-vs-limit check.

import { evaluateCostLimit, type CostLimitOutcome } from "./automationLimits";

/**
 * Pure: doc 12 §26's own worked example (92% normal, 64% current).
 * Flags a drop of at least `dropThresholdPoints` percentage points
 * from baseline -- a percentage-point drop, not a relative-percentage
 * drop, since confidence is already itself a percentage.
 */
export function detectConfidenceAnomaly(
  baselineAvgConfidencePercent: number,
  currentAvgConfidencePercent: number,
  dropThresholdPoints = 15
): boolean {
  return baselineAvgConfidencePercent - currentAvgConfidencePercent >= dropThresholdPoints;
}

// --- Model version comparison (doc 12 §27) ----------------------------------

export interface ModelVersionConfidence {
  modelVersion: string;
  avgConfidencePercent: number;
}

/**
 * Pure: doc 12 §27's own worked example (Model v1: 92%, Model v2:
 * 78%) -- returns the comparison sorted with the highest-confidence
 * version first, so a regression from a model upgrade is visible at a
 * glance.
 */
export function compareModelVersions(records: readonly ModelVersionConfidence[]): ModelVersionConfidence[] {
  return [...records].sort((a, b) => b.avgConfidencePercent - a.avgConfidencePercent);
}

// --- AI cost monitoring (doc 12 §28) -----------------------------------------

export interface AiCostBreakdown {
  byModel: Readonly<Record<string, number>>;
  byFeature: Readonly<Record<string, number>>;
  dailyCostCents: number;
  monthlyCostCents: number;
}

export type AiCostAlertOutcome = CostLimitOutcome;

/**
 * Pure: doc 12 §28's own example -- "daily AI cost exceeds configured
 * budget." Delegates straight to automationLimits.ts's
 * evaluateCostLimit() (P10-13's per-case/daily cost-ceiling check).
 */
export function evaluateAiDailyCostAlert(dailyCostCents: number, dailyBudgetCents: number): AiCostAlertOutcome {
  return evaluateCostLimit(dailyCostCents, dailyBudgetCents);
}
