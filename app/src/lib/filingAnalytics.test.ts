import { describe, it, expect } from "vitest";
import { computeFilingMetrics, computeAverageAcceptanceDays } from "./filingAnalytics";

describe("filing metrics", () => {
  it("computes acceptance/rejection/resubmission rates", () => {
    const metrics = computeFilingMetrics({
      totalFilings: 10,
      accepted: 6,
      rejected: 2,
      failed: 1,
      resubmitted: 3,
    });
    expect(metrics.acceptanceRate).toBe(60);
    expect(metrics.rejectionRate).toBe(20);
    expect(metrics.resubmissionRate).toBe(30);
  });

  it("returns null rates rather than dividing by zero when there are no filings", () => {
    const metrics = computeFilingMetrics({ totalFilings: 0, accepted: 0, rejected: 0, failed: 0, resubmitted: 0 });
    expect(metrics.acceptanceRate).toBeNull();
    expect(metrics.rejectionRate).toBeNull();
    expect(metrics.resubmissionRate).toBeNull();
  });
});

describe("average acceptance days", () => {
  it("computes the average days from submission to acceptance", () => {
    const result = computeAverageAcceptanceDays([
      { submissionTimestamp: "2026-08-01T00:00:00.000Z", acceptanceTimestamp: "2026-08-05T00:00:00.000Z" },
      { submissionTimestamp: "2026-08-10T00:00:00.000Z", acceptanceTimestamp: "2026-08-20T00:00:00.000Z" },
    ]);
    expect(result).toBe(7); // (4 + 10) / 2
  });

  it("returns null (not zero) when there is nothing to average", () => {
    expect(computeAverageAcceptanceDays([])).toBeNull();
  });
});
