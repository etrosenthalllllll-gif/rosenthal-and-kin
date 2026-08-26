// Monitoring reconciliation + system failure/outage handling + rate
// limiting -- doc 09 sections 61-65. PLAN.md P8-18.
//
// "Compare internal case state against external authority state; if
// different, create a reconciliation event and update the internal
// workflow, or REQUIRES_REVIEW if uncertain. If monitoring fails, do
// not silently stop monitoring -- create MONITORING_FAILURE, escalate
// if failures exceed a threshold. If an authority/provider is
// unavailable, create CONNECTOR_OUTAGE -- do not mark cases as
// unchanged merely because the external system could not be checked.
// Respect provider/court/API/connector rate limits; implement
// queueing, rate limiting, backoff, retry policies -- do not hammer
// external systems."
//
// State comparison and outage classification are the identical problem
// filingTrackingReconciliation.ts (P7-15) already solved for filings --
// reused directly here rather than reimplemented for post-filing cases.
// This module adds what's new: consecutive-failure escalation and
// backoff delay calculation.

import { reconcileFilingStatus, classifyProviderCheckOutcome, type ReconciliationResult, type ProviderCheckOutcome } from "./filingTrackingReconciliation";

export function reconcilePostFilingCaseStatus(internalStatus: string, externalStatus: string): ReconciliationResult {
  return reconcileFilingStatus(internalStatus, externalStatus);
}

export function classifyMonitoringCheckOutcome(checkSucceeded: boolean): ProviderCheckOutcome {
  return classifyProviderCheckOutcome(checkSucceeded);
}

// --- Monitoring failure escalation (doc 09 section 63) -----------------

export interface MonitoringFailureState {
  consecutiveFailureCount: number;
  failureThreshold: number;
}

/**
 * Pure: doc 09 section 63. Monitoring never silently stops -- every
 * failed check is counted, and once the count reaches the configured
 * threshold this reports that an escalation is due. The caller is
 * responsible for actually creating the MONITORING_FAILURE
 * record/escalation; this is just the threshold decision.
 */
export function shouldEscalateMonitoringFailure(state: MonitoringFailureState): boolean {
  return state.consecutiveFailureCount >= state.failureThreshold;
}

// --- Backoff (doc 09 sections 56, 65) -----------------------------------

/**
 * Pure: doc 09 section 65's "do not hammer external systems" --
 * exponential backoff capped at `maxDelayMinutes`, so retries slow down
 * rather than repeating at a fixed aggressive interval.
 */
export function computeBackoffDelayMinutes(
  attemptNumber: number,
  baseDelayMinutes: number,
  maxDelayMinutes: number
): number {
  return Math.min(baseDelayMinutes * 2 ** attemptNumber, maxDelayMinutes);
}
