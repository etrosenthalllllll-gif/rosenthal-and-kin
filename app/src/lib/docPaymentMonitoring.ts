// Document/OCR + payment monitoring -- doc 12 sections 37-38.
// PLAN.md P11-13.
//
// "Track: documents queued, OCR processing time, OCR failures,
// classification failures, extraction failures, invalid documents,
// processing backlog, provider availability. Detect abnormal failure
// rates." / "Track: payment attempts, successful payments, failed
// payments, pending payments, reconciliation failures, provider
// errors, outstanding invoices, overdue payments. Create alerts for
// reconciliation discrepancies."

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// --- Document/OCR monitoring (doc 12 §37) -----------------------------------

export interface OcrMonitoringCounts {
  queued: number;
  processed: number;
  ocrFailures: number;
  classificationFailures: number;
  extractionFailures: number;
  invalidDocuments: number;
  backlog: number;
}

export interface OcrMonitoringMetrics extends OcrMonitoringCounts {
  failureRatePercent: number | null;
}

export function computeOcrMonitoringMetrics(counts: OcrMonitoringCounts): OcrMonitoringMetrics {
  const totalFailures = counts.ocrFailures + counts.classificationFailures + counts.extractionFailures;
  return { ...counts, failureRatePercent: ratePercent(totalFailures, counts.processed) };
}

// --- Payment monitoring (doc 12 §38) ----------------------------------------

export interface PaymentMonitoringCounts {
  attempts: number;
  successes: number;
  failures: number;
  pending: number;
  reconciliationFailures: number;
  providerErrors: number;
  outstandingInvoices: number;
  overdueInvoices: number;
}

export interface PaymentMonitoringMetrics extends PaymentMonitoringCounts {
  successRatePercent: number | null;
  reconciliationFailureRatePercent: number | null;
}

export function computePaymentMonitoringMetrics(counts: PaymentMonitoringCounts): PaymentMonitoringMetrics {
  return {
    ...counts,
    successRatePercent: ratePercent(counts.successes, counts.attempts),
    reconciliationFailureRatePercent: ratePercent(counts.reconciliationFailures, counts.attempts),
  };
}

/**
 * Pure: doc 12 §38 -- "create alerts for reconciliation
 * discrepancies." Any reconciliation failure at all is worth
 * surfacing (unlike most rate-based checks here, this one doesn't
 * wait for a percentage threshold -- an unreconciled payment is a
 * financial-integrity issue, not routine noise).
 */
export function hasPaymentReconciliationAlert(counts: PaymentMonitoringCounts): boolean {
  return counts.reconciliationFailures > 0;
}
