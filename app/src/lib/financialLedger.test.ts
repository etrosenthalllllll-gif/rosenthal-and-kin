import { describe, it, expect } from "vitest";
import { createCorrectingTransaction, sumLedgerTransactions, type FinancialTransactionInput } from "./financialLedger";

describe("correcting transaction creation", () => {
  it("creates a new ADJUSTMENT transaction linked back to the original, never editing it", () => {
    const correction = createCorrectingTransaction(
      "txn-1",
      "estate-1",
      500_00,
      "Corrected payment amount",
      "2026-08-26T00:00:00.000Z"
    );
    expect(correction.transactionType).toBe("ADJUSTMENT");
    expect(correction.correctsTransactionId).toBe("txn-1");
    expect(correction.amountCents).toBe(500_00);
  });
});

describe("ledger balance summation", () => {
  it("sums transactions as given, respecting caller-supplied sign", () => {
    const transactions: FinancialTransactionInput[] = [
      { estateId: "e1", transactionType: "PAYMENT_RECEIVED", amountCents: 2_500_00, createdAt: "t1" },
      { estateId: "e1", transactionType: "PAYMENT_REVERSED", amountCents: -2_500_00, createdAt: "t2" },
      { estateId: "e1", transactionType: "PAYMENT_RECEIVED", amountCents: 1_000_00, createdAt: "t3" },
    ];
    expect(sumLedgerTransactions(transactions)).toBe(1_000_00);
  });

  it("returns zero for an empty ledger", () => {
    expect(sumLedgerTransactions([])).toBe(0);
  });
});
