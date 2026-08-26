// Scheduled job system + deadline-aware scheduling + timezone handling
// -- doc 11 sections 40-43. PLAN.md P10-10.
//
// "Build a centralized scheduler. Support: one-time, recurring,
// delayed, deadline, follow-up, polling, reminder, reconciliation
// jobs." / "Support schedules based on case events... Hearing date:
// create reminders at 30 days, 7 days, 1 day. The schedule should
// derive from structured case dates." / "Store timezone explicitly
// when relevant. Never assume server timezone... Store UTC
// timestamps. Store relevant local timezone. Convert for display."
//
// Generalizes the scheduling shape already proven per-domain in
// followUpScheduler.ts/postFilingFollowUp.ts/paymentReminder.ts into
// one shared job model -- statuses: SCHEDULED, RUNNING, PAUSED,
// COMPLETED, FAILED, CANCELLED (doc 11 §41).

export type ScheduledJobKind = "ONE_TIME" | "RECURRING" | "DELAYED" | "POLLING" | "REMINDER" | "RECONCILIATION";

export type ScheduledJobStatus = "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface OneTimeSchedule {
  kind: "ONE_TIME" | "DELAYED" | "REMINDER";
  runAt: string;
}

export interface RecurringSchedule {
  kind: "RECURRING" | "POLLING" | "RECONCILIATION";
  intervalMs: number;
}

export type JobSchedule = OneTimeSchedule | RecurringSchedule;

/**
 * Pure: doc 11 §40's own recurring-job examples ("every 6 hours...
 * every hour... daily"). A one-time/delayed/reminder job's next run is
 * simply its stored runAt; a recurring job's next run is the last run
 * (or, if it's never run, `now`) plus its interval.
 */
function isRecurringSchedule(schedule: JobSchedule): schedule is RecurringSchedule {
  return "intervalMs" in schedule;
}

export function computeNextRunAt(schedule: JobSchedule, lastRunAt: string | undefined, now: string): string {
  if (!isRecurringSchedule(schedule)) {
    return schedule.runAt;
  }
  const base = lastRunAt ?? now;
  return new Date(new Date(base).getTime() + schedule.intervalMs).toISOString();
}

export function isJobDue(nextRunAt: string, now: string): boolean {
  return nextRunAt <= now;
}

// --- Deadline-aware scheduling (doc 11 §42) ---------------------------------

export interface DeadlineReminder {
  daysBefore: number;
  reminderAt: string;
}

/**
 * Pure: doc 11 §42's own worked example ("Hearing date: create
 * reminders at 30 days, 7 days, 1 day") -- the schedule is derived
 * from the structured deadline itself, never a separately-maintained
 * date a human has to keep in sync.
 */
export function planDeadlineReminders(
  deadlineAtIso: string,
  offsetsDaysBefore: readonly number[] = [30, 7, 1]
): DeadlineReminder[] {
  const deadlineMs = new Date(deadlineAtIso).getTime();
  return offsetsDaysBefore.map((daysBefore) => ({
    daysBefore,
    reminderAt: new Date(deadlineMs - daysBefore * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

// --- Timezone handling (doc 11 §43) -----------------------------------------

export interface TimezoneAwareTimestamp {
  utc: string; // always stored/compared in UTC
  timezone: string; // the relevant local timezone, e.g. "America/Los_Angeles"
}

/**
 * Pure display conversion only -- storage and comparison always stay
 * on the `utc` field; this never mutates or re-derives it. Uses the
 * platform's built-in Intl support rather than pulling in a timezone
 * library.
 */
export function formatTimezoneAwareTimestamp(timestamp: TimezoneAwareTimestamp): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timestamp.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp.utc));
}
