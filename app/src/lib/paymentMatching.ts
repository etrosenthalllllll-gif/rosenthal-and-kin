// Payment reconciliation + matching + duplicate detection -- doc 10
// sections 31-34. PLAN.md P9-9.
//
// "Build a reconciliation engine. Compare expected payment against
// actual payment and invoice balance. Match using: invoice ID, payment
// reference, transaction ID, amount, date, payer, case ID. Use
// deterministic matching first. Possible matching states: MATCHED,
// PARTIALLY_MATCHED, UNMATCHED, DUPLICATE, OVERPAYMENT, UNDERPAYMENT,
// UNKNOWN. Unmatched payments must enter a reconciliation queue. Do
// not automatically attach ambiguous payments to a case. Detect
// possible duplicate payments by comparing transaction ID, provider
// reference, amount, date, payer, invoice -- if duplicate suspected,
// create DUPLICATE_PAYMENT_EXCEPTION, require review."
//
// The `IncomingPayment`/`OpenInvoiceReference` shapes here mirror the
// eventual Payment entity (P9-8, blocked on a real payment provider
// account) without requiring it -- this matching/reconciliation logic
// is genuinely independent of which provider eventually supplies the
// real payment feed.

export interface IncomingPayment {
  transactionId?: string;
  providerReference?: string;
  invoiceIdHint?: string;
  amountCents: number;
  date: string;
  payer?: string;
}

export interface OpenInvoiceReference {
  invoiceId: string;
  invoiceNumber: string;
  outstandingBalanceCents: number;
  payer?: string;
}

export type PaymentMatchState = "MATCHED" | "PARTIALLY_MATCHED" | "UNMATCHED" | "OVERPAYMENT" | "UNDERPAYMENT";

export interface PaymentMatchResult {
  state: PaymentMatchState;
  invoiceId: string | null;
}

/**
 * Pure: doc 10 sections 31-32. Deterministic matching first -- an
 * explicit invoice id hint that resolves to a real open invoice wins
 * over any fuzzier signal. No hint, or a hint that doesn't resolve, is
 * UNMATCHED -- never guessed onto a plausible-looking invoice by amount
 * alone.
 */
export function matchPaymentToInvoice(
  payment: IncomingPayment,
  openInvoices: readonly OpenInvoiceReference[]
): PaymentMatchResult {
  const invoice = payment.invoiceIdHint
    ? openInvoices.find((i) => i.invoiceId === payment.invoiceIdHint || i.invoiceNumber === payment.invoiceIdHint)
    : undefined;

  if (!invoice) {
    return { state: "UNMATCHED", invoiceId: null };
  }

  if (payment.amountCents === invoice.outstandingBalanceCents) {
    return { state: "MATCHED", invoiceId: invoice.invoiceId };
  }
  if (payment.amountCents > invoice.outstandingBalanceCents) {
    return { state: "OVERPAYMENT", invoiceId: invoice.invoiceId };
  }
  if (payment.amountCents > 0) {
    return { state: "PARTIALLY_MATCHED", invoiceId: invoice.invoiceId };
  }
  return { state: "UNDERPAYMENT", invoiceId: invoice.invoiceId };
}

/**
 * doc 10 section 33: "Do not automatically attach ambiguous payments
 * to a case." Anything other than a clean MATCHED/PARTIALLY_MATCHED
 * result needs to sit in the reconciliation queue for a human to
 * resolve.
 */
export function requiresReconciliationQueue(result: PaymentMatchResult): boolean {
  return result.state === "UNMATCHED" || result.state === "OVERPAYMENT" || result.state === "UNDERPAYMENT";
}

// --- Duplicate payment detection (doc 10 section 34) --------------------

export interface DuplicatePaymentCheckResult {
  isDuplicateSuspected: boolean;
  matchingPayments: readonly IncomingPayment[];
}

/**
 * Pure: doc 10 section 34. A payment is a suspected duplicate of an
 * existing one when transaction id or provider reference match exactly
 * (the strongest signals), or when amount+date+payer all agree (a
 * weaker but still meaningful combination) -- any match at all
 * requires review, never silently accepted as a second real payment.
 */
export function checkDuplicatePayment(
  incoming: IncomingPayment,
  existingPayments: readonly IncomingPayment[]
): DuplicatePaymentCheckResult {
  const matchingPayments = existingPayments.filter((existing) => {
    if (incoming.transactionId && existing.transactionId === incoming.transactionId) return true;
    if (incoming.providerReference && existing.providerReference === incoming.providerReference) return true;
    return (
      existing.amountCents === incoming.amountCents &&
      existing.date === incoming.date &&
      Boolean(incoming.payer) &&
      existing.payer === incoming.payer
    );
  });

  return { isDuplicateSuspected: matchingPayments.length > 0, matchingPayments };
}
