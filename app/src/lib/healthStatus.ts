// Health status model + health check system -- doc 12 sections 2-4.
// PLAN.md P11-1.
//
// "Create standardized health statuses: HEALTHY, DEGRADED, DOWN,
// UNKNOWN, MAINTENANCE. Each system should have: current status, last
// successful check, last failure, failure count, failure rate,
// response time, error rate, availability, last updated timestamp." /
// "Build configurable health checks. Types: LIVENESS, READINESS,
// DEPENDENCY, FUNCTIONAL, INTEGRATION. A basic health check should
// answer 'is the service alive?' A functional check should answer
// 'can the service actually perform the operation it is supposed to
// perform?'"

export type HealthStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "UNKNOWN" | "MAINTENANCE";

export type HealthCheckType = "LIVENESS" | "READINESS" | "DEPENDENCY" | "FUNCTIONAL" | "INTEGRATION";

export interface HealthStatusThresholds {
  degradedErrorRatePercent: number;
  downErrorRatePercent: number;
}

// Illustrative defaults, overridable per component -- same
// "configurable, never hardcoded" discipline as
// providerCircuitBreaker.ts's DEFAULT_PROVIDER_HEALTH_THRESHOLDS.
export const DEFAULT_HEALTH_THRESHOLDS: HealthStatusThresholds = {
  degradedErrorRatePercent: 5,
  downErrorRatePercent: 25,
};

/**
 * Pure: MAINTENANCE always wins (an operator's explicit declaration
 * outranks any computed signal -- doc 12 §54 relies on this to
 * distinguish planned downtime from a real outage). With zero checks
 * observed, UNKNOWN (never guessed HEALTHY). Otherwise classifies by
 * error rate against configurable thresholds.
 */
export function resolveHealthStatus(
  input: { inMaintenance: boolean; totalChecks: number; failedChecks: number },
  thresholds: HealthStatusThresholds = DEFAULT_HEALTH_THRESHOLDS
): HealthStatus {
  if (input.inMaintenance) return "MAINTENANCE";
  if (input.totalChecks <= 0) return "UNKNOWN";
  const errorRatePercent = (input.failedChecks / input.totalChecks) * 100;
  if (errorRatePercent >= thresholds.downErrorRatePercent) return "DOWN";
  if (errorRatePercent >= thresholds.degradedErrorRatePercent) return "DEGRADED";
  return "HEALTHY";
}

export interface SystemHealthRecord {
  component: string;
  status: HealthStatus;
  lastSuccessfulCheck?: string;
  lastFailure?: string;
  failureCount: number;
  failureRatePercent: number | null;
  responseTimeMs?: number;
  errorRatePercent: number | null;
  availabilityPercent: number | null;
  lastUpdated: string;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Pure: assembles the doc's own per-system field list. Rates are
 * divide-by-zero guarded to null, same discipline as every metrics
 * module in this codebase.
 */
export function buildSystemHealthRecord(params: {
  component: string;
  inMaintenance: boolean;
  totalChecks: number;
  failedChecks: number;
  lastSuccessfulCheck?: string;
  lastFailure?: string;
  responseTimeMs?: number;
  now: string;
  thresholds?: HealthStatusThresholds;
}): SystemHealthRecord {
  const status = resolveHealthStatus(params, params.thresholds);
  return {
    component: params.component,
    status,
    lastSuccessfulCheck: params.lastSuccessfulCheck,
    lastFailure: params.lastFailure,
    failureCount: params.failedChecks,
    failureRatePercent: ratePercent(params.failedChecks, params.totalChecks),
    responseTimeMs: params.responseTimeMs,
    errorRatePercent: ratePercent(params.failedChecks, params.totalChecks),
    availabilityPercent: ratePercent(params.totalChecks - params.failedChecks, params.totalChecks),
    lastUpdated: params.now,
  };
}

// --- Health check types (doc 12 §4) -----------------------------------------

export const HEALTH_CHECK_TYPES: readonly HealthCheckType[] = [
  "LIVENESS",
  "READINESS",
  "DEPENDENCY",
  "FUNCTIONAL",
  "INTEGRATION",
];

/**
 * doc 12 §4's own distinction, made explicit rather than left as
 * convention: LIVENESS/READINESS/DEPENDENCY only answer "is it up,"
 * FUNCTIONAL/INTEGRATION answer "can it actually do its job."
 */
export function isFunctionalHealthCheck(type: HealthCheckType): boolean {
  return type === "FUNCTIONAL" || type === "INTEGRATION";
}
