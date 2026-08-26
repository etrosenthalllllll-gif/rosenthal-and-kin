import { describe, it, expect } from "vitest";
import {
  buildFinancialTotals,
  buildCaseFinancialSummary,
  buildRecoveryTimeline,
  type RecoveryFinancialFigures,
} from "./financialDashboard";

function figures(overrides: Partial<RecoveryFinancialFigures> = {}): RecoveryFinancialFigures {
  return {
    expectedCents: 25_000_00,
    actualCents: 24_850_00,
    feesCents: 2_500_00,
    invoicedCents: 2_500_00,
    paidCents: 2_500_00,
    outstandingCents: 0,
    distributedCents: 22_350_00,
    ...overrides,
  };
}

describe("financial totals", () => {
  it("sums figures across every recovery", () => {
    const totals = buildFinancialTotals({
      recoveries: [figures(), figures({ actualCents: 10_000_00 })],
      unreconciledPaymentsCount: 1,
      overdueInvoicesCount: 2,
      openDisputesCount: 0,
      casesReadyToCloseCount: 1,
    });
    expect(totals.actualCents).toBe(34_850_00);
    expect(totals.unreconciledPaymentsCount).toBe(1);
    expect(totals.overdueInvoicesCount).toBe(2);
  });
});

describe("case financial summary", () => {
  it("is ready to close only when reconciliation PASSes and outstanding is zero", () => {
    const summary = buildCaseFinancialSummary({
      ...figures(),
      estateId: "estate-1",
      reconciliationOutcome: "PASS",
    });
    expect(summary.readyToClose).toBe(true);
    expect(summary.netCents).toBe(22_350_00);
  });

  it("is not ready to close with an outstanding balance, even if reconciliation PASSes", () => {
    const summary = buildCaseFinancialSummary({
      ...figures({ outstandingCents: 500_00 }),
      estateId: "estate-1",
      reconciliationOutcome: "PASS",
    });
    expect(summary.readyToClose).toBe(false);
  });

  it("is not ready to close on a reconciliation exception, even with zero outstanding", () => {
    const summary = buildCaseFinancialSummary({
      ...figures(),
      estateId: "estate-1",
      reconciliationOutcome: "EXCEPTION",
    });
    expect(summary.readyToClose).toBe(false);
  });
});

describe("recovery timeline", () => {
  it("sorts entries chronologically without mutating the input", () => {
    const entries = [
      { date: "2026-09-15", description: "Payment reconciled" },
      { date: "2026-08-25", description: "Recovery expected" },
    ];
    const original = [...entries];
    const timeline = buildRecoveryTimeline(entries);
    expect(timeline[0].description).toBe("Recovery expected");
    expect(entries).toEqual(original);
  });
});
