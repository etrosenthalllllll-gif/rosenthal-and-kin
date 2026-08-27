import { describe, it, expect } from "vitest";
import { computeOcrMonitoringMetrics, computePaymentMonitoringMetrics, hasPaymentReconciliationAlert } from "./docPaymentMonitoring";

describe("OCR monitoring metrics", () => {
  it("computes a combined failure rate across OCR/classification/extraction failures", () => {
    const metrics = computeOcrMonitoringMetrics({
      queued: 10,
      processed: 100,
      ocrFailures: 2,
      classificationFailures: 1,
      extractionFailures: 1,
      invalidDocuments: 0,
      backlog: 5,
    });
    expect(metrics.failureRatePercent).toBe(4);
  });
});

describe("payment monitoring metrics", () => {
  it("computes success and reconciliation-failure rates", () => {
    const metrics = computePaymentMonitoringMetrics({
      attempts: 100,
      successes: 95,
      failures: 5,
      pending: 2,
      reconciliationFailures: 1,
      providerErrors: 0,
      outstandingInvoices: 10,
      overdueInvoices: 2,
    });
    expect(metrics.successRatePercent).toBe(95);
    expect(metrics.reconciliationFailureRatePercent).toBe(1);
  });
});

describe("payment reconciliation alerting", () => {
  it("alerts on any reconciliation failure, not just above a percentage threshold", () => {
    expect(
      hasPaymentReconciliationAlert({
        attempts: 10_000,
        successes: 9999,
        failures: 0,
        pending: 0,
        reconciliationFailures: 1,
        providerErrors: 0,
        outstandingInvoices: 0,
        overdueInvoices: 0,
      })
    ).toBe(true);
  });

  it("does not alert with zero reconciliation failures", () => {
    expect(
      hasPaymentReconciliationAlert({
        attempts: 100,
        successes: 100,
        failures: 0,
        pending: 0,
        reconciliationFailures: 0,
        providerErrors: 0,
        outstandingInvoices: 0,
        overdueInvoices: 0,
      })
    ).toBe(false);
  });
});
