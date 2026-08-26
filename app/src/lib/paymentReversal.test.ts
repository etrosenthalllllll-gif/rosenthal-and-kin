import { describe, it, expect } from "vitest";
import { createPaymentReversal, createRefund, recalculateOutstandingBalance } from "./paymentReversal";

describe("payment reversal", () => {
  it("creates a reversal record referencing the original payment, never deleting it", () => {
    const reversal = createPaymentReversal("payment-1", 2_500_00, "Bank reversal", "2026-08-26T00:00:00.000Z");
    expect(reversal.originalPaymentId).toBe("payment-1");
    expect(reversal.amountCents).toBe(2_500_00);
  });
});

describe("refund", () => {
  it("always carries its own authorization -- reason and approvedBy required", () => {
    const refund = createRefund("payment-1", 100_00, "Overpayment", "operator-1", "2026-08-26T00:00:00.000Z");
    expect(refund.reason).toBe("Overpayment");
    expect(refund.approvedBy).toBe("operator-1");
  });
});

describe("outstanding balance recalculation", () => {
  it("reproduces the balance from the full transaction history", () => {
    const balance = recalculateOutstandingBalance({
      totalInvoicedCents: 5_000_00,
      paymentsCents: [2_000_00, 2_000_00],
      reversalsCents: [],
      refundsCents: [],
      creditsCents: [],
    });
    expect(balance).toBe(1_000_00);
  });

  it("accounts for a reversal by restoring the reversed amount to the balance", () => {
    const balance = recalculateOutstandingBalance({
      totalInvoicedCents: 5_000_00,
      paymentsCents: [5_000_00],
      reversalsCents: [5_000_00],
      refundsCents: [],
      creditsCents: [],
    });
    expect(balance).toBe(5_000_00);
  });

  it("accounts for a refund the same way", () => {
    const balance = recalculateOutstandingBalance({
      totalInvoicedCents: 5_000_00,
      paymentsCents: [5_000_00],
      reversalsCents: [],
      refundsCents: [100_00],
      creditsCents: [],
    });
    expect(balance).toBe(100_00);
  });

  it("applies credits directly against the balance", () => {
    const balance = recalculateOutstandingBalance({
      totalInvoicedCents: 5_000_00,
      paymentsCents: [4_500_00],
      reversalsCents: [],
      refundsCents: [],
      creditsCents: [500_00],
    });
    expect(balance).toBe(0);
  });
});
