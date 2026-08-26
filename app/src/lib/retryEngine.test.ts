import { describe, it, expect } from "vitest";
import { isRetryableFailure, computeRetryDelayMs, planRetry, buildDeadLetterEntry, type RetryPolicy } from "./retryEngine";

describe("failure classification retryability", () => {
  it("treats TRANSIENT/RATE_LIMIT/PROVIDER_ERROR/TIMEOUT as retryable", () => {
    expect(isRetryableFailure("TRANSIENT")).toBe(true);
    expect(isRetryableFailure("RATE_LIMIT")).toBe(true);
    expect(isRetryableFailure("PROVIDER_ERROR")).toBe(true);
    expect(isRetryableFailure("TIMEOUT")).toBe(true);
  });

  it("never retries permanent/data/auth/human-review/unknown failures", () => {
    expect(isRetryableFailure("PERMANENT")).toBe(false);
    expect(isRetryableFailure("DATA_ERROR")).toBe(false);
    expect(isRetryableFailure("AUTH_ERROR")).toBe(false);
    expect(isRetryableFailure("HUMAN_REVIEW_REQUIRED")).toBe(false);
    expect(isRetryableFailure("UNKNOWN")).toBe(false);
  });
});

const policy: RetryPolicy = { maxAttempts: 4, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 60_000 };

describe("exponential backoff", () => {
  it("doubles the delay each attempt", () => {
    expect(computeRetryDelayMs(policy, 1)).toBe(1000);
    expect(computeRetryDelayMs(policy, 2)).toBe(2000);
    expect(computeRetryDelayMs(policy, 3)).toBe(4000);
  });

  it("caps the delay at maxDelayMs", () => {
    expect(computeRetryDelayMs(policy, 10)).toBe(60_000);
  });

  it("adds the caller-supplied jitter deterministically", () => {
    expect(computeRetryDelayMs(policy, 1, 250)).toBe(1250);
  });
});

describe("retry planning", () => {
  it("retries a transient failure within the attempt budget", () => {
    const decision = planRetry("TRANSIENT", policy, 1);
    expect(decision.action).toBe("RETRY");
  });

  it("dead-letters a non-retryable classification immediately, even on the first attempt", () => {
    const decision = planRetry("DATA_ERROR", policy, 0);
    expect(decision.action).toBe("DEAD_LETTER");
  });

  it("dead-letters once max attempts are exhausted, even for a transient failure", () => {
    const decision = planRetry("TRANSIENT", policy, 4);
    expect(decision.action).toBe("DEAD_LETTER");
  });
});

describe("dead-letter entry construction", () => {
  it("builds a visible record rather than silently dropping the failure", () => {
    const entry = buildDeadLetterEntry({
      jobId: "job-1",
      caseId: "RK-1842",
      classification: "DATA_ERROR",
      error: "Missing required field",
      attemptCount: 1,
      now: "2026-08-26T00:00:00.000Z",
    });
    expect(entry.jobId).toBe("job-1");
    expect(entry.classification).toBe("DATA_ERROR");
  });
});
