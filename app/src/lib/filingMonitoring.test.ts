import { describe, it, expect } from "vitest";
import { computeFilingProviderMetrics, detectNoStatusUpdateAlert, detectFilingSyncException } from "./filingMonitoring";

describe("filing provider metrics", () => {
  it("computes success and rejection rates", () => {
    const metrics = computeFilingProviderMetrics({
      submissions: 100,
      successfulSubmissions: 90,
      rejections: 10,
      pendingSubmissions: 5,
      apiErrors: 1,
      timeouts: 0,
      webhookFailures: 0,
    });
    expect(metrics.successRatePercent).toBe(90);
    expect(metrics.rejectionRatePercent).toBe(10);
  });
});

describe("no-status-update alert", () => {
  it("matches the doc's own worked example (20 filings, 0 updates for 24h)", () => {
    expect(
      detectNoStatusUpdateAlert(20, "2026-08-25T00:00:00.000Z", "2026-08-26T01:00:00.000Z", 24 * 60 * 60 * 1000)
    ).toBe(true);
  });

  it("is not alerted when there's nothing pending", () => {
    expect(detectNoStatusUpdateAlert(0, undefined, "2026-08-26T01:00:00.000Z", 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("is alerted when there's no status update at all and submissions are awaiting one", () => {
    expect(detectNoStatusUpdateAlert(5, undefined, "2026-08-26T01:00:00.000Z", 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("is not alerted within the window", () => {
    expect(
      detectNoStatusUpdateAlert(20, "2026-08-26T00:00:00.000Z", "2026-08-26T01:00:00.000Z", 24 * 60 * 60 * 1000)
    ).toBe(false);
  });
});

describe("filing status reconciliation", () => {
  it("re-exports crossSystemSync's detectSyncException for filing status comparisons", () => {
    const exception = detectFilingSyncException({
      dataObject: "filingStatus",
      entityId: "f-1",
      internalValue: "SUBMITTED",
      externalValue: "REJECTED",
      internalSystem: "Filing system",
      externalSystem: "Provider",
    });
    expect(exception?.requiresReview).toBe(true);
  });
});
