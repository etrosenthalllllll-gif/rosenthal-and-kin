// Outstanding balance engine + payment reminders + stop conditions --
// doc 10 sections 37-39. PLAN.md P9-11.
//
// "Calculate: TOTAL INVOICED - PAYMENTS RECEIVED - CREDITS +
// ADJUSTMENTS = OUTSTANDING BALANCE. Every balance should be
// reproducible from underlying transactions -- do not rely solely on a
// manually editable balance field. Build configurable automated
// reminders: before due date -- friendly reminder; due date -- due
// reminder; 7 days overdue -- follow-up; 14 days overdue --
// escalation; 30 days overdue -- operator review. Stop reminders when:
// invoice paid, invoice voided, payment received, payment arrangement
// established, dispute opened, operator disables reminders, case
// closed. Never continue payment reminders after full payment."
//
// The outstanding-balance half is already `recalculateOutstandingBalance()`
// in paymentReversal.ts (P9-10) -- not duplicated here. This module is
// the reminder-cadence half, same stop-condition-first discipline as
// followUpScheduler.ts (P3-7)/postFilingFollowUp.ts (P8-11).

// doc 10 section 38's own reminder-stage list, verbatim.
export type PaymentReminderStage = "BEFORE_DUE" | "DUE_TODAY" | "OVERDUE_7_DAYS" | "OVERDUE_14_DAYS" | "OVERDUE_30_DAYS";

/**
 * Pure: doc 10 section 38. `daysPastDue` is negative before the due
 * date, 0 on it, positive after. The doc's own example only names
 * distinct stages at 0/7/14/30 days overdue -- anything overdue but
 * short of 7 days stays at DUE_TODAY rather than inventing an
 * unconfigured intermediate stage.
 */
export function determinePaymentReminderStage(daysPastDue: number): PaymentReminderStage {
  if (daysPastDue < 0) return "BEFORE_DUE";
  if (daysPastDue < 7) return "DUE_TODAY";
  if (daysPastDue < 14) return "OVERDUE_7_DAYS";
  if (daysPastDue < 30) return "OVERDUE_14_DAYS";
  return "OVERDUE_30_DAYS";
}

// doc 10 section 39's own stop-condition list, verbatim.
export interface PaymentReminderStopConditions {
  invoicePaid: boolean;
  invoiceVoided: boolean;
  paymentArrangementEstablished: boolean;
  disputeOpened: boolean;
  operatorDisabledReminders: boolean;
  caseClosed: boolean;
}

const STOP_REASONS: Record<keyof PaymentReminderStopConditions, string> = {
  invoicePaid: "Invoice paid -- never continue payment reminders after full payment.",
  invoiceVoided: "Invoice voided.",
  paymentArrangementEstablished: "Payment arrangement established.",
  disputeOpened: "Dispute opened.",
  operatorDisabledReminders: "Operator disabled reminders.",
  caseClosed: "Case closed.",
};

export interface PaymentReminderContext {
  daysPastDue: number;
  stopConditions: PaymentReminderStopConditions;
  alreadySentForStage: boolean;
}

export type PaymentReminderPlan =
  | { action: "STOP"; reason: string }
  | { action: "ALREADY_SENT" }
  | { action: "SEND"; stage: PaymentReminderStage };

/**
 * Pure: doc 10 sections 38-39. Same shape as postFilingFollowUp.ts's
 * (P8-11) planPostFilingFollowUp() -- stop conditions checked first
 * and always win, idempotency (alreadySentForStage) checked next,
 * before ever returning SEND.
 */
export function planPaymentReminder(context: PaymentReminderContext): PaymentReminderPlan {
  for (const [key, triggered] of Object.entries(context.stopConditions) as [
    keyof PaymentReminderStopConditions,
    boolean,
  ][]) {
    if (triggered) {
      return { action: "STOP", reason: STOP_REASONS[key] };
    }
  }

  if (context.alreadySentForStage) {
    return { action: "ALREADY_SENT" };
  }

  return { action: "SEND", stage: determinePaymentReminderStage(context.daysPastDue) };
}
