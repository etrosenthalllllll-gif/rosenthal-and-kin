// Case-level financial reconciliation + exceptions -- doc 10 sections
// 46-47. PLAN.md P9-14.
//
// "Build case-level reconciliation. Check: expected recovery, actual
// recovery, distribution, fees, invoices, payments, outstanding
// balances. Example: EXPECTED $25,000 / ACTUAL $24,850 / DISTRIBUTED
// $22,350 / FEES $2,500 / INVOICED $2,500 / PAID $2,500 / OUTSTANDING
// $0 -- RECONCILIATION: PASS. Create exceptions for: expected/actual
// mismatch, distribution mismatch, invoice mismatch, payment mismatch,
// duplicate payment, missing payment, overpayment, underpayment,
// reversal, unknown transaction, unsupported currency, missing
// reference. All exceptions should appear in the central decision
// dashboard."
//
// Note doc 10's own worked example has EXPECTED ($25,000) != ACTUAL
// ($24,850) yet still PASSES reconciliation -- that variance is
// recoveryVariance.ts's (P9-3) job, already handled upstream and
// intentionally not re-checked here. What this module verifies is
// internal algebraic consistency *within* the actual/distributed/fee/
// invoice/payment chain: ACTUAL - FEES = DISTRIBUTED, and INVOICED -
// PAID = OUTSTANDING. A mismatch in either is exactly what "the
// numbers don't add up" means, and it's never silently accepted.

export type FinancialReconciliationExceptionType =
  | "EXPECTED_ACTUAL_MISMATCH"
  | "DISTRIBUTION_MISMATCH"
  | "INVOICE_MISMATCH"
  | "PAYMENT_MISMATCH"
  | "DUPLICATE_PAYMENT"
  | "MISSING_PAYMENT"
  | "OVERPAYMENT"
  | "UNDERPAYMENT"
  | "REVERSAL"
  | "UNKNOWN_TRANSACTION"
  | "UNSUPPORTED_CURRENCY"
  | "MISSING_REFERENCE";

export interface FinancialReconciliationInput {
  actualCents: number;
  distributedCents: number;
  feesCents: number;
  invoicedCents: number;
  paidCents: number;
  outstandingCents: number;
}

export type FinancialReconciliationOutcome = "PASS" | "EXCEPTION";

export interface FinancialReconciliationResult {
  outcome: FinancialReconciliationOutcome;
  exceptions: FinancialReconciliationExceptionType[];
}

/**
 * Pure: doc 10 sections 46-47. Verifies the two algebraic invariants
 * that must hold for the numbers to genuinely reconcile, then merges
 * in whatever exceptions other modules already detected (duplicate
 * payments from paymentMatching.ts/P9-9, currency issues from P9-18,
 * etc.) rather than re-deriving those checks here. PASS only when
 * nothing at all is flagged.
 */
export function evaluateFinancialReconciliation(
  input: FinancialReconciliationInput,
  additionalExceptions: readonly FinancialReconciliationExceptionType[] = []
): FinancialReconciliationResult {
  const exceptions: FinancialReconciliationExceptionType[] = [...additionalExceptions];

  if (input.actualCents - input.feesCents !== input.distributedCents) {
    exceptions.push("DISTRIBUTION_MISMATCH");
  }
  if (input.invoicedCents - input.paidCents !== input.outstandingCents) {
    exceptions.push("PAYMENT_MISMATCH");
  }

  return { outcome: exceptions.length === 0 ? "PASS" : "EXCEPTION", exceptions };
}
