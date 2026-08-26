import { describe, it, expect } from "vitest";
import { evaluateRecoveryVariance } from "./recoveryVariance";

describe("recovery variance evaluation", () => {
  it("is NORMAL when the difference is within the absolute threshold", () => {
    const result = evaluateRecoveryVariance(25_000_00, 24_990_00); // $10 diff
    expect(result.level).toBe("NORMAL");
  });

  it("is REVIEW_OPTIONAL when the difference exceeds the absolute threshold but stays within 1%", () => {
    const result = evaluateRecoveryVariance(25_000_00, 24_800_00); // $200 diff, 0.8%
    expect(result.level).toBe("REVIEW_OPTIONAL");
  });

  it("is OPERATOR_REVIEW beyond 1% but below the mandatory threshold", () => {
    const result = evaluateRecoveryVariance(25_000_00, 24_000_00); // $1000 diff, 4%
    expect(result.level).toBe("OPERATOR_REVIEW");
  });

  it("is MANDATORY_REVIEW at or beyond the configured critical threshold", () => {
    const result = evaluateRecoveryVariance(25_000_00, 20_000_00); // $5000 diff, 20%
    expect(result.level).toBe("MANDATORY_REVIEW");
  });

  it("computes percentDifference as null rather than dividing by zero when nothing was expected", () => {
    const result = evaluateRecoveryVariance(0, 100_00);
    expect(result.percentDifference).toBeNull();
  });

  it("uses caller-supplied thresholds rather than hardcoded defaults", () => {
    const result = evaluateRecoveryVariance(25_000_00, 24_990_00, {
      normalMaxAbsoluteDifferenceCents: 0,
      reviewOptionalMaxPercent: 0,
      mandatoryReviewMinPercent: 100,
    });
    expect(result.level).not.toBe("NORMAL");
  });
});
