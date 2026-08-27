// Central analytics dashboard assembly -- doc 13 section 5. PLAN.md
// P12-3.
//
// "Create a central BUSINESS ANALYTICS dashboard. Top-level metrics:
// LEADS, QUALIFIED LEADS, RESPONSES, ACTIVE CASES, CLAIMS FILED,
// RECOVERIES, GROSS REVENUE, TOTAL COST, NET REVENUE, COST PER CASE,
// OPERATOR HOURS, HUMAN INTERVENTION RATE, AVERAGE TIME TO RECOVERY,
// ROI. Each metric should show: current value, previous-period value,
// percentage change, trend, date range."

import { computePercentChange } from "./timeDimensions";

export type MetricTrend = "UP" | "DOWN" | "FLAT";

export interface MetricWithTrend {
  current: number;
  previous: number;
  percentChange: number | null;
  trend: MetricTrend;
}

/**
 * Pure: doc 13 §5's own per-metric shape. Trend is derived from the
 * raw current-vs-previous comparison (not from percentChange, which
 * can be null on a zero baseline) so a metric that went from 0 to a
 * positive value still correctly shows UP.
 */
export function buildMetricWithTrend(current: number, previous: number): MetricWithTrend {
  const trend: MetricTrend = current > previous ? "UP" : current < previous ? "DOWN" : "FLAT";
  return { current, previous, percentChange: computePercentChange(current, previous), trend };
}

export interface CentralAnalyticsCounts {
  leads: number;
  qualifiedLeads: number;
  responses: number;
  activeCases: number;
  claimsFiled: number;
  recoveries: number;
  grossRevenueCents: number;
  totalCostCents: number;
  netRevenueCents: number;
  costPerCaseCents: number;
  operatorHours: number;
  humanInterventionRatePercent: number;
  avgTimeToRecoveryDays: number;
  roiPercent: number;
}

export type CentralAnalyticsDashboard = { [K in keyof CentralAnalyticsCounts]: MetricWithTrend };

/**
 * Pure: assembles the doc's own 14-metric dashboard, pairing every
 * current value with its previous-period counterpart. Never
 * recomputes any of the underlying counts itself -- those come from
 * whichever module already owns them (funnel/cost/revenue/ROI
 * modules built elsewhere in this phase).
 */
export function buildCentralAnalyticsDashboard(
  current: CentralAnalyticsCounts,
  previous: CentralAnalyticsCounts
): CentralAnalyticsDashboard {
  const result = {} as CentralAnalyticsDashboard;
  for (const key of Object.keys(current) as Array<keyof CentralAnalyticsCounts>) {
    result[key] = buildMetricWithTrend(current[key], previous[key]);
  }
  return result;
}
