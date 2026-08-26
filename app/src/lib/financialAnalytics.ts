// Financial analytics + case profitability + recovery forecasting +
// reporting -- doc 10 sections 68-71. PLAN.md P9-19.
//
// "Track: total recoveries, expected recoveries, recovery variance,
// total fees, total invoices, total payments, outstanding balances,
// average days to payment, overdue rate, payment success rate,
// reconciliation rate, distribution completion time, case closure
// time, refunds, disputes, financial exceptions." / "Optionally
// provide an expected recovery pipeline based only on configured case
// data. Clearly label: FORECAST / EXPECTED / CONFIRMED / RECEIVED. Do
// not represent forecasts as actual revenue."
//
// Same split and honesty discipline as documentProcessingMetrics.ts
// (P4-15)/filingAnalytics.ts (P7-18)/postFilingAnalytics.ts (P8-19):
// pure rate math, divide-by-zero guarded to null. Scoped down to what
// Invoice/PaymentDispute/FinancialTransaction can honestly measure
// right now -- distribution-completion-time/case-closure-time need a
// per-stage timestamp history no real case has produced yet, so
// they're left out rather than faked, same reasoning as every other
// metrics module here.

export interface FinancialAnalyticsCounts {
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalReconciliations: number;
  passedReconciliations: number;
}

export interface FinancialAnalyticsMetrics extends FinancialAnalyticsCounts {
  paymentSuccessRate: number | null;
  overdueRate: number | null;
  reconciliationRate: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function computeFinancialAnalyticsMetrics(counts: FinancialAnalyticsCounts): FinancialAnalyticsMetrics {
  return {
    ...counts,
    paymentSuccessRate: ratePercent(counts.paidInvoices, counts.totalInvoices),
    overdueRate: ratePercent(counts.overdueInvoices, counts.totalInvoices),
    reconciliationRate: ratePercent(counts.passedReconciliations, counts.totalReconciliations),
  };
}

export interface InvoicePaymentDates {
  invoiceDate: string;
  paidDate: string;
}

/**
 * Pure: average number of days from invoice to payment, across every
 * invoice that's actually been paid with both dates recorded. Null
 * (not zero) when there's nothing to average yet.
 */
export function computeAverageDaysToPayment(pairs: readonly InvoicePaymentDates[]): number | null {
  if (pairs.length === 0) return null;
  const totalDays = pairs.reduce((sum, p) => {
    const days = (new Date(p.paidDate).getTime() - new Date(p.invoiceDate).getTime()) / (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);
  return Math.round((totalDays / pairs.length) * 10) / 10;
}

// --- Recovery pipeline / forecasting (doc 10 section 70) ----------------

// doc 10 section 70's own label list, verbatim. A forecast is never
// represented as actual revenue -- the type itself keeps these four
// distinct rather than collapsing them into one "amount" field.
export type RecoveryPipelineLabel = "FORECAST" | "EXPECTED" | "CONFIRMED" | "RECEIVED";

export interface RecoveryPipelineEntry {
  label: RecoveryPipelineLabel;
  amountCents: number;
}

export type RecoveryPipelineTotals = Record<RecoveryPipelineLabel, number>;

/**
 * Pure: sums each label's entries independently -- a FORECAST total
 * and a RECEIVED total are never added together into one figure, so a
 * forecast can never masquerade as actual revenue downstream.
 */
export function buildRecoveryPipeline(entries: readonly RecoveryPipelineEntry[]): RecoveryPipelineTotals {
  const totals: RecoveryPipelineTotals = { FORECAST: 0, EXPECTED: 0, CONFIRMED: 0, RECEIVED: 0 };
  for (const entry of entries) {
    totals[entry.label] += entry.amountCents;
  }
  return totals;
}
