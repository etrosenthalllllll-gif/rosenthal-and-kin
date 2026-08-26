import { describe, it, expect } from "vitest";
import { classifyApiError, isOutageClassError, computeApiCallMetrics, groupApiMetricsBy } from "./apiMonitoring";

describe("API error classification", () => {
  it("classifies known status codes", () => {
    expect(classifyApiError(429)).toBe("429_RATE_LIMIT");
    expect(classifyApiError(503)).toBe("503_UNAVAILABLE");
  });

  it("classifies a missing status (no response at all) as NETWORK_ERROR", () => {
    expect(classifyApiError(null)).toBe("NETWORK_ERROR");
  });

  it("fails closed to UNKNOWN for an unrecognized status", () => {
    expect(classifyApiError(418)).toBe("UNKNOWN");
  });
});

describe("outage-class distinction", () => {
  it("never treats a 400-level response as an outage signal", () => {
    expect(isOutageClassError("400_BAD_REQUEST")).toBe(false);
    expect(isOutageClassError("404_NOT_FOUND")).toBe(false);
    expect(isOutageClassError("429_RATE_LIMIT")).toBe(false);
  });

  it("treats 5xx and NETWORK_ERROR as outage-class", () => {
    expect(isOutageClassError("503_UNAVAILABLE")).toBe(true);
    expect(isOutageClassError("NETWORK_ERROR")).toBe(true);
  });
});

describe("API call metrics", () => {
  it("computes success/error rates", () => {
    const metrics = computeApiCallMetrics({
      requestCount: 100,
      successCount: 95,
      errorCount: 5,
      timeoutCount: 1,
      rateLimitCount: 0,
      authFailureCount: 0,
      providerErrorCount: 4,
    });
    expect(metrics.successRatePercent).toBe(95);
    expect(metrics.errorRatePercent).toBe(5);
  });
});

describe("grouping by dimension", () => {
  it("sums counts per provider", () => {
    const grouped = groupApiMetricsBy(
      [
        { api: "filing", provider: "ProviderA", requestCount: 100, successCount: 90, errorCount: 10, timeoutCount: 0, rateLimitCount: 0, authFailureCount: 0, providerErrorCount: 10 },
        { api: "filing", provider: "ProviderA", requestCount: 50, successCount: 50, errorCount: 0, timeoutCount: 0, rateLimitCount: 0, authFailureCount: 0, providerErrorCount: 0 },
        { api: "email", provider: "ProviderB", requestCount: 200, successCount: 199, errorCount: 1, timeoutCount: 0, rateLimitCount: 0, authFailureCount: 0, providerErrorCount: 1 },
      ],
      "provider"
    );
    expect(grouped.get("ProviderA")?.requestCount).toBe(150);
    expect(grouped.get("ProviderB")?.requestCount).toBe(200);
  });
});
