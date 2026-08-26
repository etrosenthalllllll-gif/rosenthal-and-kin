import { describe, it, expect } from "vitest";
import {
  computeFinancialAnalyticsMetrics,
  computeAverageDaysToPayment,
  buildRecoveryPipeline,
} from "./financialAnalytics";

describe("financial analytics metrics", () => {
  it("computes payment success, overdue, and reconciliation rates", () => {
    const metrics = computeFinancialAnalyticsMetrics({
      totalInvoices: 10,
      paidInvoices: 8,
      overdueInvoices: 1,
      totalReconciliations: 5,
      passedReconciliations: 4,
    });
    expect(metrics.paymentSuccessRate).toBe(80);
    expect(metrics.overdueRate).toBe(10);
    expect(metrics.reconciliationRate).toBe(80);
  });

  it("returns null rates rather than dividing by zero", () => {
    const metrics = computeFinancialAnalyticsMetrics({
      totalInvoices: 0,
      paidInvoices: 0,
      overdueInvoices: 0,
      totalReconciliations: 0,
      passedReconciliations: 0,
    });
    expect(metrics.paymentSuccessRate).toBeNull();
    expect(metrics.reconciliationRate).toBeNull();
  });
});

describe("average days to payment", () => {
  it("computes the average across paid invoices", () => {
    const result = computeAverageDaysToPayment([
      { invoiceDate: "2026-08-01T00:00:00.000Z", paidDate: "2026-08-11T00:00:00.000Z" },
      { invoiceDate: "2026-08-05T00:00:00.000Z", paidDate: "2026-08-25T00:00:00.000Z" },
    ]);
    expect(result).toBe(15); // (10 + 20) / 2
  });

  it("returns null (not zero) when nothing has been paid yet", () => {
    expect(computeAverageDaysToPayment([])).toBeNull();
  });
});

describe("recovery pipeline / forecasting", () => {
  it("keeps FORECAST and RECEIVED totals independent -- never combined", () => {
    const totals = buildRecoveryPipeline([
      { label: "FORECAST", amountCents: 100_000_00 },
      { label: "RECEIVED", amountCents: 24_850_00 },
    ]);
    expect(totals.FORECAST).toBe(100_000_00);
    expect(totals.RECEIVED).toBe(24_850_00);
  });

  it("sums multiple entries within the same label", () => {
    const totals = buildRecoveryPipeline([
      { label: "EXPECTED", amountCents: 10_000_00 },
      { label: "EXPECTED", amountCents: 15_000_00 },
    ]);
    expect(totals.EXPECTED).toBe(25_000_00);
  });

  it("starts every label at zero even with no entries at all", () => {
    const totals = buildRecoveryPipeline([]);
    expect(totals).toEqual({ FORECAST: 0, EXPECTED: 0, CONFIRMED: 0, RECEIVED: 0 });
  });
});
