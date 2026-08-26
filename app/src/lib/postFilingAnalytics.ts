// Post-filing analytics + automation analytics -- doc 09 sections
// 68-69. PLAN.md P8-19.
//
// "Track: average time to acceptance, cases currently pending, cases
// with document requests, average document-request resolution time,
// rejection rate, hearing count, deadline completion rate, overdue
// deadlines, escalation rate, claimant response time, number of
// follow-ups, monitoring failures, cases with no update, average time
// from filing to completion." / "Track: percentage monitored
// automatically, percentage requiring human review, number of
// automated status checks, number of automatic notifications, number
// of AI classifications, AI classifications requiring correction,
// number of escalations, number of manual status updates."
//
// Same split and same honesty discipline as documentProcessingMetrics.ts
// (P4-15)/filingAnalytics.ts (P7-18): pure rate math, divide-by-zero
// guarded to null; the Prisma fetch wrapper is thin and untested.
// Scoped down to what the current schema (PostFilingCase/
// DocumentRequest/Hearing/CourtEvent -- all brand-new, no real
// post-filing case has ever gone through the system yet) can actually
// answer honestly right now:
//
// - Average time to acceptance / average time from filing to
//   completion: needs a per-status-transition timestamp history this
//   module could compute from PostFilingEvent (P8-1), but with zero
//   real cases processed so far there's nothing to average -- left for
//   a later pass once real data exists, same reasoning
//   documentProcessingMetrics.ts used for per-stage timing.
// - Automation vs. human-review percentage / AI classification counts:
//   needs data this schema doesn't distinguish yet (no field marking a
//   status check as automated vs. manual, no AI classification log) --
//   reporting a 0% here would be meaningless, not reassuring, so it's
//   left out entirely rather than faked.
//
// What's left is exactly what PostFilingCase/DocumentRequest's own
// status fields can measure honestly: case counts by outcome, and
// document-request resolution.

import type { PrismaClient } from "@prisma/client";

export interface PostFilingCaseMetricsCounts {
  totalCases: number;
  closedCases: number;
  escalatedCases: number;
  onHoldCases: number;
}

export interface PostFilingCaseMetrics extends PostFilingCaseMetricsCounts {
  closureRate: number | null;
  escalationRate: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function computePostFilingCaseMetrics(counts: PostFilingCaseMetricsCounts): PostFilingCaseMetrics {
  return {
    ...counts,
    closureRate: ratePercent(counts.closedCases, counts.totalCases),
    escalationRate: ratePercent(counts.escalatedCases, counts.totalCases),
  };
}

export interface DocumentRequestMetricsCounts {
  totalRequests: number;
  acceptedRequests: number;
  openRequests: number;
}

export interface DocumentRequestMetrics extends DocumentRequestMetricsCounts {
  acceptanceRate: number | null;
}

export function computeDocumentRequestMetrics(counts: DocumentRequestMetricsCounts): DocumentRequestMetrics {
  return { ...counts, acceptanceRate: ratePercent(counts.acceptedRequests, counts.totalRequests) };
}

/**
 * Fetches the raw counts from live Postgres and computes metrics. Not
 * unit-tested for the same reason fetchDocumentProcessingMetrics()
 * isn't -- the compute functions above are where the actual logic
 * lives.
 */
export async function fetchPostFilingAnalytics(
  db: PrismaClient
): Promise<{ cases: PostFilingCaseMetrics; documentRequests: DocumentRequestMetrics }> {
  const [totalCases, closedCases, escalatedCases, onHoldCases, totalRequests, acceptedRequests, openRequests] =
    await Promise.all([
      db.postFilingCase.count(),
      db.postFilingCase.count({ where: { status: "CLOSED" } }),
      db.postFilingCase.count({ where: { status: "ESCALATED" } }),
      db.postFilingCase.count({ where: { status: "ON_HOLD" } }),
      db.documentRequest.count(),
      db.documentRequest.count({ where: { status: "ACCEPTED" } }),
      db.documentRequest.count({
        where: { status: { in: ["REQUESTED", "NOTIFIED", "AWAITING_CLAIMANT", "RECEIVED", "VALIDATING"] } },
      }),
    ]);

  return {
    cases: computePostFilingCaseMetrics({ totalCases, closedCases, escalatedCases, onHoldCases }),
    documentRequests: computeDocumentRequestMetrics({ totalRequests, acceptedRequests, openRequests }),
  };
}
