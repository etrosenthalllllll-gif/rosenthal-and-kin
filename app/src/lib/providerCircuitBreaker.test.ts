import { describe, it, expect } from "vitest";
import {
  nextCircuitStateOnFailure,
  nextCircuitStateOnSuccess,
  shouldMoveToHalfOpen,
  canAttemptRequest,
  computeProviderHealthStatus,
  type CircuitBreakerConfig,
} from "./providerCircuitBreaker";

const config: CircuitBreakerConfig = { failureThreshold: 20, cooldownMs: 60_000 };

describe("circuit breaker failure transitions", () => {
  it("stays CLOSED under the failure threshold", () => {
    expect(nextCircuitStateOnFailure("CLOSED", 5, config)).toBe("CLOSED");
  });

  it("trips to OPEN once the threshold is reached -- the doc's own 20-consecutive-failures example", () => {
    expect(nextCircuitStateOnFailure("CLOSED", 20, config)).toBe("OPEN");
  });

  it("sends a HALF_OPEN test failure straight back to OPEN, never lingering", () => {
    expect(nextCircuitStateOnFailure("HALF_OPEN", 0, config)).toBe("OPEN");
  });
});

describe("circuit breaker success transitions", () => {
  it("closes the circuit on a successful HALF_OPEN test call", () => {
    expect(nextCircuitStateOnSuccess("HALF_OPEN")).toBe("CLOSED");
  });

  it("leaves CLOSED unchanged on success", () => {
    expect(nextCircuitStateOnSuccess("CLOSED")).toBe("CLOSED");
  });

  it("never jumps OPEN straight to CLOSED on a bare success signal", () => {
    expect(nextCircuitStateOnSuccess("OPEN")).toBe("OPEN");
  });
});

describe("cooldown-driven half-open transition", () => {
  it("is not ready before the cooldown elapses", () => {
    expect(shouldMoveToHalfOpen("2026-08-26T00:00:00.000Z", "2026-08-26T00:00:30.000Z", config)).toBe(false);
  });

  it("is ready once the cooldown has elapsed", () => {
    expect(shouldMoveToHalfOpen("2026-08-26T00:00:00.000Z", "2026-08-26T00:02:00.000Z", config)).toBe(true);
  });
});

describe("request gating", () => {
  it("allows requests in CLOSED and HALF_OPEN, blocks in OPEN", () => {
    expect(canAttemptRequest("CLOSED")).toBe(true);
    expect(canAttemptRequest("HALF_OPEN")).toBe(true);
    expect(canAttemptRequest("OPEN")).toBe(false);
  });
});

describe("provider health status", () => {
  it("is UNKNOWN with no observed requests -- never guessed HEALTHY", () => {
    expect(computeProviderHealthStatus(0, 0)).toBe("UNKNOWN");
  });

  it("is HEALTHY under the degraded threshold", () => {
    expect(computeProviderHealthStatus(100, 2)).toBe("HEALTHY");
  });

  it("is DEGRADED between the two thresholds", () => {
    expect(computeProviderHealthStatus(100, 10)).toBe("DEGRADED");
  });

  it("is DOWN at or above the down threshold", () => {
    expect(computeProviderHealthStatus(100, 30)).toBe("DOWN");
  });
});
