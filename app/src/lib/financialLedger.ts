// Payment confirmation + financial ledger -- doc 10 sections 43-45.
// PLAN.md P9-13.
//
// "When payment is received, create a payment record, update the
// invoice, update case financial state. Build a simple internal
// transaction ledger. Every financial change should create a
// transaction -- do not rely on mutable summary fields as the sole
// financial record. Financial transactions should be append-only. If
// an error occurs, create a correcting transaction -- do not silently
// edit historical financial records."
//
// Governs the schema's FinancialTransaction model (P9-13) -- the
// append-only, create-only discipline is enforced by the schema
// itself (no `updatedAt`); this module is the pure logic for building
// a correcting entry without ever referencing (let alone mutating) the
// original row's own fields.

export type FinancialTransactionType =
  | "RECOVERY_EXPECTED"
  | "RECOVERY_RECEIVED"
  | "FEE_CALCULATED"
  | "INVOICE_ISSUED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_REVERSED"
  | "REFUND_ISSUED"
  | "CREDIT_APPLIED"
  | "ADJUSTMENT"
  | "DISTRIBUTION_PAID";

export interface FinancialTransactionInput {
  estateId: string;
  claimantId?: string;
  recoveryId?: string;
  invoiceId?: string;
  transactionType: FinancialTransactionType;
  amountCents: number;
  description?: string;
  correctsTransactionId?: string;
  createdAt: string;
}

/**
 * Pure: doc 10 section 45. A correction is always a brand-new
 * transaction of type ADJUSTMENT, linked back to the original by id --
 * it never looks at (and therefore can never accidentally carry
 * forward or overwrite) the original transaction's own amount or type.
 * The correcting amount is whatever the caller supplies as the fix
 * (e.g. the delta, or a full reversal followed by the correct entry).
 */
export function createCorrectingTransaction(
  originalTransactionId: string,
  estateId: string,
  correctedAmountCents: number,
  description: string,
  createdAt: string
): FinancialTransactionInput {
  return {
    estateId,
    transactionType: "ADJUSTMENT",
    amountCents: correctedAmountCents,
    description,
    correctsTransactionId: originalTransactionId,
    createdAt,
  };
}

/**
 * Pure: a simple ledger-balance sum over whatever transaction subset
 * the caller supplies (e.g. all transactions for one recovery). Signed
 * amounts are the caller's responsibility (a PAYMENT_REVERSED entry
 * should be stored as a negative amountCents, etc.) -- this function
 * doesn't interpret transaction type, only sums what's given, since
 * inferring sign from type would duplicate a decision the writer
 * already made when creating the transaction.
 */
export function sumLedgerTransactions(transactions: readonly FinancialTransactionInput[]): number {
  return transactions.reduce((total, t) => total + t.amountCents, 0);
}
