// Filing integration monitoring + failure alerts + status
// reconciliation -- doc 12 sections 34-36. PLAN.md P11-12.
//
// "Monitor all filing providers. Track: submissions, successful
// submissions, rejections, pending submissions, API errors, timeouts,
// status polling, webhook failures, provider latency, provider
// availability." / "Detect... filing stuck pending. Example: 20
// filings submitted, 0 status updates for 24 hours ->
// FILING_PROVIDER_ALERT." / "Compare internal filing state against
// external provider state. If inconsistent: create
// FILING_SYNC_EXCEPTION. Do not silently overwrite either state."
//
// Status reconciliation reuses crossSystemSync.ts's
// detectSyncException() (P10-11) -- a filing-status mismatch is
// exactly that generic sync-exception check, not a second mechanism.

export interface FilingProviderCounts {
  submissions: number;
  successfulSubmissions: number;
  rejections: number;
  pendingSubmissions: number;
  apiErrors: number;
  timeouts: number;
  webhookFailures: number;
}

export interface FilingProviderMetrics extends FilingProviderCounts {
  successRatePercent: number | null;
  rejectionRatePercent: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function computeFilingProviderMetrics(counts: FilingProviderCounts): FilingProviderMetrics {
  return {
    ...counts,
    successRatePercent: ratePercent(counts.successfulSubmissions, counts.submissions),
    rejectionRatePercent: ratePercent(counts.rejections, counts.submissions),
  };
}

/**
 * Pure: doc 12 §35's own worked example -- 20 filings submitted, 0
 * status updates in the last 24 hours. A provider that has received
 * submissions but hasn't produced a single status update within the
 * expected window is flagged, regardless of how many filings are
 * involved.
 */
export function detectNoStatusUpdateAlert(
  submissionsAwaitingUpdate: number,
  lastStatusUpdateAt: string | undefined,
  now: string,
  maxNoUpdateMs: number
): boolean {
  if (submissionsAwaitingUpdate <= 0) return false;
  if (!lastStatusUpdateAt) return true;
  return new Date(now).getTime() - new Date(lastStatusUpdateAt).getTime() > maxNoUpdateMs;
}

export { detectSyncException as detectFilingSyncException } from "./crossSystemSync";
