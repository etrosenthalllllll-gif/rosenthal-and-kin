// State reconciliation + stale-workflow detection + automation SLA --
// doc 11 sections 94-96. PLAN.md P10-24.
//
// "Build periodic reconciliation jobs. Every night: compare internal
// filing statuses against provider statuses. Compare invoices against
// payments. Compare scheduled jobs against workflow executions.
// Compare case states against workflow state. Flag discrepancies." /
// "Detect workflows that have been stuck. Example: expected duration
// 30 minutes, actual 18 hours. Create STALE_WORKFLOW_EXCEPTION." /
// "Allow workflow SLAs... track SLA compliance."

import { detectSyncException, type SyncExceptionInput, type SyncException } from "./crossSystemSync";

/**
 * Pure: doc 11 §94's four named comparison pairs, generalized into one
 * sweep -- reuses crossSystemSync.ts's detectSyncException() (P10-11)
 * rather than a second disagreement-detection mechanism, since a
 * nightly reconciliation discrepancy IS a sync exception, just found
 * on a schedule instead of in real time. Flags every discrepancy,
 * never auto-fixes any of them.
 */
export function findReconciliationDiscrepancies(pairs: readonly SyncExceptionInput[]): SyncException[] {
  return pairs.map((pair) => detectSyncException(pair)).filter((result): result is SyncException => result !== null);
}

// --- Stale workflow detection (doc 11 §95) ----------------------------------

export interface StaleWorkflowCheck {
  isStale: boolean;
  expectedDurationMs: number;
  elapsedMs: number;
}

/**
 * Pure: doc 11 §95's own worked example (30-minute expectation, 18-hour
 * actual). A workflow is stale once its elapsed time exceeds its
 * expected duration by more than the configurable multiplier -- a
 * default of 2x avoids flagging every normal minor overrun as stale.
 */
export function evaluateWorkflowStaleness(
  startedAt: string,
  now: string,
  expectedDurationMs: number,
  thresholdMultiplier = 2
): StaleWorkflowCheck {
  const elapsedMs = new Date(now).getTime() - new Date(startedAt).getTime();
  return { isStale: elapsedMs > expectedDurationMs * thresholdMultiplier, expectedDurationMs, elapsedMs };
}

// --- Automation SLA tracking (doc 11 §96) -----------------------------------

export type SlaOutcome = "MET" | "BREACHED";

/**
 * Pure: doc 11 §96's own examples ("classify within 2 minutes,"
 * "poll every 6 hours," etc.) reduced to one comparison -- an actual
 * duration at or under the target meets the SLA, anything over
 * breaches it.
 */
export function evaluateSlaCompliance(actualMs: number, targetMs: number): SlaOutcome {
  return actualMs <= targetMs ? "MET" : "BREACHED";
}

/**
 * Pure: aggregate SLA compliance rate across a batch of outcomes,
 * divide-by-zero guarded to null like every other rate calculation in
 * this codebase.
 */
export function computeSlaComplianceRate(outcomes: readonly SlaOutcome[]): number | null {
  if (outcomes.length === 0) return null;
  const met = outcomes.filter((o) => o === "MET").length;
  return Math.round((met / outcomes.length) * 1000) / 10;
}
