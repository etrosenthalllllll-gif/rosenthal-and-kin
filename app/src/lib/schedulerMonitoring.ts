// Scheduler monitoring -- doc 12 section 22. PLAN.md P11-8.
//
// "Monitor scheduled jobs. Detect: missed jobs, delayed jobs,
// duplicate jobs, failed jobs, scheduler downtime, jobs executing too
// late. Example: daily deadline scan expected 08:00, actual 12:00 ->
// flag SCHEDULE_DELAY."

export type ScheduledJobRunStatus = "ON_TIME" | "DELAYED" | "MISSED";

/**
 * Pure: doc 12 §22's own worked example (expected 08:00, actual
 * 12:00 -> SCHEDULE_DELAY). A job with no actualRunAt yet and past its
 * grace window is MISSED, not just "still pending" -- the caller
 * decides how long to wait before calling this (i.e. `now` should
 * already reflect enough elapsed time to be meaningful).
 */
export function evaluateScheduledJobRun(params: {
  expectedRunAt: string;
  actualRunAt?: string;
  now: string;
  delayGraceMs: number;
  missedGraceMs: number;
}): { status: ScheduledJobRunStatus; delayMs: number } {
  if (params.actualRunAt) {
    const delayMs = new Date(params.actualRunAt).getTime() - new Date(params.expectedRunAt).getTime();
    return { status: delayMs > params.delayGraceMs ? "DELAYED" : "ON_TIME", delayMs: Math.max(0, delayMs) };
  }
  const elapsedSinceExpectedMs = new Date(params.now).getTime() - new Date(params.expectedRunAt).getTime();
  if (elapsedSinceExpectedMs > params.missedGraceMs) {
    return { status: "MISSED", delayMs: elapsedSinceExpectedMs };
  }
  return { status: "ON_TIME", delayMs: 0 };
}

// --- Duplicate job detection (doc 12 §22) -----------------------------------

/**
 * Pure: doc 12's "duplicate jobs" detection -- given the run-ids
 * recorded for one logical scheduled job in a window, returns every
 * run-id that appears more than once (the scheduler fired the same
 * job twice for the same scheduled slot).
 */
export function findDuplicateJobRuns(jobRunKeys: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const key of jobRunKeys) {
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

// --- Scheduler downtime detection (doc 12 §22) ------------------------------

/**
 * Pure: the scheduler itself is considered down when no scheduled job
 * of any kind has run within its configured heartbeat window -- same
 * heartbeat-timeout shape as queueMonitoring.ts's worker check,
 * applied to the scheduler process as a whole.
 */
export function isSchedulerDown(lastAnyJobRanAt: string | undefined, now: string, heartbeatTimeoutMs: number): boolean {
  if (!lastAnyJobRanAt) return true;
  return new Date(now).getTime() - new Date(lastAnyJobRanAt).getTime() > heartbeatTimeoutMs;
}
