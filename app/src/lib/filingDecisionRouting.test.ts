import { describe, it, expect } from "vitest";
import {
  planFilingRejectionDecision,
  planDuplicateFilingDecision,
  planReconciliationDecision,
} from "./filingDecisionRouting";
import { classifyRejection } from "./filingRejection";

describe("filing rejection decision routing", () => {
  it("recommends a decision for a HIGH/CRITICAL rejection", () => {
    const rejection = classifyRejection("MISSING_DOCUMENT", "Missing relationship document");
    const result = planFilingRejectionDecision("filing-1", rejection);
    expect(result?.decisionTypeKey).toBe("REVIEW_FILING_EXCEPTION");
    expect(result?.reason).toContain("Missing relationship document");
  });

  it("returns null for a LOW/MEDIUM rejection", () => {
    const rejection = classifyRejection("TECHNICAL_FAILURE", "Formatting issue");
    expect(planFilingRejectionDecision("filing-1", rejection)).toBeNull();
  });
});

describe("duplicate-filing decision routing", () => {
  it("recommends a decision when a duplicate is possible", () => {
    const result = planDuplicateFilingDecision("filing-1", {
      decision: "PAUSE_REQUIRES_REVIEW",
      existingFilings: [{ filingId: "filing-existing", status: "PROCESSING" }],
    });
    expect(result?.decisionTypeKey).toBe("REVIEW_FILING_EXCEPTION");
    expect(result?.evidenceRefs).toContain("filing-existing");
  });

  it("returns null when no duplicate exists", () => {
    expect(planDuplicateFilingDecision("filing-1", { decision: "PROCEED", existingFilings: [] })).toBeNull();
  });
});

describe("reconciliation decision routing", () => {
  it("recommends a decision on a MISMATCH", () => {
    const result = planReconciliationDecision("filing-1", {
      outcome: "MISMATCH",
      internalStatus: "PROCESSING",
      externalStatus: "ACCEPTED",
    });
    expect(result?.decisionTypeKey).toBe("REVIEW_FILING_EXCEPTION");
    expect(result?.reason).toContain("PROCESSING");
    expect(result?.reason).toContain("ACCEPTED");
  });

  it("returns null on a MATCH", () => {
    expect(
      planReconciliationDecision("filing-1", { outcome: "MATCH", internalStatus: "PROCESSING", externalStatus: "PROCESSING" })
    ).toBeNull();
  });
});
