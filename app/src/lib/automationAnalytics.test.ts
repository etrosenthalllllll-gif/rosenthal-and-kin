import { describe, it, expect } from "vitest";
import {
  computeAutomationHealthScore,
  computeWorkflowInterventionMetrics,
  buildAutomationOutcomeRecord,
  computeOutcomeAgreementRate,
} from "./automationAnalytics";

describe("automation health score", () => {
  it("computes success/failure/retry rates", () => {
    const score = computeAutomationHealthScore({ jobsExecuted: 100, jobsCompleted: 90, jobsFailed: 5, jobsRetried: 12 });
    expect(score.successRate).toBe(90);
    expect(score.failureRate).toBe(5);
    expect(score.retryRate).toBe(12);
  });

  it("returns null rates rather than dividing by zero", () => {
    const score = computeAutomationHealthScore({ jobsExecuted: 0, jobsCompleted: 0, jobsFailed: 0, jobsRetried: 0 });
    expect(score.successRate).toBeNull();
  });
});

describe("workflow intervention metrics", () => {
  it("matches the doc's own worked example", () => {
    const metrics = computeWorkflowInterventionMetrics({
      totalExecutions: 1000,
      fullyAutomated: 820,
      humanAssisted: 150,
      humanBlocked: 0,
      failed: 30,
    });
    expect(metrics.automationRate).toBe(82);
    expect(metrics.humanInterventionRate).toBe(15);
  });

  it("counts human-assisted and human-blocked together in the intervention rate", () => {
    const metrics = computeWorkflowInterventionMetrics({
      totalExecutions: 100,
      fullyAutomated: 70,
      humanAssisted: 20,
      humanBlocked: 10,
      failed: 0,
    });
    expect(metrics.humanInterventionRate).toBe(30);
  });
});

describe("automation quality loop", () => {
  it("marks a record agreed when the recommendation matches the human decision", () => {
    const record = buildAutomationOutcomeRecord({
      recommendation: "APPROVE",
      confidencePercent: 94,
      humanDecision: "APPROVE",
      timestamp: "2026-08-26T00:00:00.000Z",
    });
    expect(record.agreed).toBe(true);
  });

  it("marks a record disagreed on the doc's own worked example (APPROVE vs REJECT)", () => {
    const record = buildAutomationOutcomeRecord({
      recommendation: "APPROVE",
      confidencePercent: 94,
      humanDecision: "REJECT",
      reason: "Incorrect relationship",
      timestamp: "2026-08-26T00:00:00.000Z",
    });
    expect(record.agreed).toBe(false);
  });

  it("computes the aggregate agreement rate across a batch of records", () => {
    const records = [
      buildAutomationOutcomeRecord({ recommendation: "APPROVE", confidencePercent: 90, humanDecision: "APPROVE", timestamp: "t" }),
      buildAutomationOutcomeRecord({ recommendation: "APPROVE", confidencePercent: 90, humanDecision: "REJECT", timestamp: "t" }),
    ];
    expect(computeOutcomeAgreementRate(records)).toBe(50);
  });

  it("returns null for an empty batch rather than dividing by zero", () => {
    expect(computeOutcomeAgreementRate([])).toBeNull();
  });
});
