// Financial dashboard + case financial summary + recovery timeline --
// doc 10 sections 48-50. PLAN.md P9-15.
//
// "Create a central recovery/payment dashboard: total expected
// recovery, total actual recovery, total fees, total invoiced, total
// paid, total outstanding, total distributed, unreconciled payments,
// overdue invoices, open disputes, cases ready to close. Every case
// should have a financial summary. Create chronological financial
// history."
//
// Same pure view-model-builder pattern as communicationTimeline.ts
// (P3-1) -- this module doesn't compute any of the underlying
// recovery/fee/payment figures itself, it only aggregates and sorts
// what earlier modules already produced.

export interface RecoveryFinancialFigures {
  expectedCents: number;
  actualCents: number;
  feesCents: number;
  invoicedCents: number;
  paidCents: number;
  outstandingCents: number;
  distributedCents: number;
}

export interface FinancialTotals extends RecoveryFinancialFigures {
  unreconciledPaymentsCount: number;
  overdueInvoicesCount: number;
  openDisputesCount: number;
  casesReadyToCloseCount: number;
}

export interface FinancialDashboardInputs {
  recoveries: readonly RecoveryFinancialFigures[];
  unreconciledPaymentsCount: number;
  overdueInvoicesCount: number;
  openDisputesCount: number;
  casesReadyToCloseCount: number;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

/**
 * Pure: doc 10 section 48. Aggregates totals across every recovery
 * plus the caller-supplied exception/readiness counts -- doesn't
 * decide any of those individually itself.
 */
export function buildFinancialTotals(inputs: FinancialDashboardInputs): FinancialTotals {
  return {
    expectedCents: sum(inputs.recoveries.map((r) => r.expectedCents)),
    actualCents: sum(inputs.recoveries.map((r) => r.actualCents)),
    feesCents: sum(inputs.recoveries.map((r) => r.feesCents)),
    invoicedCents: sum(inputs.recoveries.map((r) => r.invoicedCents)),
    paidCents: sum(inputs.recoveries.map((r) => r.paidCents)),
    outstandingCents: sum(inputs.recoveries.map((r) => r.outstandingCents)),
    distributedCents: sum(inputs.recoveries.map((r) => r.distributedCents)),
    unreconciledPaymentsCount: inputs.unreconciledPaymentsCount,
    overdueInvoicesCount: inputs.overdueInvoicesCount,
    openDisputesCount: inputs.openDisputesCount,
    casesReadyToCloseCount: inputs.casesReadyToCloseCount,
  };
}

// --- Case financial summary (doc 10 section 49) -------------------------

export interface CaseFinancialSummaryInput extends RecoveryFinancialFigures {
  estateId: string;
  reconciliationOutcome: "PASS" | "EXCEPTION";
}

export interface CaseFinancialSummary extends CaseFinancialSummaryInput {
  netCents: number;
  readyToClose: boolean;
}

/**
 * Pure: doc 10 section 49's own worked example shape. `readyToClose`
 * requires both a clean reconciliation AND a zero outstanding balance
 * -- neither alone is sufficient, matching the doc's own repeated
 * "financial completion != case closure until every condition is
 * satisfied" discipline.
 */
export function buildCaseFinancialSummary(input: CaseFinancialSummaryInput): CaseFinancialSummary {
  return {
    ...input,
    netCents: input.actualCents - input.feesCents,
    readyToClose: input.reconciliationOutcome === "PASS" && input.outstandingCents === 0,
  };
}

// --- Recovery timeline (doc 10 section 50) -------------------------------

export interface RecoveryTimelineEntry {
  date: string;
  description: string;
}

/**
 * Pure: doc 10 section 50. Sorts by date -- pure re-ordering, no
 * mutation of the input array, same "read-only projection" role as
 * communicationTimeline.ts's own builder.
 */
export function buildRecoveryTimeline(entries: readonly RecoveryTimelineEntry[]): RecoveryTimelineEntry[] {
  return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
