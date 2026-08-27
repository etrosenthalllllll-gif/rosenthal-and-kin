import { describe, it, expect } from "vitest";
import { buildOperatorActionRecord, summarizeLaborTime, computeOperatorUtilization } from "./operatorHoursAnalytics";

describe("operator action record construction", () => {
  it("computes real duration from a start/end pair, marked not estimated", () => {
    const record = buildOperatorActionRecord({
      operator: "operator-1",
      caseId: "RK-1842",
      action: "CASE_REVIEW",
      startAt: "2026-08-26T00:00:00.000Z",
      endAt: "2026-08-26T00:30:00.000Z",
    });
    expect(record.durationMs).toBe(30 * 60 * 1000);
    expect(record.isEstimated).toBe(false);
  });

  it("falls back to an estimated duration when there's no end time, and labels it honestly", () => {
    const record = buildOperatorActionRecord({
      operator: "operator-1",
      caseId: "RK-1842",
      action: "CASE_REVIEW",
      startAt: "2026-08-26T00:00:00.000Z",
      estimatedDurationMs: 15 * 60 * 1000,
    });
    expect(record.durationMs).toBe(15 * 60 * 1000);
    expect(record.isEstimated).toBe(true);
  });

  it("has no duration at all when neither an end time nor an estimate is supplied", () => {
    const record = buildOperatorActionRecord({ operator: "operator-1", caseId: "RK-1842", action: "CASE_REVIEW", startAt: "t" });
    expect(record.durationMs).toBeNull();
  });
});

describe("labor time summary", () => {
  it("keeps measured and estimated time as separate totals", () => {
    const summary = summarizeLaborTime([
      buildOperatorActionRecord({ operator: "o", caseId: "c1", action: "A", startAt: "2026-08-26T00:00:00.000Z", endAt: "2026-08-26T00:10:00.000Z" }),
      buildOperatorActionRecord({ operator: "o", caseId: "c2", action: "A", startAt: "t", estimatedDurationMs: 5 * 60 * 1000 }),
    ]);
    expect(summary.measuredMs).toBe(10 * 60 * 1000);
    expect(summary.estimatedMs).toBe(5 * 60 * 1000);
  });
});

describe("operator utilization", () => {
  it("computes avg time per case, cases per hour, and revenue per hour", () => {
    const metrics = computeOperatorUtilization({
      hoursWorked: 40,
      casesTouched: 80,
      decisionsMade: 100,
      claimsReviewed: 60,
      exceptionsResolved: 10,
      revenueCents: 400_000,
    });
    expect(metrics.avgTimePerCaseHours).toBe(0.5);
    expect(metrics.casesPerOperatorHour).toBe(2);
    expect(metrics.revenuePerOperatorHourCents).toBe(10_000);
  });

  it("returns null utilization metrics with zero hours worked", () => {
    const metrics = computeOperatorUtilization({ hoursWorked: 0, casesTouched: 0, decisionsMade: 0, claimsReviewed: 0, exceptionsResolved: 0, revenueCents: 0 });
    expect(metrics.casesPerOperatorHour).toBeNull();
  });
});
