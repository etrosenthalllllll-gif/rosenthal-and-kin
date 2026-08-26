// Payment disputes + escalation + communications -- doc 10 sections
// 40-42. PLAN.md P9-12.
//
// "When payment is disputed, stop automated collection reminders where
// appropriate. Payment communications should be generated from
// approved templates, using amounts directly from the ledger/
// calculation system -- do not allow AI to invent financial amounts."
//
// Governs the schema's PaymentDispute model (P9-12).

export type PaymentDisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESPONDED" | "RESOLVED" | "ESCALATED" | "CLOSED";

// doc 10 section 41: collection reminders stop while a dispute is
// actively open in any unresolved state -- only RESOLVED/CLOSED let
// them resume (or rather, become moot, since resolution should already
// have settled the balance one way or another).
const ACTIVE_DISPUTE_STATUSES: ReadonlySet<PaymentDisputeStatus> = new Set([
  "OPEN",
  "UNDER_REVIEW",
  "RESPONDED",
  "ESCALATED",
]);

export function shouldStopCollectionReminders(status: PaymentDisputeStatus): boolean {
  return ACTIVE_DISPUTE_STATUSES.has(status);
}

// doc 10 section 42's own template-type list, verbatim.
export type PaymentCommunicationTemplateType =
  | "INVOICE_ISSUED"
  | "PAYMENT_RECEIVED"
  | "PARTIAL_PAYMENT"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_FAILED"
  | "PAYMENT_RECONCILIATION_REQUIRED"
  | "PAYMENT_DISPUTED";

export interface PaymentCommunicationContext {
  templateType: PaymentCommunicationTemplateType;
  invoiceNumber: string;
  // Always the actual current ledger balance -- required, not
  // optional, so there's no code path that renders a communication
  // without a real figure. Never an AI-invented amount.
  currentBalanceCents: number;
  dueDate?: string;
}

const TEMPLATE_LABELS: Record<PaymentCommunicationTemplateType, string> = {
  INVOICE_ISSUED: "Invoice Issued",
  PAYMENT_RECEIVED: "Payment Received",
  PARTIAL_PAYMENT: "Partial Payment Received",
  PAYMENT_DUE: "Payment Due",
  PAYMENT_OVERDUE: "Payment Overdue",
  PAYMENT_FAILED: "Payment Failed",
  PAYMENT_RECONCILIATION_REQUIRED: "Payment Reconciliation Required",
  PAYMENT_DISPUTED: "Payment Disputed",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Pure: doc 10 section 42. Builds payment-communication content
 * directly from the supplied ledger balance -- the only amount this
 * function can ever render is the one the caller explicitly passed in,
 * so there's no path for a fabricated figure to slip through.
 */
export function buildPaymentCommunicationContent(context: PaymentCommunicationContext): string {
  const lines = [
    TEMPLATE_LABELS[context.templateType],
    `Invoice: ${context.invoiceNumber}`,
    `Balance: ${formatCents(context.currentBalanceCents)}`,
  ];
  if (context.dueDate) lines.push(`Due: ${context.dueDate}`);
  return lines.join("\n");
}
