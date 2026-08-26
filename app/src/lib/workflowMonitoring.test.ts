import { describe, it, expect } from "vitest";
import {
  computeWorkflowFailureRatePercent,
  classifyFailureRate,
  detectFailureSpike,
  buildWorkflowExecutionMetrics,
} from "./workflowMonitoring";

describe("workflow failure rate", () => {
  it("computes the failure rate percentage", () => {
    expect(computeWorkflowFailureRatePercent({ executionCount: 100, successCount: 82, failureCount: 18, retryCount: 5 })).toBe(18);
  });
});

describe("failure rate classification", () => {
  it("matches the doc's own worked example: 18% failure -> CRITICAL", () => {
    expect(classifyFailureRate(18)).toBe("CRITICAL");
  });

  it("classifies WARNING between the two thresholds", () => {
    expect(classifyFailureRate(8)).toBe("WARNING");
  });

  it("classifies NORMAL under the warning threshold", () => {
    expect(classifyFailureRate(1)).toBe("NORMAL");
  });

  it("never misclassifies null (no data) as anything but NORMAL", () => {
    expect(classifyFailureRate(null)).toBe("NORMAL");
  });
});

describe("failure spike detection", () => {
  it("matches the doc's own worked example: 5/hour baseline, 75/hour current -> spike", () => {
    expect(detectFailureSpike(5, 75)).toBe(true);
  });

  it("does not flag a normal fluctuation", () => {
    expect(detectFailureSpike(5, 8)).toBe(false);
  });

  it("falls back to the absolute floor when there's no historical baseline", () => {
    expect(detectFailureSpike(0, 15)).toBe(true);
    expect(detectFailureSpike(0, 2)).toBe(false);
  });
});

describe("workflow execution metrics assembly", () => {
  it("derives the failure rate and level from the raw counts", () => {
    const metrics = buildWorkflowExecutionMetrics({
      workflowName: "OUTREACH_WORKFLOW",
      workflowVersion: 3,
      executionCount: 100,
      successCount: 82,
      failureCount: 18,
      retryCount: 5,
      avgDurationMs: 4000,
      p95DurationMs: 9000,
      stuckCount: 0,
      cancelledCount: 2,
      waitingCount: 1,
      avgApprovalWaitMs: 12000,
    });
    expect(metrics.failureRatePercent).toBe(18);
    expect(metrics.failureRateLevel).toBe("CRITICAL");
  });
});
