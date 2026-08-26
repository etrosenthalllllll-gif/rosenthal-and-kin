// Invoice model + numbering + generation + delivery -- doc 10 sections
// 21-25. PLAN.md P9-7.
//
// "Create a unique invoice numbering system -- unique, immutable,
// auditable, not reused. Generate an invoice automatically only after
// configured conditions are satisfied: recovery verified -> fee
// calculated -> distribution approved -> invoice generated -> operator
// approval if required -> invoice issued. Do not issue an invoice
// before the underlying financial data is sufficiently verified. Track
// delivery: generated, sent, delivered, failed, opened where
// available."
//
// Governs the schema's Invoice/InvoiceStatus model (P9-7). Uniqueness/
// immutability of the invoice number itself is enforced by the
// schema's `@unique` constraint; this module computes the next
// candidate number and the pre-generation readiness check.

export interface InvoiceNumberingState {
  prefix: string;
  lastIssuedSequence: number;
}

/**
 * Pure: doc 10 section 22. Computes the next sequential invoice number
 * -- the caller's `@unique` DB constraint on `Invoice.invoiceNumber` is
 * what actually guarantees no collision/reuse; this is just the
 * deterministic candidate generator.
 */
export function generateNextInvoiceNumber(state: InvoiceNumberingState): string {
  return `${state.prefix}-${String(state.lastIssuedSequence + 1).padStart(4, "0")}`;
}

export interface InvoiceGenerationReadinessInput {
  recoveryVerified: boolean;
  feeCalculated: boolean;
  distributionApproved: boolean;
}

export interface InvoiceGenerationReadinessResult {
  canGenerate: boolean;
  unmetChecks: string[];
}

const INVOICE_GENERATION_CHECKS: ReadonlyArray<{ key: keyof InvoiceGenerationReadinessInput; detail: string }> = [
  { key: "recoveryVerified", detail: "Recovery has not been verified." },
  { key: "feeCalculated", detail: "Fee has not been calculated." },
  { key: "distributionApproved", detail: "Distribution has not been approved." },
];

/**
 * Pure: doc 10 section 23. An invoice is only generated once every
 * upstream condition is satisfied, in the doc's own order -- never
 * before the underlying financial data is sufficiently verified.
 */
export function evaluateInvoiceGenerationReadiness(
  input: InvoiceGenerationReadinessInput
): InvoiceGenerationReadinessResult {
  const unmetChecks = INVOICE_GENERATION_CHECKS.filter((c) => !input[c.key]).map((c) => c.detail);
  return { canGenerate: unmetChecks.length === 0, unmetChecks };
}

// --- Invoice delivery tracking (doc 10 section 25) ----------------------

// doc 10 section 25's own delivery-state list, verbatim. Deliberately
// no helper functions here beyond the type itself -- each transition
// (GENERATED -> SENT -> DELIVERED/FAILED, optionally -> OPENED) is a
// direct, explicit status write by the caller, same "SENT is never
// assumed to mean DELIVERED" discipline as postFilingNotification.ts
// (P8-10), which does warrant helper functions because it also tracks
// provenance alongside the status; here there's no additional
// provenance shape to combine it with.
export type InvoiceDeliveryStatus = "GENERATED" | "SENT" | "DELIVERED" | "FAILED" | "OPENED";

export function isInvoiceConfirmedDelivered(status: InvoiceDeliveryStatus): boolean {
  return status === "DELIVERED" || status === "OPENED";
}
