import { describe, it, expect } from "vitest";
import {
  classifyConfidence,
  actionForConfidenceBand,
  combineRuleAndConfidence,
  evaluateRuleAndConfidence,
  type ConfidenceBandThresholds,
} from "./confidenceGate";

const thresholds: ConfidenceBandThresholds = { highMinPercent: 95, mediumMinPercent: 80 };

describe("confidence band classification", () => {
  it("classifies HIGH at/above the configured high threshold", () => {
    expect(classifyConfidence(96, thresholds)).toBe("HIGH");
    expect(classifyConfidence(95, thresholds)).toBe("HIGH");
  });

  it("classifies MEDIUM between the two thresholds", () => {
    expect(classifyConfidence(85, thresholds)).toBe("MEDIUM");
  });

  it("classifies LOW below the medium threshold", () => {
    expect(classifyConfidence(50, thresholds)).toBe("LOW");
  });

  it("respects a different per-workflow threshold configuration", () => {
    const strict: ConfidenceBandThresholds = { highMinPercent: 99, mediumMinPercent: 90 };
    expect(classifyConfidence(96, strict)).toBe("MEDIUM");
  });
});

describe("default action per band", () => {
  it("maps HIGH/MEDIUM/LOW to the doc's own actions", () => {
    expect(actionForConfidenceBand("HIGH")).toBe("AUTOMATIC_ACTION_PERMITTED");
    expect(actionForConfidenceBand("MEDIUM")).toBe("OPERATOR_REVIEW");
    expect(actionForConfidenceBand("LOW")).toBe("EXCEPTION_QUEUE");
  });
});

describe("rule + confidence combination", () => {
  it("allows automated action only when the rule passed AND confidence is HIGH", () => {
    expect(combineRuleAndConfidence(true, "HIGH")).toBe("AUTOMATED_ACTION_ALLOWED");
  });

  it("requires human review when the rule passed but confidence is MEDIUM or LOW", () => {
    expect(combineRuleAndConfidence(true, "MEDIUM")).toBe("HUMAN_REVIEW_REQUIRED");
    expect(combineRuleAndConfidence(true, "LOW")).toBe("HUMAN_REVIEW_REQUIRED");
  });

  it("blocks on a failed rule even with HIGH confidence -- never overridden", () => {
    expect(combineRuleAndConfidence(false, "HIGH")).toBe("BLOCKED_RULE_FAILED");
  });
});

describe("evaluateRuleAndConfidence convenience wrapper", () => {
  it("derives the band and combined decision from one recommendation record", () => {
    const result = evaluateRuleAndConfidence(
      true,
      { recommendation: "MATCH", confidencePercent: 96, timestamp: "2026-08-26T00:00:00.000Z" },
      thresholds
    );
    expect(result.band).toBe("HIGH");
    expect(result.decision).toBe("AUTOMATED_ACTION_ALLOWED");
  });
});
