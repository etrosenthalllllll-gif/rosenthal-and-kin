// Workflow monitoring + failure/spike detection -- doc 12 sections
// 10-13. PLAN.md P11-5.
//
// "Monitor every workflow execution. Track: execution count, success
// count, failure count, retry count, average duration, P95 duration,
// stuck executions, cancelled executions, waiting executions, approval
// wait time." / "Create automatic detection for high failure rates...
// Make thresholds configurable... WARNING >5%, CRITICAL >15%. Do not
// hardcode these values." / "Detect sudden changes... even if the
// absolute percentage threshold isn't exceeded, flag the anomaly."

export interface WorkflowExecutionCounts {
  executionCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function computeWorkflowFailureRatePercent(counts: WorkflowExecutionCounts): number | null {
  return ratePercent(counts.failureCount, counts.executionCount);
}

// --- Configurable failure-rate thresholds (doc 12 §12) ----------------------

export interface FailureRateThresholds {
  warningPercent: number;
  criticalPercent: number;
}

// Illustrative defaults from the doc's own example -- configurable per
// workflow, never hardcoded into the check itself.
export const DEFAULT_FAILURE_RATE_THRESHOLDS: FailureRateThresholds = {
  warningPercent: 5,
  criticalPercent: 15,
};

export type FailureRateLevel = "NORMAL" | "WARNING" | "CRITICAL";

export function classifyFailureRate(
  failureRatePercent: number | null,
  thresholds: FailureRateThresholds = DEFAULT_FAILURE_RATE_THRESHOLDS
): FailureRateLevel {
  if (failureRatePercent === null) return "NORMAL";
  if (failureRatePercent >= thresholds.criticalPercent) return "CRITICAL";
  if (failureRatePercent >= thresholds.warningPercent) return "WARNING";
  return "NORMAL";
}

// --- Failure spike detection (doc 12 §13) -----------------------------------

export interface SpikeDetectionConfig {
  sensitivityMultiplier: number; // e.g. 3x the baseline
  minAbsoluteThreshold: number; // floor used when baseline is 0
}

export const DEFAULT_SPIKE_DETECTION_CONFIG: SpikeDetectionConfig = {
  sensitivityMultiplier: 3,
  minAbsoluteThreshold: 10,
};

/**
 * Pure: doc 12 §13's own example (normally 5 failures/hour, currently
 * 75/hour) -- flags a sudden change even when the percentage
 * threshold from §12 isn't crossed. When there's no historical
 * baseline (0/hour), falls back to an absolute floor rather than
 * flagging on any nonzero count (which would make every workflow's
 * first-ever failure a "spike").
 */
export function detectFailureSpike(
  baselineFailuresPerHour: number,
  currentFailuresPerHour: number,
  config: SpikeDetectionConfig = DEFAULT_SPIKE_DETECTION_CONFIG
): boolean {
  if (baselineFailuresPerHour <= 0) {
    return currentFailuresPerHour >= config.minAbsoluteThreshold;
  }
  return currentFailuresPerHour >= baselineFailuresPerHour * config.sensitivityMultiplier;
}

// --- Full execution metrics assembly (doc 12 §10) ---------------------------

export interface WorkflowExecutionMetrics extends WorkflowExecutionCounts {
  workflowName: string;
  workflowVersion: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  stuckCount: number;
  cancelledCount: number;
  waitingCount: number;
  avgApprovalWaitMs: number | null;
  failureRatePercent: number | null;
  failureRateLevel: FailureRateLevel;
}

export function buildWorkflowExecutionMetrics(
  params: Omit<WorkflowExecutionMetrics, "failureRatePercent" | "failureRateLevel">,
  thresholds: FailureRateThresholds = DEFAULT_FAILURE_RATE_THRESHOLDS
): WorkflowExecutionMetrics {
  const failureRatePercent = computeWorkflowFailureRatePercent(params);
  return { ...params, failureRatePercent, failureRateLevel: classifyFailureRate(failureRatePercent, thresholds) };
}
