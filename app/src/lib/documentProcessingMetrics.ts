// Document processing observability + analytics -- doc 05 sections 48,
// 49. PLAN.md P4-15.
//
// "Track: Documents received, Processing time, OCR failures,
// Classification failures, Extraction failures, Match failures,
// Validation failures, Review rate, Duplicate rate, Missing-document
// rate, Low-confidence rate. Make failed processing visible to the
// operator/admin." / "Track: Documents per case, Documents by type,
// Processing success rate, Average processing time, Human review
// rate, AI confidence, Extraction accuracy, Duplicate rate,
// Missing-document frequency, Most common document failures, Most
// common validation conflicts."
//
// Same split and same honesty discipline as communicationDashboardMetrics.ts
// (P3-13): computeDocumentProcessingMetrics() is pure rate math,
// divide-by-zero guarded to null; fetchDocumentProcessingMetrics() is a
// thin, untested Prisma wrapper. Scoped down from the doc's full list
// to what the current Document schema can actually answer honestly:
//
// - Per-stage processing time / average processing time: needs
//   stage-transition timestamps this schema doesn't record (only
//   createdAt/updatedAt exist) -- adding fake timing data would violate
//   this project's own "don't fake what doesn't exist upstream"
//   discipline. Revisit if/when the job queue (P0-8) starts recording
//   per-stage timestamps for document processing jobs specifically.
// - OCR/classification/extraction failure rates specifically: those
//   pipelines are blocked (P4-7/P4-8/P4-9), so every document's
//   ocrStatus/classificationStatus/extractionStatus sits at
//   NOT_STARTED -- a "0% failure rate" here would be meaningless, not
//   reassuring, so it's left out rather than reported as a real zero.
// - Extraction accuracy / most-common-failure breakdowns: both need
//   real extraction/operator-correction data (P4-9/P4-50) that doesn't
//   exist yet.
//
// What's left is exactly what the current schema can measure honestly:
// documents received, review rate, duplicate rate, human-verification
// rate, validation-outcome rate, and missing-document rate (via
// documentRequirements.ts's own checklist, not re-derived here).

import type { PrismaClient } from "@prisma/client";

export interface DocumentMetricsCounts {
  totalDocuments: number;
  requiresReview: number;
  confirmedDuplicates: number;
  humanVerified: number;
  validationInvalidOrIncomplete: number;
  validationUncertain: number;
}

export interface DocumentProcessingMetrics extends DocumentMetricsCounts {
  // Percentages, 0-100, or null when there's nothing to divide by --
  // same never-NaN-never-Infinity guarantee as
  // communicationDashboardMetrics.ts.
  reviewRate: number | null;
  duplicateRate: number | null;
  humanVerifiedRate: number | null;
  validationFailureRate: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Pure: turns raw document counts into doc 05 section 49's rates. No DB
 * access -- fully unit-testable.
 */
export function computeDocumentProcessingMetrics(
  counts: DocumentMetricsCounts
): DocumentProcessingMetrics {
  return {
    ...counts,
    reviewRate: ratePercent(counts.requiresReview, counts.totalDocuments),
    duplicateRate: ratePercent(counts.confirmedDuplicates, counts.totalDocuments),
    humanVerifiedRate: ratePercent(counts.humanVerified, counts.totalDocuments),
    validationFailureRate: ratePercent(
      counts.validationInvalidOrIncomplete,
      counts.totalDocuments
    ),
  };
}

/**
 * Fetches the raw counts from live Postgres and computes metrics. Not
 * unit-tested for the same reason fetchDashboardMetrics() isn't --
 * computeDocumentProcessingMetrics() is where the actual logic lives.
 */
export async function fetchDocumentProcessingMetrics(
  db: PrismaClient
): Promise<DocumentProcessingMetrics> {
  const [
    totalDocuments,
    requiresReview,
    confirmedDuplicates,
    humanVerified,
    validationInvalid,
    validationIncomplete,
    validationUncertain,
  ] = await Promise.all([
    db.document.count(),
    db.document.count({ where: { status: "REQUIRES_REVIEW" } }),
    db.document.count({ where: { duplicateStatus: "CONFIRMED_DUPLICATE" } }),
    db.document.count({ where: { verificationStatus: "VERIFIED" } }),
    db.document.count({ where: { validationStatus: "INVALID" } }),
    db.document.count({ where: { validationStatus: "INCOMPLETE" } }),
    db.document.count({ where: { validationStatus: "UNCERTAIN" } }),
  ]);

  return computeDocumentProcessingMetrics({
    totalDocuments,
    requiresReview,
    confirmedDuplicates,
    humanVerified,
    validationInvalidOrIncomplete: validationInvalid + validationIncomplete,
    validationUncertain,
  });
}
