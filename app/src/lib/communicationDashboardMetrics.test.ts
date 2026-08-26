import { describe, it, expect } from "vitest";
import { computeDashboardMetrics, type DashboardCounts } from "./communicationDashboardMetrics";

function counts(overrides: Partial<DashboardCounts> = {}): DashboardCounts {
  return {
    messagesSent: 0,
    messagesReceived: 0,
    automatedResponses: 0,
    humanReviewedResponses: 0,
    pendingResponses: 0,
    exceptions: 0,
    optOuts: 0,
    failedCommunications: 0,
    delivered: 0,
    bounced: 0,
    ...overrides,
  };
}

describe("computeDashboardMetrics", () => {
  it("returns null for every rate when all counts are zero, never NaN or Infinity", () => {
    const metrics = computeDashboardMetrics(counts());
    expect(metrics.automatedResponseRate).toBeNull();
    expect(metrics.humanInterventionRate).toBeNull();
    expect(metrics.escalationRate).toBeNull();
    expect(metrics.optOutRate).toBeNull();
    expect(metrics.bounceRate).toBeNull();
    expect(metrics.deliveryRate).toBeNull();
  });

  it("computes the automated vs. human-reviewed split correctly", () => {
    const metrics = computeDashboardMetrics(
      counts({ automatedResponses: 90, humanReviewedResponses: 10 })
    );
    expect(metrics.automatedResponseRate).toBe(90);
    expect(metrics.humanInterventionRate).toBe(10);
  });

  it("computes escalation rate against messages received, not sent", () => {
    const metrics = computeDashboardMetrics(counts({ messagesReceived: 50, exceptions: 5 }));
    expect(metrics.escalationRate).toBe(10);
  });

  it("computes opt-out rate against messages received", () => {
    const metrics = computeDashboardMetrics(counts({ messagesReceived: 200, optOuts: 4 }));
    expect(metrics.optOutRate).toBe(2);
  });

  it("computes bounce and delivery rate against messages sent, not received", () => {
    const metrics = computeDashboardMetrics(
      counts({ messagesSent: 100, delivered: 92, bounced: 3 })
    );
    expect(metrics.deliveryRate).toBe(92);
    expect(metrics.bounceRate).toBe(3);
  });

  it("rounds to one decimal place rather than an ugly long float", () => {
    const metrics = computeDashboardMetrics(counts({ messagesReceived: 3, exceptions: 1 }));
    expect(metrics.escalationRate).toBe(33.3);
  });

  it("passes the raw counts through unchanged alongside the computed rates", () => {
    const input = counts({ messagesSent: 10, pendingResponses: 2, failedCommunications: 1 });
    const metrics = computeDashboardMetrics(input);
    expect(metrics.messagesSent).toBe(10);
    expect(metrics.pendingResponses).toBe(2);
    expect(metrics.failedCommunications).toBe(1);
  });
});
