// Cohort analysis + cohort recovery curves -- doc 13 sections 52-53.
// PLAN.md P12-19.
//
// "Group leads/cases by acquisition month into cohorts. Compare
// cohorts on: response rate, conversion rate, filing rate, recovery
// rate, revenue, ROI. This reveals whether newer cohorts are
// performing better or worse than older ones as the system and
// process evolve." / "Track a recovery curve per cohort: what
// percentage of the cohort's eventual recovery value has landed by
// day 30/60/90/180. This lets you project total recovery for a
// cohort before it's fully mature, by comparing its early curve
// shape to older, now-mature cohorts."

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// --- Cohort comparison (doc 13 §52) -----------------------------------------

export interface CohortRawCounts {
  cohortMonth: string;
  leadsAcquired: number;
  responded: number;
  converted: number;
  filed: number;
  recovered: number;
  revenueCents: number;
  costCents: number;
}

export interface CohortComparisonRow extends CohortRawCounts {
  responseRatePercent: number | null;
  conversionRatePercent: number | null;
  filingRatePercent: number | null;
  recoveryRatePercent: number | null;
  roiPercent: number | null;
}

/**
 * Pure: doc 13 §52's own metric list, all computed relative to the
 * cohort's own leadsAcquired denominator so cohorts of different
 * sizes are directly comparable.
 */
export function buildCohortComparison(cohorts: readonly CohortRawCounts[]): CohortComparisonRow[] {
  return cohorts.map((c) => ({
    ...c,
    responseRatePercent: ratePercent(c.responded, c.leadsAcquired),
    conversionRatePercent: ratePercent(c.converted, c.leadsAcquired),
    filingRatePercent: ratePercent(c.filed, c.leadsAcquired),
    recoveryRatePercent: ratePercent(c.recovered, c.leadsAcquired),
    roiPercent: c.costCents > 0 ? Math.round(((c.revenueCents - c.costCents) / c.costCents) * 1000) / 10 : null,
  }));
}

// --- Recovery curve per cohort (doc 13 §53) ---------------------------------

export const RECOVERY_CURVE_DAY_MARKS = [30, 60, 90, 180] as const;
export type RecoveryCurveDayMark = (typeof RECOVERY_CURVE_DAY_MARKS)[number];

export interface RecoveryCurvePoint {
  dayMark: RecoveryCurveDayMark;
  recoveredValueCents: number;
}

export interface RecoveryCurveReport {
  cohortMonth: string;
  points: readonly (RecoveryCurvePoint & { percentOfEventualValue: number | null })[];
  /** Null until the cohort has a known eventual total (fully mature or
   * explicitly finalized) -- projecting further is the caller's job,
   * using another cohort's curve shape as a reference. */
  eventualRecoveryValueCents: number | null;
}

/**
 * Pure: doc 13 §53 -- percentage landed by each day mark, relative to
 * the cohort's own eventual total when known. With no known eventual
 * total, every point's percentage is null rather than a guess.
 */
export function buildRecoveryCurve(params: {
  cohortMonth: string;
  points: readonly RecoveryCurvePoint[];
  eventualRecoveryValueCents: number | null;
}): RecoveryCurveReport {
  return {
    cohortMonth: params.cohortMonth,
    eventualRecoveryValueCents: params.eventualRecoveryValueCents,
    points: params.points.map((p) => ({
      ...p,
      percentOfEventualValue:
        params.eventualRecoveryValueCents && params.eventualRecoveryValueCents > 0
          ? Math.round((p.recoveredValueCents / params.eventualRecoveryValueCents) * 1000) / 10
          : null,
    })),
  };
}
