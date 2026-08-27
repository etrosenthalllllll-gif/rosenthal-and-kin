// Trend analytics + anomaly detection + KPI alerts -- doc 13 sections
// 54-56. PLAN.md P12-20.
//
// "Build daily, weekly, monthly, and quarterly trend series for every
// major KPI." / "Flag anomalies: either a fixed threshold breach, or a
// statistical outlier relative to the metric's own recent history (a
// value more than N standard deviations from the recent mean)." /
// "Wire KPI anomalies into the same alert engine and notification
// path already built for operational alerts -- don't build a second,
// parallel alerting mechanism."

import { buildNewAlert, type Alert, type AlertSeverity } from "./alertEngine";

export type TrendGranularity = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";

export interface TrendPoint {
  period: string;
  value: number;
}

export interface TrendSeries {
  kpiName: string;
  granularity: TrendGranularity;
  points: readonly TrendPoint[];
}

/** Pure passthrough assembly: doc 13 §54 -- one series per KPI per
 * granularity, not a single blended series. */
export function buildTrendSeries(kpiName: string, granularity: TrendGranularity, points: readonly TrendPoint[]): TrendSeries {
  return { kpiName, granularity, points };
}

// --- Anomaly detection (doc 13 §55) -----------------------------------------

export type AnomalyMethod = "FIXED_THRESHOLD" | "STATISTICAL_OUTLIER";

export interface AnomalyCheckResult {
  isAnomaly: boolean;
  method: AnomalyMethod;
  reason: string | null;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: readonly number[], avg: number): number {
  return Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length);
}

/**
 * Pure: doc 13 §55 -- a fixed-threshold breach, OR a statistical
 * outlier more than `stdDevThreshold` standard deviations from the
 * mean of the metric's own recent history. Requires at least 2
 * historical points to compute a meaningful standard deviation;
 * with fewer, statistical detection is skipped (never a false
 * positive from an undersized sample).
 */
export function detectKpiAnomaly(params: {
  currentValue: number;
  recentHistory: readonly number[];
  fixedThreshold?: { min?: number; max?: number };
  stdDevThreshold?: number;
}): AnomalyCheckResult {
  if (params.fixedThreshold) {
    if (params.fixedThreshold.max !== undefined && params.currentValue > params.fixedThreshold.max) {
      return { isAnomaly: true, method: "FIXED_THRESHOLD", reason: `value ${params.currentValue} exceeds max ${params.fixedThreshold.max}` };
    }
    if (params.fixedThreshold.min !== undefined && params.currentValue < params.fixedThreshold.min) {
      return { isAnomaly: true, method: "FIXED_THRESHOLD", reason: `value ${params.currentValue} is below min ${params.fixedThreshold.min}` };
    }
  }
  if (params.recentHistory.length >= 2) {
    const threshold = params.stdDevThreshold ?? 3;
    const avg = mean(params.recentHistory);
    const sd = stdDev(params.recentHistory, avg);
    if (sd > 0) {
      const deviations = Math.abs(params.currentValue - avg) / sd;
      if (deviations > threshold) {
        return { isAnomaly: true, method: "STATISTICAL_OUTLIER", reason: `${deviations.toFixed(1)} standard deviations from recent mean` };
      }
    }
  }
  return { isAnomaly: false, method: "FIXED_THRESHOLD", reason: null };
}

// --- KPI alert integration (doc 13 §56) -------------------------------------

/**
 * Pure: doc 13 §56 -- "don't build a second, parallel alerting
 * mechanism." Routes straight through `buildNewAlert()` from
 * Phase 11's alertEngine.ts with source "KPI_THRESHOLD", so KPI
 * anomalies flow through the exact same alert/notification path as
 * every operational alert.
 */
export function buildKpiAlert(params: {
  kpiName: string;
  anomaly: AnomalyCheckResult;
  severity: AlertSeverity;
  currentValue: number;
  now: string;
}): Alert | null {
  if (!params.anomaly.isAnomaly) return null;
  return buildNewAlert({
    type: "KPI_ANOMALY",
    severity: params.severity,
    source: "KPI_THRESHOLD",
    component: params.kpiName,
    message: `${params.kpiName} anomaly (${params.anomaly.method}): ${params.anomaly.reason ?? "no detail"}`,
    details: { currentValue: params.currentValue, method: params.anomaly.method },
    now: params.now,
  });
}
