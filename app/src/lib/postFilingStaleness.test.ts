import { describe, it, expect } from "vitest";
import {
  checkNoUpdate,
  checkStaleCaseThreshold,
  isValidTimestampWithTimezone,
  isBusinessDay,
  addBusinessDays,
  type HolidayCalendar,
} from "./postFilingStaleness";

describe("no-update monitoring", () => {
  it("is not stale within the expected check interval", () => {
    const result = checkNoUpdate("2026-08-20T00:00:00.000Z", "2026-08-26T00:00:00.000Z", 30);
    expect(result.isStale).toBe(false);
    expect(result.daysSinceLastUpdate).toBe(6);
  });

  it("is stale once past the expected check interval", () => {
    const result = checkNoUpdate("2026-06-01T00:00:00.000Z", "2026-08-26T00:00:00.000Z", 30);
    expect(result.isStale).toBe(true);
  });
});

describe("stale-case thresholds", () => {
  it("flags PROCESSING > 30 days for review", () => {
    const result = checkStaleCaseThreshold("PROCESSING", 31);
    expect(result.isStale).toBe(true);
    expect(result.action).toBe("REVIEW");
  });

  it("does not flag before the threshold", () => {
    const result = checkStaleCaseThreshold("PROCESSING", 29);
    expect(result.isStale).toBe(false);
  });

  it("never flags a status with no configured threshold", () => {
    const result = checkStaleCaseThreshold("FILED", 1000);
    expect(result.isStale).toBe(false);
  });
});

describe("timestamp with timezone validation", () => {
  it("is valid with a real timestamp and a named timezone", () => {
    expect(isValidTimestampWithTimezone({ utc: "2026-08-26T00:00:00.000Z", authorityTimezone: "America/Los_Angeles" })).toBe(
      true
    );
  });

  it("is invalid with no timezone -- never assumes one", () => {
    expect(isValidTimestampWithTimezone({ utc: "2026-08-26T00:00:00.000Z", authorityTimezone: "" })).toBe(false);
  });
});

describe("business-day calculations", () => {
  const calendar: HolidayCalendar = { version: "v1", holidays: ["2026-09-07"] }; // Labor Day (Monday)

  it("treats a weekday as a business day", () => {
    expect(isBusinessDay(new Date("2026-09-01T00:00:00.000Z"), calendar)).toBe(true); // Tuesday
  });

  it("treats a weekend as not a business day", () => {
    expect(isBusinessDay(new Date("2026-09-05T00:00:00.000Z"), calendar)).toBe(false); // Saturday
  });

  it("treats a configured holiday as not a business day even on a weekday", () => {
    expect(isBusinessDay(new Date("2026-09-07T00:00:00.000Z"), calendar)).toBe(false); // Monday holiday
  });

  it("skips weekends and holidays when adding business days", () => {
    // Friday Sept 4 + 2 business days -> skip Sat/Sun, skip Labor Day
    // (Mon Sept 7) -> day 1 is Tue Sept 8, day 2 is Wed Sept 9.
    const result = addBusinessDays(new Date("2026-09-04T00:00:00.000Z"), 2, calendar);
    expect(result.toISOString().slice(0, 10)).toBe("2026-09-09");
  });
});
