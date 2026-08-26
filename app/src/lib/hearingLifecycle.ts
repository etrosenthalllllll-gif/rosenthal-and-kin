// Authority Event + Hearing tracking -- doc 09 sections 14-19. PLAN.md
// P8-6.
//
// "If the authority changes the hearing, preserve the original hearing
// AND the new hearing -- do not overwrite history. If cancelled, mark
// the original event CANCELLED, store the cancellation reason if
// available, remove/disable future reminders. Support configurable
// reminders (e.g. 30/14/7/3 days before, 24/2 hours before) -- only
// create reminders where a valid event date exists; do not fabricate
// missing times."
//
// Governs the schema's Hearing/HearingStatus models (P8-6). Same
// never-mutate-history discipline as claimPackage.ts's (P6-14)
// diffing/versioning: a reschedule produces two records (the original,
// marked RESCHEDULED and linked forward; a brand-new SCHEDULED one),
// never an in-place edit.

export type HearingStatus = "SCHEDULED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED" | "MISSED" | "UNKNOWN";

export interface HearingRecord {
  id: string;
  status: HearingStatus;
  scheduledAt: string | null;
  rescheduledToHearingId: string | null;
  cancellationReason: string | null;
}

export interface RescheduleResult {
  // The original row, mutated only to RESCHEDULED +
  // rescheduledToHearingId -- every other field (location, judge, etc.)
  // is left exactly as it was, preserved as history.
  originalHearing: HearingRecord;
  newHearing: HearingRecord;
}

/**
 * Pure: doc 09 section 18. Never overwrites the original hearing's own
 * scheduled date/location/etc. -- it only flips status to RESCHEDULED
 * and links forward to a brand-new hearing record the caller supplies
 * the id/date for.
 */
export function rescheduleHearing(
  original: HearingRecord,
  newHearingId: string,
  newScheduledAt: string
): RescheduleResult {
  return {
    originalHearing: { ...original, status: "RESCHEDULED", rescheduledToHearingId: newHearingId },
    newHearing: {
      id: newHearingId,
      status: "SCHEDULED",
      scheduledAt: newScheduledAt,
      rescheduledToHearingId: null,
      cancellationReason: null,
    },
  };
}

/**
 * Pure: doc 09 section 19. Marks the hearing CANCELLED, stores the
 * reason (when available -- "if available" per the doc, so this
 * accepts null), and reports that future reminders must be disabled --
 * the caller is responsible for actually clearing any scheduled
 * reminder jobs.
 */
export function cancelHearing(
  original: HearingRecord,
  reason: string | null
): { hearing: HearingRecord; remindersShouldBeDisabled: true } {
  return {
    hearing: { ...original, status: "CANCELLED", cancellationReason: reason },
    remindersShouldBeDisabled: true,
  };
}

// --- Hearing reminders (doc 09 section 17) -----------------------------

// doc 09's own example offsets, verbatim, as a config table.
export const DEFAULT_HEARING_REMINDER_OFFSETS_HOURS: readonly number[] = [
  30 * 24, // 30 days before
  14 * 24, // 14 days before
  7 * 24, // 7 days before
  3 * 24, // 3 days before
  24, // 24 hours before
  2, // 2 hours before
];

export interface HearingReminder {
  hearingId: string;
  remindAt: string;
  offsetHours: number;
}

/**
 * Pure: doc 09 section 17. Returns null (not an empty array) when
 * there's no valid `scheduledAt` at all -- "do not fabricate missing
 * times" means there's nothing to schedule reminders against, which is
 * a distinct outcome from "zero reminders configured."
 */
export function planHearingReminders(
  hearingId: string,
  scheduledAt: string | null,
  offsetsHours: readonly number[] = DEFAULT_HEARING_REMINDER_OFFSETS_HOURS
): HearingReminder[] | null {
  if (!scheduledAt) return null;

  const scheduledMs = new Date(scheduledAt).getTime();
  return offsetsHours.map((offsetHours) => ({
    hearingId,
    remindAt: new Date(scheduledMs - offsetHours * 60 * 60 * 1000).toISOString(),
    offsetHours,
  }));
}
