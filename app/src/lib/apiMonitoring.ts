// API monitoring + error classification -- doc 12 sections 6-7.
// PLAN.md P11-3.
//
// "Monitor every important API. Track: request count, success count,
// error count, error rate, response time, P50/P95/P99, timeout count,
// rate-limit responses, authentication failures, provider errors.
// Group by: API, endpoint, provider, workflow, case." / "Classify API
// failures: 400/401/403/404/409/429/500/502/503/504/NETWORK_ERROR/
// UNKNOWN. Different errors should have different alert thresholds.
// Do not treat every 400-level response as a system outage."

export type ApiErrorCode =
  | "400_BAD_REQUEST"
  | "401_UNAUTHORIZED"
  | "403_FORBIDDEN"
  | "404_NOT_FOUND"
  | "409_CONFLICT"
  | "429_RATE_LIMIT"
  | "500_SERVER_ERROR"
  | "502_BAD_GATEWAY"
  | "503_UNAVAILABLE"
  | "504_TIMEOUT"
  | "NETWORK_ERROR"
  | "UNKNOWN";

const STATUS_TO_ERROR_CODE: Readonly<Record<number, ApiErrorCode>> = {
  400: "400_BAD_REQUEST",
  401: "401_UNAUTHORIZED",
  403: "403_FORBIDDEN",
  404: "404_NOT_FOUND",
  409: "409_CONFLICT",
  429: "429_RATE_LIMIT",
  500: "500_SERVER_ERROR",
  502: "502_BAD_GATEWAY",
  503: "503_UNAVAILABLE",
  504: "504_TIMEOUT",
};

/**
 * Pure: classifies an HTTP status (or the absence of one, for a
 * request that never got a response at all -> NETWORK_ERROR) into the
 * doc's own code list. A status this table doesn't recognize fails
 * closed to UNKNOWN rather than being silently miscategorized.
 */
export function classifyApiError(httpStatus: number | null): ApiErrorCode {
  if (httpStatus === null) return "NETWORK_ERROR";
  return STATUS_TO_ERROR_CODE[httpStatus] ?? "UNKNOWN";
}

// doc 12 §7's own instruction: "do not treat every 400-level response
// as a system outage." Only the 5xx/NETWORK_ERROR classes represent a
// genuine service-side outage signal; 4xx classes are almost always a
// caller-side or data problem, not evidence the provider is down.
const OUTAGE_CLASS_CODES: ReadonlySet<ApiErrorCode> = new Set([
  "500_SERVER_ERROR",
  "502_BAD_GATEWAY",
  "503_UNAVAILABLE",
  "504_TIMEOUT",
  "NETWORK_ERROR",
]);

export function isOutageClassError(code: ApiErrorCode): boolean {
  return OUTAGE_CLASS_CODES.has(code);
}

// --- API call metrics (doc 12 §6) -------------------------------------------

export interface ApiCallCounts {
  requestCount: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  rateLimitCount: number;
  authFailureCount: number;
  providerErrorCount: number;
}

export interface ApiCallMetrics extends ApiCallCounts {
  successRatePercent: number | null;
  errorRatePercent: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function computeApiCallMetrics(counts: ApiCallCounts): ApiCallMetrics {
  return {
    ...counts,
    successRatePercent: ratePercent(counts.successCount, counts.requestCount),
    errorRatePercent: ratePercent(counts.errorCount, counts.requestCount),
  };
}

// --- Grouping dimensions (doc 12 §6) -----------------------------------------

export interface ApiCallAttribution {
  api: string;
  endpoint?: string;
  provider?: string;
  workflowId?: string;
  caseId?: string;
}

/**
 * Pure: groups a batch of attributed API calls by any one dimension
 * (api/endpoint/provider/workflow/case), summing their counts -- this
 * is the shared grouping primitive every one of the doc's "group by X"
 * requirements reduces to, rather than five separate ad-hoc reducers.
 */
export function groupApiMetricsBy(
  calls: readonly (ApiCallAttribution & ApiCallCounts)[],
  dimension: keyof ApiCallAttribution
): Map<string, ApiCallMetrics> {
  const totals = new Map<string, ApiCallCounts>();
  for (const call of calls) {
    const key = call[dimension];
    if (key === undefined) continue;
    const existing = totals.get(key) ?? {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      rateLimitCount: 0,
      authFailureCount: 0,
      providerErrorCount: 0,
    };
    totals.set(key, {
      requestCount: existing.requestCount + call.requestCount,
      successCount: existing.successCount + call.successCount,
      errorCount: existing.errorCount + call.errorCount,
      timeoutCount: existing.timeoutCount + call.timeoutCount,
      rateLimitCount: existing.rateLimitCount + call.rateLimitCount,
      authFailureCount: existing.authFailureCount + call.authFailureCount,
      providerErrorCount: existing.providerErrorCount + call.providerErrorCount,
    });
  }
  const result = new Map<string, ApiCallMetrics>();
  for (const [key, counts] of totals) {
    result.set(key, computeApiCallMetrics(counts));
  }
  return result;
}
