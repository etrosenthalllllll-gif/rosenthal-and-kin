import { describe, it, expect } from "vitest";
import {
  computeDocumentProcessingMetrics,
  type DocumentMetricsCounts,
} from "./documentProcessingMetrics";

function counts(overrides: Partial<DocumentMetricsCounts> = {}): DocumentMetricsCounts {
  return {
    totalDocuments: 0,
    requiresReview: 0,
    confirmedDuplicates: 0,
    humanVerified: 0,
    validationInvalidOrIncomplete: 0,
    validationUncertain: 0,
    ...overrides,
  };
}

describe("computeDocumentProcessingMetrics", () => {
  it("returns null for every rate when there are no documents yet, never NaN or Infinity", () => {
    const metrics = computeDocumentProcessingMetrics(counts());
    expect(metrics.reviewRate).toBeNull();
    expect(metrics.duplicateRate).toBeNull();
    expect(metrics.humanVerifiedRate).toBeNull();
    expect(metrics.validationFailureRate).toBeNull();
  });

  it("computes the review rate against total documents", () => {
    const metrics = computeDocumentProcessingMetrics(
      counts({ totalDocuments: 20, requiresReview: 5 })
    );
    expect(metrics.reviewRate).toBe(25);
  });

  it("computes the duplicate rate against total documents", () => {
    const metrics = computeDocumentProcessingMetrics(
      counts({ totalDocuments: 50, confirmedDuplicates: 1 })
    );
    expect(metrics.duplicateRate).toBe(2);
  });

  it("computes the human-verified rate against total documents", () => {
    const metrics = computeDocumentProcessingMetrics(
      counts({ totalDocuments: 10, humanVerified: 3 })
    );
    expect(metrics.humanVerifiedRate).toBe(30);
  });

  it("computes validation-failure rate from invalid+incomplete, not uncertain", () => {
    const metrics = computeDocumentProcessingMetrics(
      counts({ totalDocuments: 10, validationInvalidOrIncomplete: 2, validationUncertain: 5 })
    );
    expect(metrics.validationFailureRate).toBe(20);
  });

  it("rounds to one decimal place", () => {
    const metrics = computeDocumentProcessingMetrics(
      counts({ totalDocuments: 3, requiresReview: 1 })
    );
    expect(metrics.reviewRate).toBe(33.3);
  });

  it("passes the raw counts through unchanged alongside the computed rates", () => {
    const input = counts({ totalDocuments: 7, validationUncertain: 2 });
    const metrics = computeDocumentProcessingMetrics(input);
    expect(metrics.totalDocuments).toBe(7);
    expect(metrics.validationUncertain).toBe(2);
  });
});
