import { describe, it, expect } from "vitest";
import {
  matchPaymentToInvoice,
  requiresReconciliationQueue,
  checkDuplicatePayment,
  type IncomingPayment,
  type OpenInvoiceReference,
} from "./paymentMatching";

const INVOICE: OpenInvoiceReference = {
  invoiceId: "inv-1",
  invoiceNumber: "INV-0001",
  outstandingBalanceCents: 2_500_00,
  payer: "Jane Doe",
};

describe("payment matching", () => {
  it("matches exactly when the amount equals the outstanding balance", () => {
    const result = matchPaymentToInvoice({ invoiceIdHint: "inv-1", amountCents: 2_500_00, date: "2026-08-26" }, [INVOICE]);
    expect(result.state).toBe("MATCHED");
  });

  it("is UNMATCHED with no invoice hint, never guessed by amount alone", () => {
    const result = matchPaymentToInvoice({ amountCents: 2_500_00, date: "2026-08-26" }, [INVOICE]);
    expect(result.state).toBe("UNMATCHED");
    expect(result.invoiceId).toBeNull();
  });

  it("detects an overpayment", () => {
    const result = matchPaymentToInvoice({ invoiceIdHint: "inv-1", amountCents: 3_000_00, date: "2026-08-26" }, [INVOICE]);
    expect(result.state).toBe("OVERPAYMENT");
  });

  it("detects a partial payment", () => {
    const result = matchPaymentToInvoice({ invoiceIdHint: "inv-1", amountCents: 1_000_00, date: "2026-08-26" }, [INVOICE]);
    expect(result.state).toBe("PARTIALLY_MATCHED");
  });

  it("resolves by invoice number too, not just invoice id", () => {
    const result = matchPaymentToInvoice({ invoiceIdHint: "INV-0001", amountCents: 2_500_00, date: "2026-08-26" }, [INVOICE]);
    expect(result.state).toBe("MATCHED");
  });
});

describe("reconciliation queue routing", () => {
  it("requires the queue for anything other than a clean match", () => {
    expect(requiresReconciliationQueue({ state: "UNMATCHED", invoiceId: null })).toBe(true);
    expect(requiresReconciliationQueue({ state: "OVERPAYMENT", invoiceId: "inv-1" })).toBe(true);
  });

  it("does not require the queue for a clean MATCHED or PARTIALLY_MATCHED result", () => {
    expect(requiresReconciliationQueue({ state: "MATCHED", invoiceId: "inv-1" })).toBe(false);
    expect(requiresReconciliationQueue({ state: "PARTIALLY_MATCHED", invoiceId: "inv-1" })).toBe(false);
  });
});

describe("duplicate payment detection", () => {
  const existing: IncomingPayment[] = [{ transactionId: "txn-1", amountCents: 2_500_00, date: "2026-08-26", payer: "Jane Doe" }];

  it("flags a matching transaction id as a suspected duplicate", () => {
    const result = checkDuplicatePayment({ transactionId: "txn-1", amountCents: 2_500_00, date: "2026-08-26" }, existing);
    expect(result.isDuplicateSuspected).toBe(true);
  });

  it("flags matching amount+date+payer even with no transaction id", () => {
    const result = checkDuplicatePayment({ amountCents: 2_500_00, date: "2026-08-26", payer: "Jane Doe" }, existing);
    expect(result.isDuplicateSuspected).toBe(true);
  });

  it("does not flag a genuinely different payment", () => {
    const result = checkDuplicatePayment({ transactionId: "txn-2", amountCents: 500_00, date: "2026-08-27", payer: "John Smith" }, existing);
    expect(result.isDuplicateSuspected).toBe(false);
  });
});
