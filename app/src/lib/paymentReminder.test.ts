import { describe, it, expect } from "vitest";
import { determinePaymentReminderStage, planPaymentReminder, type PaymentReminderStopConditions } from "./paymentReminder";

function stopConditions(overrides: Partial<PaymentReminderStopConditions> = {}): PaymentReminderStopConditions {
  return {
    invoicePaid: false,
    invoiceVoided: false,
    paymentArrangementEstablished: false,
    disputeOpened: false,
    operatorDisabledReminders: false,
    caseClosed: false,
    ...overrides,
  };
}

describe("payment reminder stage determination", () => {
  it("is BEFORE_DUE ahead of the due date", () => {
    expect(determinePaymentReminderStage(-3)).toBe("BEFORE_DUE");
  });

  it("is DUE_TODAY on and shortly after the due date", () => {
    expect(determinePaymentReminderStage(0)).toBe("DUE_TODAY");
    expect(determinePaymentReminderStage(5)).toBe("DUE_TODAY");
  });

  it("escalates through the 7/14/30-day overdue stages", () => {
    expect(determinePaymentReminderStage(7)).toBe("OVERDUE_7_DAYS");
    expect(determinePaymentReminderStage(14)).toBe("OVERDUE_14_DAYS");
    expect(determinePaymentReminderStage(30)).toBe("OVERDUE_30_DAYS");
  });
});

describe("payment reminder planning", () => {
  it("sends when nothing stops it", () => {
    const plan = planPaymentReminder({ daysPastDue: 7, stopConditions: stopConditions(), alreadySentForStage: false });
    expect(plan).toEqual({ action: "SEND", stage: "OVERDUE_7_DAYS" });
  });

  it("stops once the invoice is paid, even mid-overdue-sequence", () => {
    const plan = planPaymentReminder({ daysPastDue: 14, stopConditions: stopConditions({ invoicePaid: true }), alreadySentForStage: false });
    expect(plan.action).toBe("STOP");
  });

  it("stops on a dispute", () => {
    const plan = planPaymentReminder({ daysPastDue: 7, stopConditions: stopConditions({ disputeOpened: true }), alreadySentForStage: false });
    expect(plan.action).toBe("STOP");
  });

  it("never sends a duplicate reminder for the same stage", () => {
    const plan = planPaymentReminder({ daysPastDue: 7, stopConditions: stopConditions(), alreadySentForStage: true });
    expect(plan.action).toBe("ALREADY_SENT");
  });

  it("a stop condition wins even over an already-sent reminder", () => {
    const plan = planPaymentReminder({ daysPastDue: 30, stopConditions: stopConditions({ caseClosed: true }), alreadySentForStage: true });
    expect(plan.action).toBe("STOP");
  });
});
