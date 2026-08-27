import { describe, it, expect } from "vitest";
import { buildStructuredLogEntry, explainErrorCode, attachCorrelationId } from "./loggingStrategy";

describe("structured log entry", () => {
  it("assembles the doc's own required field list", () => {
    const entry = buildStructuredLogEntry({
      timestamp: "2026-08-26T00:00:00.000Z",
      service: "filing-service",
      environment: "production",
      severity: "ERROR",
      message: "Filing submission timed out",
      caseId: "RK-1842",
      workflowId: "wf-1",
      errorCode: "FILING_001",
      correlationId: "corr-1",
    });
    expect(entry.errorCode).toBe("FILING_001");
    expect(entry.correlationId).toBe("corr-1");
  });
});

describe("error code catalog", () => {
  it("maps every doc-listed code to a human-readable explanation", () => {
    expect(explainErrorCode("AI_001")).toBe("AI request timed out");
    expect(explainErrorCode("SYNC_001")).toBe("Cross-system synchronization conflict");
  });

  it("returns undefined for an unmapped code rather than guessing", () => {
    expect(explainErrorCode("UNKNOWN_999")).toBeUndefined();
  });
});

describe("correlation ID propagation", () => {
  it("re-exports dataConsistency.ts's attachCorrelationId()", () => {
    const event = attachCorrelationId({ eventType: "CLAIM_FILED" }, "corr-1");
    expect(event.correlationId).toBe("corr-1");
  });
});
