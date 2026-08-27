import { describe, it, expect } from "vitest";
import { evaluateScheduledJobRun, findDuplicateJobRuns, isSchedulerDown } from "./schedulerMonitoring";

describe("scheduled job run evaluation", () => {
  it("matches the doc's own worked example (expected 08:00, actual 12:00 -> DELAYED)", () => {
    const result = evaluateScheduledJobRun({
      expectedRunAt: "2026-08-26T08:00:00.000Z",
      actualRunAt: "2026-08-26T12:00:00.000Z",
      now: "2026-08-26T12:00:00.000Z",
      delayGraceMs: 15 * 60 * 1000,
      missedGraceMs: 60 * 60 * 1000,
    });
    expect(result.status).toBe("DELAYED");
  });

  it("is ON_TIME within the delay grace window", () => {
    const result = evaluateScheduledJobRun({
      expectedRunAt: "2026-08-26T08:00:00.000Z",
      actualRunAt: "2026-08-26T08:05:00.000Z",
      now: "2026-08-26T08:05:00.000Z",
      delayGraceMs: 15 * 60 * 1000,
      missedGraceMs: 60 * 60 * 1000,
    });
    expect(result.status).toBe("ON_TIME");
  });

  it("is MISSED once the job hasn't run and the missed grace has elapsed", () => {
    const result = evaluateScheduledJobRun({
      expectedRunAt: "2026-08-26T08:00:00.000Z",
      now: "2026-08-26T10:00:00.000Z",
      delayGraceMs: 15 * 60 * 1000,
      missedGraceMs: 60 * 60 * 1000,
    });
    expect(result.status).toBe("MISSED");
  });
});

describe("duplicate job run detection", () => {
  it("finds run keys that appear more than once", () => {
    expect(findDuplicateJobRuns(["job-1", "job-2", "job-1"])).toEqual(["job-1"]);
  });

  it("returns an empty array when every run is unique", () => {
    expect(findDuplicateJobRuns(["job-1", "job-2"])).toEqual([]);
  });
});

describe("scheduler downtime detection", () => {
  it("is down when no job has ever run", () => {
    expect(isSchedulerDown(undefined, "2026-08-26T00:00:00.000Z", 60_000)).toBe(true);
  });

  it("is down once the heartbeat window has elapsed since the last run", () => {
    expect(isSchedulerDown("2026-08-26T00:00:00.000Z", "2026-08-26T00:05:00.000Z", 60_000)).toBe(true);
  });

  it("is not down within the heartbeat window", () => {
    expect(isSchedulerDown("2026-08-26T00:00:00.000Z", "2026-08-26T00:00:30.000Z", 60_000)).toBe(false);
  });
});
