import { describe, it, expect } from "vitest";
import { rescheduleHearing, cancelHearing, planHearingReminders, type HearingRecord } from "./hearingLifecycle";

function hearing(overrides: Partial<HearingRecord> = {}): HearingRecord {
  return {
    id: "hearing-1",
    status: "SCHEDULED",
    scheduledAt: "2026-09-10T14:00:00.000Z",
    rescheduledToHearingId: null,
    cancellationReason: null,
    ...overrides,
  };
}

describe("hearing reschedule", () => {
  it("preserves the original hearing's own date, only flipping status and linking forward", () => {
    const result = rescheduleHearing(hearing(), "hearing-2", "2026-09-17T14:00:00.000Z");
    expect(result.originalHearing.status).toBe("RESCHEDULED");
    expect(result.originalHearing.scheduledAt).toBe("2026-09-10T14:00:00.000Z"); // unchanged
    expect(result.originalHearing.rescheduledToHearingId).toBe("hearing-2");
  });

  it("creates a brand-new SCHEDULED hearing for the new date", () => {
    const result = rescheduleHearing(hearing(), "hearing-2", "2026-09-17T14:00:00.000Z");
    expect(result.newHearing.id).toBe("hearing-2");
    expect(result.newHearing.status).toBe("SCHEDULED");
    expect(result.newHearing.scheduledAt).toBe("2026-09-17T14:00:00.000Z");
  });
});

describe("hearing cancellation", () => {
  it("marks the hearing CANCELLED and stores the reason", () => {
    const result = cancelHearing(hearing(), "Authority postponed indefinitely.");
    expect(result.hearing.status).toBe("CANCELLED");
    expect(result.hearing.cancellationReason).toBe("Authority postponed indefinitely.");
    expect(result.remindersShouldBeDisabled).toBe(true);
  });

  it("accepts a null reason when none is available", () => {
    const result = cancelHearing(hearing(), null);
    expect(result.hearing.cancellationReason).toBeNull();
  });
});

describe("hearing reminders", () => {
  it("returns null (not an empty array) when there is no valid scheduled date", () => {
    expect(planHearingReminders("hearing-1", null)).toBeNull();
  });

  it("computes a reminder for each configured offset when a date exists", () => {
    const reminders = planHearingReminders("hearing-1", "2026-09-10T14:00:00.000Z", [24, 2]);
    expect(reminders).toHaveLength(2);
    expect(reminders?.[0].remindAt).toBe("2026-09-09T14:00:00.000Z");
    expect(reminders?.[1].remindAt).toBe("2026-09-10T12:00:00.000Z");
  });
});
