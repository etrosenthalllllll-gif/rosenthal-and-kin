// Filing tracking + reconciliation -- doc 08 sections 34-36, 56, 58.
// PLAN.md P7-15.
//
// "Build a filing-status tracking service. Prefer webhooks where
// reliable; use polling as a fallback where permitted. For providers
// without webhooks, create scheduled jobs: immediately, then 1 hour,
// 6 hours, 24 hours, then a configured interval. Stop when
// ACCEPTED/REJECTED/CLOSED. Avoid aggressive polling. Validate webhook
// signature/event authenticity/event id/timestamp; process
// idempotently -- never let a duplicate webhook event create a
// duplicate filing event. If the provider is unavailable, do not mark
// cases unchanged merely because the external system couldn't be
// checked. Build a reconciliation engine comparing internal state
// against external state; on any mismatch, create a
// FILING_RECONCILIATION_EXCEPTION rather than assuming they agree."

import type { FilingStatus } from "./filingStateMachine";

// doc 08's own default polling schedule, verbatim, as a config table
// rather than hardcoded delays inline.
export interface PollingScheduleStep {
  afterAttemptNumber: number;
  delayMinutes: number;
}

export const DEFAULT_POLLING_SCHEDULE: readonly PollingScheduleStep[] = [
  { afterAttemptNumber: 0, delayMinutes: 0 }, // check immediately
  { afterAttemptNumber: 1, delayMinutes: 60 },
  { afterAttemptNumber: 2, delayMinutes: 360 },
  { afterAttemptNumber: 3, delayMinutes: 1440 },
];

// After the configured schedule is exhausted, fall back to this
// interval -- doc 08's own "then: configured interval."
export const DEFAULT_POLLING_FALLBACK_INTERVAL_MINUTES = 1440;

/**
 * doc 08 section 35: stop polling once a filing reaches one of these
 * -- a deliberately narrower set than filingStateMachine.ts's
 * isTerminalFilingStatus(): ACCEPTED still administratively continues
 * on to CLOSED, but there's nothing further to *poll for* once it's
 * accepted or rejected.
 */
export function shouldStopPolling(status: FilingStatus): boolean {
  return status === "ACCEPTED" || status === "REJECTED" || status === "CLOSED";
}

export function nextPollDelayMinutes(
  attemptNumber: number,
  schedule: readonly PollingScheduleStep[] = DEFAULT_POLLING_SCHEDULE,
  fallbackIntervalMinutes: number = DEFAULT_POLLING_FALLBACK_INTERVAL_MINUTES
): number {
  const step = schedule.find((s) => s.afterAttemptNumber === attemptNumber);
  return step ? step.delayMinutes : fallbackIntervalMinutes;
}

export interface PollingPlan {
  shouldPoll: boolean;
  delayMinutes: number;
}

/**
 * Pure: doc 08 section 34's "prefer webhooks where reliable" -- a
 * connector with webhook support never gets polled at all; polling is
 * only the fallback mechanism, and even then only until the filing
 * reaches a stop-polling status.
 */
export function planNextStatusCheck(
  currentStatus: FilingStatus,
  attemptNumber: number,
  hasWebhookSupport: boolean,
  schedule: readonly PollingScheduleStep[] = DEFAULT_POLLING_SCHEDULE,
  fallbackIntervalMinutes: number = DEFAULT_POLLING_FALLBACK_INTERVAL_MINUTES
): PollingPlan {
  if (hasWebhookSupport || shouldStopPolling(currentStatus)) {
    return { shouldPoll: false, delayMinutes: 0 };
  }
  return { shouldPoll: true, delayMinutes: nextPollDelayMinutes(attemptNumber, schedule, fallbackIntervalMinutes) };
}

// --- Webhook idempotency (doc 08 section 36) --------------------------

/**
 * Pure: doc 08 section 36's "do not allow duplicate webhook events to
 * create duplicate filing events." The caller owns the durable set of
 * already-processed event ids (e.g. a DB unique constraint); this is
 * just the check itself, kept separate and testable.
 */
export function isDuplicateWebhookEvent(eventId: string, processedEventIds: ReadonlySet<string>): boolean {
  return processedEventIds.has(eventId);
}

// --- Reconciliation (doc 08 section 58) --------------------------------

export type ReconciliationOutcome = "MATCH" | "MISMATCH";

export interface ReconciliationResult {
  outcome: ReconciliationOutcome;
  internalStatus: string;
  externalStatus: string;
}

/**
 * Pure: doc 08 section 58. Never assumes internal and external state
 * agree -- a mismatch is always surfaced as its own result, and
 * `shouldCreateReconciliationException` tells the caller when to raise
 * a FILING_RECONCILIATION_EXCEPTION rather than silently updating the
 * internal record.
 */
export function reconcileFilingStatus(internalStatus: string, externalStatus: string): ReconciliationResult {
  return {
    outcome: internalStatus === externalStatus ? "MATCH" : "MISMATCH",
    internalStatus,
    externalStatus,
  };
}

export function shouldCreateReconciliationException(result: ReconciliationResult): boolean {
  return result.outcome === "MISMATCH";
}

// --- Provider outage handling (doc 08 section 56) ----------------------

export type ProviderCheckOutcome = "CHECKED" | "PROVIDER_UNAVAILABLE";

/**
 * doc 08 section 56: "Do not mark cases as unchanged merely because
 * the external system could not be checked." An unavailable provider
 * is its own explicit outcome -- never silently collapsed into "no
 * change detected."
 */
export function classifyProviderCheckOutcome(checkSucceeded: boolean): ProviderCheckOutcome {
  return checkSucceeded ? "CHECKED" : "PROVIDER_UNAVAILABLE";
}
