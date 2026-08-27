// Recovery analytics + expected-vs-actual + recovery curve +
// time-to-recovery -- doc 13 sections 20-23. PLAN.md P12-9.
//
// "Track: expected recoveries, actual recoveries, pending recoveries,
// recovered amount, average recovery, median recovery, recovery rate,
// time to recovery, recovery by source/jurisdiction/case type." /
// "Show: expected recovery, actual recovery, variance, variance
// percentage." / "Track time from case created to recovery. Display
// average, median, P75, P90, P95." / "Calculate average/median/P75/
// P90/P95 time to recovery, segmented by source/jurisdiction/case
// type/filing method/workflow/period."
//
// Expected-vs-actual variance reuses recoveryVariance.ts's (P9-3)
// evaluateRecoveryVariance() rather than a second comparison
// mechanism. Percentile computation reuses apiLatencyMonitoring.ts's
// (P11-4) generic computeLatencyPercentile() -- a time-to-recovery
// distribution is the same nearest-rank percentile problem as a
// latency distribution, just over days instead of milliseconds.

import { evaluateRecoveryVariance, type RecoveryVarianceResult } from "./recoveryVariance";
import { computeLatencyPercentile } from "./apiLatencyMonitoring";

function median(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface RecoveryAnalyticsCounts {
  expectedRecoveries: number;
  actualRecoveries: number;
  pendingRecoveries: number;
  recoveredAmountCents: readonly number[]; // one entry per completed recovery, for average/median
}

export interface RecoveryAnalyticsSummary {
  expectedRecoveries: number;
  actualRecoveries: number;
  pendingRecoveries: number;
  totalRecoveredCents: number;
  averageRecoveryCents: number | null;
  medianRecoveryCents: number | null;
  recoveryRatePercent: number | null;
}

export function computeRecoveryAnalyticsSummary(counts: RecoveryAnalyticsCounts): RecoveryAnalyticsSummary {
  const totalRecoveredCents = counts.recoveredAmountCents.reduce((sum, a) => sum + a, 0);
  const averageRecoveryCents =
    counts.recoveredAmountCents.length > 0 ? Math.round(totalRecoveredCents / counts.recoveredAmountCents.length) : null;
  return {
    expectedRecoveries: counts.expectedRecoveries,
    actualRecoveries: counts.actualRecoveries,
    pendingRecoveries: counts.pendingRecoveries,
    totalRecoveredCents,
    averageRecoveryCents,
    medianRecoveryCents: median(counts.recoveredAmountCents),
    recoveryRatePercent:
      counts.expectedRecoveries > 0 ? Math.round((counts.actualRecoveries / counts.expectedRecoveries) * 1000) / 10 : null,
  };
}

// --- Expected vs. actual (doc 13 §21) ---------------------------------------

export function computeExpectedVsActualRecovery(expectedCents: number, actualCents: number): RecoveryVarianceResult {
  return evaluateRecoveryVariance(expectedCents, actualCents);
}

// --- Recovery curve + time-to-recovery (doc 13 §22-23) ----------------------

export interface TimeToRecoveryDistribution {
  averageDays: number | null;
  medianDays: number | null;
  p75Days: number | null;
  p90Days: number | null;
  p95Days: number | null;
}

/**
 * Pure: doc 13 §22-23's own worked distribution shape, computed over
 * a caller-supplied array of per-case days-to-recovery. The caller is
 * responsible for pre-filtering to whatever segment (source/
 * jurisdiction/case-type/filing-method/workflow/period) it wants --
 * this function never assumes a segmentation dimension itself.
 */
export function computeTimeToRecoveryDistribution(daysToRecovery: readonly number[]): TimeToRecoveryDistribution {
  if (daysToRecovery.length === 0) {
    return { averageDays: null, medianDays: null, p75Days: null, p90Days: null, p95Days: null };
  }
  const averageDays = Math.round((daysToRecovery.reduce((s, d) => s + d, 0) / daysToRecovery.length) * 10) / 10;
  return {
    averageDays,
    medianDays: median(daysToRecovery),
    p75Days: computeLatencyPercentile(daysToRecovery, 75),
    p90Days: computeLatencyPercentile(daysToRecovery, 90),
    p95Days: computeLatencyPercentile(daysToRecovery, 95),
  };
}
