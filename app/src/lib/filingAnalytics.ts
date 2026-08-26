// Filing analytics -- doc 08 sections 61-63. PLAN.md P7-18 (part 4 of
// 4).
//
// "Track: filings submitted, acceptance rate, rejection rate, average
// processing time, average time to acceptance, rejection reasons,
// resubmission rate, provider errors, payment failures, filing costs,
// duplicate attempts prevented, automation rate, human-review rate."
//
// Same split and same honesty discipline as documentProcessingMetrics.ts
// (P4-15): computeFilingMetrics()/computeAverageAcceptanceDays() are
// pure rate math, divide-by-zero guarded to null;
// fetchFilingMetrics() is a thin, untested Prisma wrapper. Scoped down
// to what the Filing/FilingAttempt schema (P7-1) can actually answer
// honestly right now:
//
// - Provider errors / payment failures / filing costs / duplicate-
//   attempts-prevented / automation rate / human-review rate: each
//   needs data this schema doesn't populate yet (no real filings have
//   ever gone through P7-4's connectors or P7-11's authorization flow)
//   -- reporting a 0% here would be meaningless, not reassuring, so
//   they're left out rather than faked, same reasoning
//   documentProcessingMetrics.ts used for the OCR pipeline.
// - Rejection *reasons* breakdown: needs a real population of
//   classified rejections (filingRejection.ts/P7-16) to be worth
//   aggregating; the acceptance/rejection *rate* math below doesn't
//   depend on that and is included.
//
// What's left is exactly what Filing's own submissionTimestamp/
// acceptanceTimestamp/status fields can measure honestly: filings
// submitted, acceptance rate, rejection rate, resubmission rate, and
// average time from submission to acceptance for filings that actually
// reached ACCEPTED.

import type { PrismaClient } from "@prisma/client";

export interface FilingMetricsCounts {
  totalFilings: number;
  accepted: number;
  rejected: number;
  failed: number;
  // A filing whose currentAttemptNumber is greater than 1 has been
  // resubmitted at least once.
  resubmitted: number;
}

export interface FilingMetrics extends FilingMetricsCounts {
  acceptanceRate: number | null;
  rejectionRate: number | null;
  resubmissionRate: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Pure: doc 08 sections 61-63. No DB access -- fully unit-testable.
 */
export function computeFilingMetrics(counts: FilingMetricsCounts): FilingMetrics {
  return {
    ...counts,
    acceptanceRate: ratePercent(counts.accepted, counts.totalFilings),
    rejectionRate: ratePercent(counts.rejected, counts.totalFilings),
    resubmissionRate: ratePercent(counts.resubmitted, counts.totalFilings),
  };
}

export interface AcceptedFilingTimestamps {
  submissionTimestamp: string;
  acceptanceTimestamp: string;
}

/**
 * Pure: average number of days from submission to acceptance across
 * every filing that actually reached ACCEPTED with both timestamps
 * recorded. Null (not zero) when there's nothing to average --
 * "no data yet" and "zero days" must never look the same.
 */
export function computeAverageAcceptanceDays(pairs: readonly AcceptedFilingTimestamps[]): number | null {
  if (pairs.length === 0) return null;

  const totalDays = pairs.reduce((sum, p) => {
    const days = (new Date(p.acceptanceTimestamp).getTime() - new Date(p.submissionTimestamp).getTime()) / (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);

  return Math.round((totalDays / pairs.length) * 10) / 10;
}

/**
 * Fetches the raw counts/timestamps from live Postgres and computes
 * metrics. Not unit-tested for the same reason
 * fetchDocumentProcessingMetrics() isn't -- the compute functions above
 * are where the actual logic lives.
 */
export async function fetchFilingMetrics(
  db: PrismaClient
): Promise<FilingMetrics & { averageAcceptanceDays: number | null }> {
  const [totalFilings, accepted, rejected, failed, resubmitted, acceptedWithTimestamps] = await Promise.all([
    db.filing.count(),
    db.filing.count({ where: { status: "ACCEPTED" } }),
    db.filing.count({ where: { status: "REJECTED" } }),
    db.filing.count({ where: { status: "FAILED" } }),
    db.filing.count({ where: { currentAttemptNumber: { gt: 1 } } }),
    db.filing.findMany({
      where: { status: "ACCEPTED", submissionTimestamp: { not: null }, acceptanceTimestamp: { not: null } },
      select: { submissionTimestamp: true, acceptanceTimestamp: true },
    }),
  ]);

  const metrics = computeFilingMetrics({ totalFilings, accepted, rejected, failed, resubmitted });

  const averageAcceptanceDays = computeAverageAcceptanceDays(
    acceptedWithTimestamps
      .filter((f) => f.submissionTimestamp && f.acceptanceTimestamp)
      .map((f) => ({
        submissionTimestamp: f.submissionTimestamp!.toISOString(),
        acceptanceTimestamp: f.acceptanceTimestamp!.toISOString(),
      }))
  );

  return { ...metrics, averageAcceptanceDays };
}
