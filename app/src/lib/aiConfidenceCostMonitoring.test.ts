import { describe, it, expect } from "vitest";
import { detectConfidenceAnomaly, compareModelVersions, evaluateAiDailyCostAlert } from "./aiConfidenceCostMonitoring";

describe("AI confidence anomaly detection", () => {
  it("matches the doc's own worked example (92% -> 64%)", () => {
    expect(detectConfidenceAnomaly(92, 64)).toBe(true);
  });

  it("does not flag a minor fluctuation", () => {
    expect(detectConfidenceAnomaly(92, 90)).toBe(false);
  });
});

describe("model version comparison", () => {
  it("matches the doc's own worked example, ranked highest-confidence first", () => {
    const comparison = compareModelVersions([
      { modelVersion: "v2", avgConfidencePercent: 78 },
      { modelVersion: "v1", avgConfidencePercent: 92 },
    ]);
    expect(comparison.map((c) => c.modelVersion)).toEqual(["v1", "v2"]);
  });
});

describe("AI daily cost alert", () => {
  it("delegates to automationLimits.ts's cost-limit check", () => {
    expect(evaluateAiDailyCostAlert(10_000, 10_000)).toBe("PAUSE_AND_REQUEST_REVIEW");
    expect(evaluateAiDailyCostAlert(9_999, 10_000)).toBe("WITHIN_LIMIT");
  });
});
