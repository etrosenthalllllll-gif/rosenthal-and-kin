import { describe, it, expect } from "vitest";
import {
  computeNextRunAt,
  isJobDue,
  planDeadlineReminders,
  formatTimezoneAwareTimestamp,
} from "./scheduledJob";

describe("next-run computation", () => {
  it("returns the stored runAt for a one-time/delayed/reminder job", () => {
    expect(computeNextRunAt({ kind: "ONE_TIME", runAt: "2026-09-01T00:00:00.000Z" }, undefined, "2026-08-26T00:00:00.000Z")).toBe(
      "2026-09-01T00:00:00.000Z"
    );
  });

  it("adds the interval to now for a recurring job that's never run", () => {
    const result = computeNextRunAt({ kind: "RECURRING", intervalMs: 6 * 60 * 60 * 1000 }, undefined, "2026-08-26T00:00:00.000Z");
    expect(result).toBe("2026-08-26T06:00:00.000Z");
  });

  it("adds the interval to the last run, not to now, once a recurring job has run before", () => {
    const result = computeNextRunAt(
      { kind: "POLLING", intervalMs: 60 * 60 * 1000 },
      "2026-08-26T01:00:00.000Z",
      "2026-08-26T05:00:00.000Z"
    );
    expect(result).toBe("2026-08-26T02:00:00.000Z");
  });
});

describe("job due check", () => {
  it("is due once the current time reaches or passes nextRunAt", () => {
    expect(isJobDue("2026-08-26T00:00:00.000Z", "2026-08-26T00:00:00.000Z")).toBe(true);
    expect(isJobDue("2026-08-26T00:00:00.000Z", "2026-08-27T00:00:00.000Z")).toBe(true);
  });

  it("is not due before nextRunAt", () => {
    expect(isJobDue("2026-08-27T00:00:00.000Z", "2026-08-26T00:00:00.000Z")).toBe(false);
  });
});

describe("deadline-aware reminder scheduling", () => {
  it("derives 30/7/1-day-before reminders from the deadline itself", () => {
    const reminders = planDeadlineReminders("2026-09-30T00:00:00.000Z");
    expect(reminders).toEqual([
      { daysBefore: 30, reminderAt: "2026-08-31T00:00:00.000Z" },
      { daysBefore: 7, reminderAt: "2026-09-23T00:00:00.000Z" },
      { daysBefore: 1, reminderAt: "2026-09-29T00:00:00.000Z" },
    ]);
  });

  it("accepts a custom offset list", () => {
    const reminders = planDeadlineReminders("2026-09-10T00:00:00.000Z", [3]);
    expect(reminders).toEqual([{ daysBefore: 3, reminderAt: "2026-09-07T00:00:00.000Z" }]);
  });
});

describe("timezone-aware display", () => {
  it("never mutates the stored UTC value -- formatting is display-only", () => {
    const timestamp = { utc: "2026-08-26T20:00:00.000Z", timezone: "America/Los_Angeles" };
    const formatted = formatTimezoneAwareTimestamp(timestamp);
    expect(typeof formatted).toBe("string");
    expect(timestamp.utc).toBe("2026-08-26T20:00:00.000Z");
  });
});
