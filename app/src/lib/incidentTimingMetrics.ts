// Mean time to detection + mean time to resolution -- doc 12 sections
// 67-68. PLAN.md P11-23.
//
// "Track MTTD: Mean Time To Detection. Example: provider outage began
// 10:00, detected 10:02, MTTD: 2 minutes." / "Track MTTR: Mean Time To
// Resolution. Example: incident 10:00, resolved 10:45, MTTR: 45
// minutes."

export function computeDetectionTimeMs(issueStartedAt: string, detectedAt: string): number {
  return new Date(detectedAt).getTime() - new Date(issueStartedAt).getTime();
}

export function computeResolutionTimeMs(incidentStartedAt: string, resolvedAt: string): number {
  return new Date(resolvedAt).getTime() - new Date(incidentStartedAt).getTime();
}

/**
 * Pure: mean across a batch of individual detection/resolution times
 * -- null (not zero) when there's nothing to average, same discipline
 * as every other averaging function in this codebase
 * (financialAnalytics.ts's computeAverageDaysToPayment(), etc.).
 */
export function computeMeanTimeMs(individualTimesMs: readonly number[]): number | null {
  if (individualTimesMs.length === 0) return null;
  return individualTimesMs.reduce((sum, t) => sum + t, 0) / individualTimesMs.length;
}
