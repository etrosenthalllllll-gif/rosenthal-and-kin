// Payment reversal + refunds -- doc 10 sections 35-36. PLAN.md P9-10.
//
// "If payment is reversed, preserve the original payment; create a
// PaymentReversal; update the outstanding balance. Do not delete the
// original payment record. Support refund tracking -- never erase
// original payment history."
//
// Same plain-interface approach as paymentMatching.ts (P9-9): mirrors
// the eventual Payment entity (P9-8, blocked) without depending on it.
// Both reversal and refund functions return a *new* record referencing
// the original by id -- neither ever mutates or removes the original.

export interface ReversalRecord {
  originalPaymentId: string;
  amountCents: number;
  reason?: string;
  createdAt: string;
}

/**
 * Pure: doc 10 section 35. Always returns a new ReversalRecord
 * pointing back at the original payment -- the caller never deletes or
 * edits the original row, only adds this alongside it.
 */
export function createPaymentReversal(
  originalPaymentId: string,
  amountCents: number,
  reason: string | undefined,
  createdAt: string
): ReversalRecord {
  return { originalPaymentId, amountCents, reason, createdAt };
}

export interface RefundRecord {
  originalPaymentId: string;
  amountCents: number;
  reason: string;
  approvedBy: string;
  createdAt: string;
}

/**
 * Pure: doc 10 section 36. `reason` and `approvedBy` are both
 * required (non-optional) fields -- a refund always carries its own
 * authorization, never issued anonymously or without a stated reason.
 */
export function createRefund(
  originalPaymentId: string,
  amountCents: number,
  reason: string,
  approvedBy: string,
  createdAt: string
): RefundRecord {
  return { originalPaymentId, amountCents, reason, approvedBy, createdAt };
}

export interface OutstandingBalanceInputs {
  totalInvoicedCents: number;
  paymentsCents: readonly number[];
  reversalsCents: readonly number[];
  refundsCents: readonly number[];
  creditsCents: readonly number[];
}

function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/**
 * Pure: doc 10 sections 35-37. The outstanding balance is always
 * reproduced from the full transaction history -- never a
 * hand-editable field. A reversal or refund reduces the effective
 * payment total rather than being subtracted from a separately-tracked
 * "balance" number, so there's exactly one source of truth.
 */
export function recalculateOutstandingBalance(inputs: OutstandingBalanceInputs): number {
  const netPaid = sum(inputs.paymentsCents) - sum(inputs.reversalsCents) - sum(inputs.refundsCents);
  return inputs.totalInvoicedCents - netPaid - sum(inputs.creditsCents);
}
