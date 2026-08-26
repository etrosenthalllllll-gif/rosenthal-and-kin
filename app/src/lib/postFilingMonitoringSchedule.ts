// Monitoring schedule + jobs -- doc 09 sections 8-9. PLAN.md P8-4.
//
// "Create configurable monitoring schedules: newly filed -- check
// frequently; processing -- check daily; long-term pending -- check
// weekly; deadline approaching -- increase frequency; hearing
// approaching -- increase frequency. Use the existing background job
// system. Jobs: POST_FILING_STATUS_CHECK, EVENT_CHECK, DEADLINE_CHECK,
// DOCUMENT_REQUEST_CHECK, HEARING_CHECK, DECISION_CHECK,
// CLAIMANT_NOTIFICATION, ESCALATION_CHECK. Each job must support
// retry/timeout/failure-state/idempotency/logging/next-scheduled-
// execution."
//
// Reuses the existing background job queue (P0-8) for the actual retry/
// timeout/idempotency mechanics rather than rebuilding them -- this
// module is the pure cadence-decision layer: given a case's current
// situation, how long until it should be checked again.

export type FilingAgeCategory = "NEWLY_FILED" | "PROCESSING" | "LONG_TERM_PENDING";

// doc 09's own cadence, verbatim, as a config table.
export const DEFAULT_MONITORING_INTERVAL_MINUTES: Record<FilingAgeCategory, number> = {
  NEWLY_FILED: 60, // "check frequently"
  PROCESSING: 1440, // "check daily"
  LONG_TERM_PENDING: 10080, // "check weekly"
};

// The interval used once a deadline or hearing is approaching --
// always shorter than every base tier above, so "increase frequency"
// actually shortens the interval regardless of which base tier a case
// is in.
export const APPROACHING_EVENT_INTERVAL_MINUTES = 360; // 6 hours

export interface MonitoringCadenceInput {
  filingAgeCategory: FilingAgeCategory;
  hasApproachingDeadline: boolean;
  hasApproachingHearing: boolean;
}

/**
 * Pure: doc 09 section 8. "Increase frequency" is implemented as
 * taking whichever interval is *shorter* -- the base tier's interval,
 * or the approaching-event interval -- so an approaching deadline/
 * hearing never gets checked *less* often than its base tier would
 * imply.
 */
export function determineMonitoringIntervalMinutes(
  input: MonitoringCadenceInput,
  baseIntervals: Record<FilingAgeCategory, number> = DEFAULT_MONITORING_INTERVAL_MINUTES,
  approachingEventInterval: number = APPROACHING_EVENT_INTERVAL_MINUTES
): number {
  const baseInterval = baseIntervals[input.filingAgeCategory];
  if (input.hasApproachingDeadline || input.hasApproachingHearing) {
    return Math.min(baseInterval, approachingEventInterval);
  }
  return baseInterval;
}

export interface MonitoringJobPlan {
  nextCheckAt: string;
  intervalMinutes: number;
}

/**
 * Pure: doc 09 section 9's "next scheduled execution." Caller-supplied
 * `lastCheckedAt` rather than this module calling `new Date()` itself,
 * same determinism discipline as every other timestamp-taking pure
 * function in this codebase.
 */
export function planNextMonitoringCheck(
  lastCheckedAt: string,
  input: MonitoringCadenceInput,
  baseIntervals: Record<FilingAgeCategory, number> = DEFAULT_MONITORING_INTERVAL_MINUTES,
  approachingEventInterval: number = APPROACHING_EVENT_INTERVAL_MINUTES
): MonitoringJobPlan {
  const intervalMinutes = determineMonitoringIntervalMinutes(input, baseIntervals, approachingEventInterval);
  const nextCheckAt = new Date(new Date(lastCheckedAt).getTime() + intervalMinutes * 60_000).toISOString();
  return { nextCheckAt, intervalMinutes };
}

// doc 09 section 9's own job-type list, verbatim -- named here as the
// single source of truth for whatever wires these onto the existing
// background job system (P0-8), rather than each caller inventing its
// own job-name string.
export type PostFilingJobType =
  | "POST_FILING_STATUS_CHECK"
  | "EVENT_CHECK"
  | "DEADLINE_CHECK"
  | "DOCUMENT_REQUEST_CHECK"
  | "HEARING_CHECK"
  | "DECISION_CHECK"
  | "CLAIMANT_NOTIFICATION"
  | "ESCALATION_CHECK";
