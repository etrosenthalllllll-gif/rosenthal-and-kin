import { describe, it, expect } from "vitest";
import { shouldStopCollectionReminders, buildPaymentCommunicationContent } from "./paymentDispute";

describe("collection reminder suppression on dispute", () => {
  it("stops reminders while a dispute is open", () => {
    expect(shouldStopCollectionReminders("OPEN")).toBe(true);
    expect(shouldStopCollectionReminders("UNDER_REVIEW")).toBe(true);
    expect(shouldStopCollectionReminders("ESCALATED")).toBe(true);
  });

  it("does not suppress reminders once resolved or closed", () => {
    expect(shouldStopCollectionReminders("RESOLVED")).toBe(false);
    expect(shouldStopCollectionReminders("CLOSED")).toBe(false);
  });
});

describe("payment communication content", () => {
  it("renders the exact ledger balance supplied, never inventing an amount", () => {
    const content = buildPaymentCommunicationContent({
      templateType: "PAYMENT_OVERDUE",
      invoiceNumber: "INV-0004",
      currentBalanceCents: 500_00,
    });
    expect(content).toContain("INV-0004");
    expect(content).toContain("$500.00");
    expect(content).toContain("Payment Overdue");
  });

  it("includes the due date only when supplied", () => {
    const withDate = buildPaymentCommunicationContent({
      templateType: "PAYMENT_DUE",
      invoiceNumber: "INV-0005",
      currentBalanceCents: 100_00,
      dueDate: "2026-09-01",
    });
    expect(withDate).toContain("Due: 2026-09-01");

    const withoutDate = buildPaymentCommunicationContent({
      templateType: "PAYMENT_DUE",
      invoiceNumber: "INV-0005",
      currentBalanceCents: 100_00,
    });
    expect(withoutDate).not.toContain("Due:");
  });
});
