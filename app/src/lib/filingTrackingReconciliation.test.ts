import { describe, it, expect } from "vitest";
import {
  shouldStopPolling,
  nextPollDelayMinutes,
  planNextStatusCheck,
  isDuplicateWebhookEvent,
  reconcileFilingStatus,
  shouldCreateReconciliationException,
  classifyProviderCheckOutcome,
} from "./filingTrackingReconciliation";

describe("polling schedule", () => {
  it("stops polling once ACCEPTED, REJECTED, or CLOSED", () => {
    expect(shouldStopPolling("ACCEPTED")).toBe(true);
    expect(shouldStopPolling("REJECTED")).toBe(true);
    expect(shouldStopPolling("CLOSED")).toBe(true);
    expect(shouldStopPolling("PROCESSING")).toBe(false);
  });

  it("follows the configured immediate/1hr/6hr/24hr schedule", () => {
    expect(nextPollDelayMinutes(0)).toBe(0);
    expect(nextPollDelayMinutes(1)).toBe(60);
    expect(nextPollDelayMinutes(2)).toBe(360);
    expect(nextPollDelayMinutes(3)).toBe(1440);
  });

  it("falls back to the configured interval once the schedule is exhausted", () => {
    expect(nextPollDelayMinutes(10)).toBe(1440);
  });

  it("never polls a connector with webhook support", () => {
    const plan = planNextStatusCheck("PROCESSING", 0, true);
    expect(plan.shouldPoll).toBe(false);
  });

  it("polls a webhook-less connector until a stop-polling status is reached", () => {
    const active = planNextStatusCheck("PROCESSING", 1, false);
    expect(active.shouldPoll).toBe(true);
    expect(active.delayMinutes).toBe(60);

    const stopped = planNextStatusCheck("ACCEPTED", 2, false);
    expect(stopped.shouldPoll).toBe(false);
  });
});

describe("webhook idempotency", () => {
  it("flags a previously-seen event id as a duplicate", () => {
    expect(isDuplicateWebhookEvent("evt-1", new Set(["evt-1"]))).toBe(true);
    expect(isDuplicateWebhookEvent("evt-2", new Set(["evt-1"]))).toBe(false);
  });
});

describe("reconciliation", () => {
  it("reports MATCH when internal and external status agree", () => {
    const result = reconcileFilingStatus("PROCESSING", "PROCESSING");
    expect(result.outcome).toBe("MATCH");
    expect(shouldCreateReconciliationException(result)).toBe(false);
  });

  it("reports MISMATCH rather than assuming agreement, and flags an exception", () => {
    const result = reconcileFilingStatus("PROCESSING", "ACCEPTED");
    expect(result.outcome).toBe("MISMATCH");
    expect(shouldCreateReconciliationException(result)).toBe(true);
  });
});

describe("provider outage classification", () => {
  it("is CHECKED when the check succeeded", () => {
    expect(classifyProviderCheckOutcome(true)).toBe("CHECKED");
  });

  it("is PROVIDER_UNAVAILABLE rather than silently treated as unchanged", () => {
    expect(classifyProviderCheckOutcome(false)).toBe("PROVIDER_UNAVAILABLE");
  });
});
