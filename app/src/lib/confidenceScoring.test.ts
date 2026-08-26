import { describe, it, expect } from "vitest";
import { computeConfidenceScore } from "./confidenceScoring";

describe("computeConfidenceScore", () => {
  it("returns 0 when no components are supplied, never NaN", () => {
    const result = computeConfidenceScore({});
    expect(result.score).toBe(0);
    expect(result.components).toEqual([]);
  });

  it("reproduces doc 06 section 18's own worked example closely", () => {
    const result = computeConfidenceScore(
      {
        identityMatch: 0.97,
        documentConfidence: 0.99,
        extractionConfidence: 0.96,
        sourceQuality: 0.92,
        crossSourceAgreement: 1.0,
      },
      0.0
    );
    // Not asserting the exact doc value (0.95) since the doc doesn't
    // give its precise weighting formula -- asserting it lands in the
    // same high-confidence neighborhood the doc's example does.
    expect(result.score).toBeGreaterThan(0.9);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it("only weights components that were actually supplied -- never confidence = document count", () => {
    const single = computeConfidenceScore({ identityMatch: 0.9 });
    expect(single.score).toBe(0.9);
    expect(single.components).toHaveLength(1);
  });

  it("subtracts the conflict penalty after averaging, never folds it into a weight silently", () => {
    const withoutConflict = computeConfidenceScore({ identityMatch: 0.9, crossSourceAgreement: 0.9 });
    const withConflict = computeConfidenceScore(
      { identityMatch: 0.9, crossSourceAgreement: 0.9 },
      0.3
    );
    expect(withConflict.score).toBeCloseTo(withoutConflict.score - 0.3, 5);
    expect(withConflict.conflictPenalty).toBe(0.3);
  });

  it("clamps the score to [0, 1] even with a large conflict penalty", () => {
    const result = computeConfidenceScore({ identityMatch: 0.2 }, 0.9);
    expect(result.score).toBe(0);
  });

  it("preserves every supplied component with its weight for auditability", () => {
    const result = computeConfidenceScore({ identityMatch: 0.8, sourceQuality: 0.6 });
    expect(result.components).toEqual(
      expect.arrayContaining([
        { key: "identityMatch", value: 0.8, weight: 0.25 },
        { key: "sourceQuality", value: 0.6, weight: 0.15 },
      ])
    );
  });
});
