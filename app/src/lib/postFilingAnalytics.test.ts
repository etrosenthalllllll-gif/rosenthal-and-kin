import { describe, it, expect } from "vitest";
import { computePostFilingCaseMetrics, computeDocumentRequestMetrics } from "./postFilingAnalytics";

describe("post-filing case metrics", () => {
  it("computes closure and escalation rates", () => {
    const metrics = computePostFilingCaseMetrics({
      totalCases: 10,
      closedCases: 4,
      escalatedCases: 2,
      onHoldCases: 1,
    });
    expect(metrics.closureRate).toBe(40);
    expect(metrics.escalationRate).toBe(20);
  });

  it("returns null rates rather than dividing by zero when there are no cases", () => {
    const metrics = computePostFilingCaseMetrics({ totalCases: 0, closedCases: 0, escalatedCases: 0, onHoldCases: 0 });
    expect(metrics.closureRate).toBeNull();
    expect(metrics.escalationRate).toBeNull();
  });
});

describe("document request metrics", () => {
  it("computes the acceptance rate", () => {
    const metrics = computeDocumentRequestMetrics({ totalRequests: 5, acceptedRequests: 3, openRequests: 1 });
    expect(metrics.acceptanceRate).toBe(60);
  });

  it("returns null when there are no requests yet", () => {
    const metrics = computeDocumentRequestMetrics({ totalRequests: 0, acceptedRequests: 0, openRequests: 0 });
    expect(metrics.acceptanceRate).toBeNull();
  });
});
