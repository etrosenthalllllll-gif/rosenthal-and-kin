// AI monitoring + failure detection + quality validation -- doc 12
// sections 23-25. PLAN.md P11-9.
//
// "Create AI service monitoring. Track: AI requests, successful
// requests, failed requests, timeout rate, latency, token usage,
// cost, model, model version, confidence distribution, empty
// responses, invalid structured output, parsing failures, safety/
// filter failures." / "Detect: provider unavailable, timeout, invalid
// JSON, missing required fields, malformed response, unexpected
// output, low confidence spike, token limit errors, rate limits, cost
// threshold exceeded." / "Do not assume that successful API responses
// mean AI output is valid. Validate structured outputs... If
// confidence missing or classification invalid: mark
// AI_OUTPUT_INVALID."

export interface AiRequestCounts {
  requests: number;
  successes: number;
  failures: number;
  timeouts: number;
}

export interface AiRequestMetrics extends AiRequestCounts {
  successRatePercent: number | null;
  failureRatePercent: number | null;
  timeoutRatePercent: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function computeAiRequestMetrics(counts: AiRequestCounts): AiRequestMetrics {
  return {
    ...counts,
    successRatePercent: ratePercent(counts.successes, counts.requests),
    failureRatePercent: ratePercent(counts.failures, counts.requests),
    timeoutRatePercent: ratePercent(counts.timeouts, counts.requests),
  };
}

// --- AI failure classification (doc 12 §24) ---------------------------------

export type AiFailureType =
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_JSON"
  | "MISSING_REQUIRED_FIELDS"
  | "MALFORMED_RESPONSE"
  | "UNEXPECTED_OUTPUT"
  | "LOW_CONFIDENCE_SPIKE"
  | "TOKEN_LIMIT_ERROR"
  | "RATE_LIMIT"
  | "COST_THRESHOLD_EXCEEDED";

// doc 12 §24's own list, exposed as a constant for callers that need
// to validate/display the full set rather than re-typing it.
export const AI_FAILURE_TYPES: readonly AiFailureType[] = [
  "PROVIDER_UNAVAILABLE",
  "TIMEOUT",
  "INVALID_JSON",
  "MISSING_REQUIRED_FIELDS",
  "MALFORMED_RESPONSE",
  "UNEXPECTED_OUTPUT",
  "LOW_CONFIDENCE_SPIKE",
  "TOKEN_LIMIT_ERROR",
  "RATE_LIMIT",
  "COST_THRESHOLD_EXCEEDED",
];

// --- AI output quality validation (doc 12 §25) ------------------------------

export interface AiStructuredOutputExpectation {
  requiredFields: readonly string[];
  confidenceField?: string;
}

export type AiOutputValidationIssue = "MISSING_FIELD" | "INVALID_CONFIDENCE";

export interface AiOutputValidationResult {
  status: "VALID" | "AI_OUTPUT_INVALID";
  issues: Array<{ issue: AiOutputValidationIssue; field: string }>;
}

/**
 * Pure: doc 12 §25's own worked example -- expects
 * {classification, confidence: 0.0-1.0, reasoning_summary}. A
 * successful API call is never assumed to mean valid output; every
 * missing required field and an out-of-range/non-numeric confidence
 * value are both collected (not just the first) into AI_OUTPUT_INVALID.
 */
export function validateAiStructuredOutput(
  response: Record<string, unknown>,
  expectation: AiStructuredOutputExpectation
): AiOutputValidationResult {
  const issues: Array<{ issue: AiOutputValidationIssue; field: string }> = [];

  for (const field of expectation.requiredFields) {
    if (response[field] === undefined || response[field] === null) {
      issues.push({ issue: "MISSING_FIELD", field });
    }
  }

  if (expectation.confidenceField) {
    const value = response[expectation.confidenceField];
    if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
      issues.push({ issue: "INVALID_CONFIDENCE", field: expectation.confidenceField });
    }
  }

  return { status: issues.length === 0 ? "VALID" : "AI_OUTPUT_INVALID", issues };
}
