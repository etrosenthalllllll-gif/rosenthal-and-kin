// API latency + availability monitoring -- doc 12 sections 8-9.
// PLAN.md P11-4.
//
// "Track latency distributions rather than only averages. Show P50,
// P90, P95, P99. If latency exceeds configured thresholds: mark
// DEGRADED and optionally trigger an alert." / "Track availability
// over time. Show 24 hours, 7 days, 30 days."

/**
 * Pure: nearest-rank percentile over a batch of latency samples
 * (milliseconds). Sorts a copy, never mutates the input. Returns null
 * for an empty sample set rather than a misleading 0.
 */
export function computeLatencyPercentile(samplesMs: readonly number[], percentile: number): number | null {
  if (samplesMs.length === 0) return null;
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.ceil((percentile / 100) * sorted.length) - 1);
  return sorted[Math.max(0, rank)];
}

export interface LatencyDistribution {
  p50: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
}

export function computeLatencyDistribution(samplesMs: readonly number[]): LatencyDistribution {
  return {
    p50: computeLatencyPercentile(samplesMs, 50),
    p90: computeLatencyPercentile(samplesMs, 90),
    p95: computeLatencyPercentile(samplesMs, 95),
    p99: computeLatencyPercentile(samplesMs, 99),
  };
}

export interface LatencyThresholds {
  p95WarningMs: number;
  p95DegradedMs: number;
}

export type LatencyStatus = "NORMAL" | "DEGRADED";

/**
 * Pure: doc 12 §8 -- once P95 latency exceeds the configured
 * threshold, the component is marked DEGRADED. Uses P95 (not the
 * average) since that's the doc's own worked example metric and
 * matches the "distributions, not just averages" instruction.
 */
export function evaluateLatencyStatus(p95Ms: number | null, thresholds: LatencyThresholds): LatencyStatus {
  if (p95Ms === null) return "NORMAL";
  return p95Ms >= thresholds.p95DegradedMs ? "DEGRADED" : "NORMAL";
}

// --- Availability tracking (doc 12 §9) --------------------------------------

export interface AvailabilityWindow {
  windowLabel: "24h" | "7d" | "30d";
  totalChecks: number;
  successfulChecks: number;
}

export interface AvailabilityReport {
  windowLabel: "24h" | "7d" | "30d";
  availabilityPercent: number | null;
}

/**
 * Pure: computes availability percentage per window,
 * divide-by-zero-guarded to null. Multiple windows are computed
 * independently -- a bad 24h window never gets averaged away by a
 * good 30h window or vice versa.
 */
export function computeAvailabilityReports(windows: readonly AvailabilityWindow[]): AvailabilityReport[] {
  return windows.map((w) => ({
    windowLabel: w.windowLabel,
    availabilityPercent: w.totalChecks <= 0 ? null : Math.round((w.successfulChecks / w.totalChecks) * 10000) / 100,
  }));
}
