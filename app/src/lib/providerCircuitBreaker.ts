// Circuit breaker + provider health -- doc 11 sections 88-90. PLAN.md
// P10-22.
//
// "IF: provider returns unexpected response across 20 consecutive
// executions THEN: pause workflow, create critical alert, require
// operator review. Do not allow a broken integration to repeatedly
// perform bad actions." / "Implement circuit breakers for external
// services. States: CLOSED, OPEN, HALF_OPEN. If a provider repeatedly
// fails: OPEN. Stop requests temporarily. After cooldown: HALF_OPEN.
// Test limited request. If successful: CLOSED." / Provider health:
// HEALTHY, DEGRADED, DOWN, UNKNOWN.

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold: number; // doc 11 §88's own example: 20 consecutive failures
  cooldownMs: number;
}

/**
 * Pure: doc 11 §89's transition on a failed call. CLOSED trips to OPEN
 * once consecutiveFailures reaches the threshold; a HALF_OPEN test
 * call failing sends it straight back to OPEN (never lingers in
 * HALF_OPEN on failure).
 */
export function nextCircuitStateOnFailure(
  state: CircuitState,
  consecutiveFailures: number,
  config: CircuitBreakerConfig
): CircuitState {
  if (state === "HALF_OPEN") return "OPEN";
  return consecutiveFailures >= config.failureThreshold ? "OPEN" : state;
}

/**
 * Pure: a successful call only closes the circuit from HALF_OPEN
 * (doc 11 §89 -- "test limited request, if successful: CLOSED"). A
 * CLOSED circuit staying CLOSED on success is a no-op; an OPEN circuit
 * cannot go straight to CLOSED without passing through HALF_OPEN
 * first (it must wait out its cooldown).
 */
export function nextCircuitStateOnSuccess(state: CircuitState): CircuitState {
  return state === "HALF_OPEN" ? "CLOSED" : state;
}

/**
 * Pure: doc 11 §89 -- once an OPEN circuit's cooldown has elapsed, it
 * moves to HALF_OPEN to allow one test request through. Never skips
 * straight to CLOSED.
 */
export function shouldMoveToHalfOpen(openedAt: string, now: string, config: CircuitBreakerConfig): boolean {
  return new Date(now).getTime() - new Date(openedAt).getTime() >= config.cooldownMs;
}

/**
 * Pure: doc 11 §89's "stop requests temporarily" -- a new request may
 * be attempted in CLOSED or HALF_OPEN (the latter being the one
 * allowed test call), never in OPEN.
 */
export function canAttemptRequest(state: CircuitState): boolean {
  return state !== "OPEN";
}

// --- Provider health (doc 11 §90) -------------------------------------------

export type ProviderHealthStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN";

export interface ProviderHealthThresholds {
  degradedErrorRatePercent: number;
  downErrorRatePercent: number;
}

// doc 11 doesn't specify exact percentages -- illustrative defaults,
// overridable per provider the same way confidenceGate.ts's bands are.
export const DEFAULT_PROVIDER_HEALTH_THRESHOLDS: ProviderHealthThresholds = {
  degradedErrorRatePercent: 5,
  downErrorRatePercent: 25,
};

/**
 * Pure: no requests observed yet -> UNKNOWN (never guessed HEALTHY).
 * Otherwise classifies by error rate against configurable thresholds.
 */
export function computeProviderHealthStatus(
  totalRequests: number,
  failedRequests: number,
  thresholds: ProviderHealthThresholds = DEFAULT_PROVIDER_HEALTH_THRESHOLDS
): ProviderHealthStatus {
  if (totalRequests <= 0) return "UNKNOWN";
  const errorRatePercent = (failedRequests / totalRequests) * 100;
  if (errorRatePercent >= thresholds.downErrorRatePercent) return "DOWN";
  if (errorRatePercent >= thresholds.degradedErrorRatePercent) return "DEGRADED";
  return "HEALTHY";
}
