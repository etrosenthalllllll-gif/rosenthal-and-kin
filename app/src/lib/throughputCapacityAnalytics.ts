// Throughput + system capacity + revenue-per-hour/case -- doc 13
// sections 43-46. PLAN.md P12-16.
//
// "Track throughput per period across the full pipeline: leads
// processed, cases advanced, claims filed, recoveries closed." /
// "Estimate current capacity: what volume could the system handle at
// current staffing/automation levels before a queue backlog forms.
// Identify the current bottleneck stage." / "Show revenue per operator
// hour and gross profit per operator hour." / "Show average and
// median revenue, cost, and profit per case -- median matters because
// case value is often skewed by a few large recoveries."

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// --- Pipeline throughput (doc 13 §43) ---------------------------------------

export interface PipelineThroughputCounts {
  period: string;
  leadsProcessed: number;
  casesAdvanced: number;
  claimsFiled: number;
  recoveriesClosed: number;
}

export function buildThroughputReport(periods: readonly PipelineThroughputCounts[]): readonly PipelineThroughputCounts[] {
  return periods;
}

// --- Capacity + bottleneck estimate (doc 13 §44) ----------------------------

export interface StageCapacity {
  stage: string;
  maxUnitsPerPeriod: number;
  currentUnitsPerPeriod: number;
}

export interface CapacityReport {
  stages: readonly (StageCapacity & { utilizationPercent: number | null })[];
  bottleneckStage: string | null;
  systemCapacityUnitsPerPeriod: number | null;
}

/**
 * Pure: doc 13 §44 -- "identify the current bottleneck stage." The
 * bottleneck is the stage with the highest utilization (closest to
 * its own max), and system capacity is bounded by that stage's max --
 * a pipeline can't move faster than its narrowest stage.
 */
export function computeCapacityReport(stages: readonly StageCapacity[]): CapacityReport {
  if (stages.length === 0) return { stages: [], bottleneckStage: null, systemCapacityUnitsPerPeriod: null };
  const withUtilization = stages.map((s) => ({
    ...s,
    utilizationPercent: s.maxUnitsPerPeriod > 0 ? Math.round((s.currentUnitsPerPeriod / s.maxUnitsPerPeriod) * 1000) / 10 : null,
  }));
  const bottleneck = withUtilization.reduce((worst, s) => ((s.utilizationPercent ?? -1) > (worst.utilizationPercent ?? -1) ? s : worst));
  const systemCapacityUnitsPerPeriod = Math.min(...stages.map((s) => s.maxUnitsPerPeriod));
  return { stages: withUtilization, bottleneckStage: bottleneck.stage, systemCapacityUnitsPerPeriod };
}

// --- Revenue/profit per operator hour (doc 13 §45) --------------------------

export interface RevenuePerOperatorHour {
  revenuePerOperatorHourCents: number | null;
  grossProfitPerOperatorHourCents: number | null;
}

export function computeRevenuePerOperatorHour(params: { revenueCents: number; grossProfitCents: number; operatorHours: number }): RevenuePerOperatorHour {
  return {
    revenuePerOperatorHourCents: params.operatorHours > 0 ? Math.round(params.revenueCents / params.operatorHours) : null,
    grossProfitPerOperatorHourCents: params.operatorHours > 0 ? Math.round(params.grossProfitCents / params.operatorHours) : null,
  };
}

// --- Average and median per case (doc 13 §46) -------------------------------

export interface PerCaseFinancials {
  revenueCents: number;
  costCents: number;
  profitCents: number;
}

export interface PerCaseFinancialStats {
  averageRevenueCents: number | null;
  medianRevenueCents: number | null;
  averageCostCents: number | null;
  medianCostCents: number | null;
  averageProfitCents: number | null;
  medianProfitCents: number | null;
}

/**
 * Pure: doc 13 §46 -- "median matters because case value is often
 * skewed by a few large recoveries." Both average and median are
 * always returned together, never just the average alone.
 */
export function computePerCaseFinancialStats(cases: readonly PerCaseFinancials[]): PerCaseFinancialStats {
  const revenues = cases.map((c) => c.revenueCents);
  const costs = cases.map((c) => c.costCents);
  const profits = cases.map((c) => c.profitCents);
  return {
    averageRevenueCents: average(revenues),
    medianRevenueCents: median(revenues),
    averageCostCents: average(costs),
    medianCostCents: median(costs),
    averageProfitCents: average(profits),
    medianProfitCents: median(profits),
  };
}
