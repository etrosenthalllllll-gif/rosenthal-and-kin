import { describe, it, expect } from "vitest";
import {
  determineMonitoringIntervalMinutes,
  planNextMonitoringCheck,
} from "./postFilingMonitoringSchedule";

describe("monitoring interval determination", () => {
  it("checks a newly-filed case frequently", () => {
    const interval = determineMonitoringIntervalMinutes({
      filingAgeCategory: "NEWLY_FILED",
      hasApproachingDeadline: false,
      hasApproachingHearing: false,
    });
    expect(interval).toBe(60);
  });

  it("checks a processing case daily", () => {
    const interval = determineMonitoringIntervalMinutes({
      filingAgeCategory: "PROCESSING",
      hasApproachingDeadline: false,
      hasApproachingHearing: false,
    });
    expect(interval).toBe(1440);
  });

  it("checks a long-term-pending case weekly", () => {
    const interval = determineMonitoringIntervalMinutes({
      filingAgeCategory: "LONG_TERM_PENDING",
      hasApproachingDeadline: false,
      hasApproachingHearing: false,
    });
    expect(interval).toBe(10080);
  });

  it("increases frequency (shortens the interval) when a deadline is approaching, even for a long-term-pending case", () => {
    const interval = determineMonitoringIntervalMinutes({
      filingAgeCategory: "LONG_TERM_PENDING",
      hasApproachingDeadline: true,
      hasApproachingHearing: false,
    });
    expect(interval).toBe(360);
  });

  it("never lengthens the interval past the base tier when the base tier is already more frequent", () => {
    const interval = determineMonitoringIntervalMinutes({
      filingAgeCategory: "NEWLY_FILED",
      hasApproachingDeadline: true,
      hasApproachingHearing: false,
    });
    expect(interval).toBe(60); // 60 < 360, stays at the more frequent base
  });
});

describe("next monitoring check planning", () => {
  it("computes the next check timestamp from the determined interval", () => {
    const plan = planNextMonitoringCheck("2026-08-26T00:00:00.000Z", {
      filingAgeCategory: "PROCESSING",
      hasApproachingDeadline: false,
      hasApproachingHearing: false,
    });
    expect(plan.intervalMinutes).toBe(1440);
    expect(plan.nextCheckAt).toBe("2026-08-27T00:00:00.000Z");
  });
});
