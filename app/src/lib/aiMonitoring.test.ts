import { describe, it, expect } from "vitest";
import { computeAiRequestMetrics, validateAiStructuredOutput, AI_FAILURE_TYPES } from "./aiMonitoring";

describe("AI request metrics", () => {
  it("computes success/failure/timeout rates", () => {
    const metrics = computeAiRequestMetrics({ requests: 1000, successes: 980, failures: 20, timeouts: 5 });
    expect(metrics.successRatePercent).toBe(98);
    expect(metrics.failureRatePercent).toBe(2);
    expect(metrics.timeoutRatePercent).toBe(0.5);
  });
});

describe("AI structured output validation", () => {
  const expectation = { requiredFields: ["classification", "confidence", "reasoning_summary"], confidenceField: "confidence" };

  it("matches the doc's own worked example -- a well-formed response is VALID", () => {
    const result = validateAiStructuredOutput(
      { classification: "MATCH", confidence: 0.94, reasoning_summary: "..." },
      expectation
    );
    expect(result.status).toBe("VALID");
  });

  it("flags AI_OUTPUT_INVALID when confidence is missing", () => {
    const result = validateAiStructuredOutput({ classification: "MATCH", reasoning_summary: "..." }, expectation);
    expect(result.status).toBe("AI_OUTPUT_INVALID");
    expect(result.issues.some((i) => i.issue === "MISSING_FIELD" && i.field === "confidence")).toBe(true);
  });

  it("flags AI_OUTPUT_INVALID when confidence is out of the 0-1 range", () => {
    const result = validateAiStructuredOutput(
      { classification: "MATCH", confidence: 1.5, reasoning_summary: "..." },
      expectation
    );
    expect(result.status).toBe("AI_OUTPUT_INVALID");
    expect(result.issues.some((i) => i.issue === "INVALID_CONFIDENCE")).toBe(true);
  });

  it("collects every missing field, not just the first", () => {
    const result = validateAiStructuredOutput({}, expectation);
    expect(result.issues.filter((i) => i.issue === "MISSING_FIELD")).toHaveLength(3);
  });
});

describe("AI failure type catalog", () => {
  it("includes every doc-listed failure type", () => {
    expect(AI_FAILURE_TYPES).toContain("PROVIDER_UNAVAILABLE");
    expect(AI_FAILURE_TYPES).toContain("COST_THRESHOLD_EXCEEDED");
    expect(AI_FAILURE_TYPES).toHaveLength(10);
  });
});
