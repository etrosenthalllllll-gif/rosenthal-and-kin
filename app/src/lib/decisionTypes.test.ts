import { describe, it, expect } from "vitest";
import { getDecisionTypeConfig, isActionAvailable, DECISION_TYPES } from "./decisionTypes";

describe("decision type registry", () => {
  it("returns config for a known decision type", () => {
    const config = getDecisionTypeConfig("APPROVE_OUTREACH");
    expect(config.displayName).toBe("Approve Outreach");
    expect(config.availableActions).toContain("SEND");
  });

  it("throws for an unknown decision type", () => {
    expect(() => getDecisionTypeConfig("NOT_A_REAL_TYPE")).toThrow();
  });

  it("isActionAvailable is true for a configured action", () => {
    expect(isActionAvailable("APPROVE_OUTREACH", "SEND")).toBe(true);
  });

  it("isActionAvailable is false for an action not configured on that type", () => {
    expect(isActionAvailable("APPROVE_OUTREACH", "APPROVE_AND_FILE")).toBe(false);
  });

  it("marks financial/filing/closing decision types as high consequence", () => {
    expect(DECISION_TYPES.APPROVE_CLAIM_PACKAGE.highConsequence).toBe(true);
    expect(DECISION_TYPES.APPROVE_RECOVERY_DISTRIBUTION.highConsequence).toBe(true);
    expect(DECISION_TYPES.CLOSE_CASE.highConsequence).toBe(true);
  });

  it("does not mark routine outreach/document-request types as high consequence", () => {
    expect(DECISION_TYPES.APPROVE_OUTREACH.highConsequence).toBe(false);
    expect(DECISION_TYPES.REQUEST_DOCUMENTS.highConsequence).toBe(false);
  });

  it("requires a comment on every type that inspects evidence before deciding", () => {
    for (const config of Object.values(DECISION_TYPES)) {
      if (config.requiresEvidenceViewed) {
        expect(config.requiresComment).toBe(true);
      }
    }
  });

  it("marks routine workflow decisions as category DECISION", () => {
    expect(DECISION_TYPES.APPROVE_OUTREACH.category).toBe("DECISION");
    expect(DECISION_TYPES.APPROVE_CLAIM_PACKAGE.category).toBe("DECISION");
  });

  it("marks exception-handling types as category EXCEPTION (doc 02 section 12)", () => {
    expect(DECISION_TYPES.RESOLVE_LOW_CONFIDENCE.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.RESOLVE_CONFLICTING_EVIDENCE.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.RESOLVE_DUPLICATE_CASE.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.RESOLVE_INVALID_DOCUMENT.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.RESOLVE_WORKFLOW_FAILURE.category).toBe("EXCEPTION");
  });

  it("every decision type declares a category", () => {
    for (const config of Object.values(DECISION_TYPES)) {
      expect(["DECISION", "EXCEPTION"]).toContain(config.category);
    }
  });

  it("registers the doc 05 document-intelligence exception types (P4-14)", () => {
    expect(DECISION_TYPES.RESOLVE_AMBIGUOUS_DOCUMENT_MATCH.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.RESOLVE_AMBIGUOUS_DOCUMENT_MATCH.availableActions).toContain(
      "CREATE_NEW_CASE"
    );
    expect(DECISION_TYPES.RESOLVE_DOCUMENT_CONFLICT.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.RESOLVE_DOCUMENT_CONFLICT.availableActions).toContain("RESOLVE");
    expect(DECISION_TYPES.RESOLVE_SUSPECTED_DUPLICATE_DOCUMENT.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.RESOLVE_SUSPECTED_DUPLICATE_DOCUMENT.availableActions).toEqual([
      "KEEP_NEW",
      "KEEP_EXISTING",
      "KEEP_BOTH",
      "ESCALATE",
    ]);
  });

  it("registers the doc 06 verification exception types (P5-10)", () => {
    expect(DECISION_TYPES.RESOLVE_IDENTITY_VERIFICATION.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.RESOLVE_IDENTITY_VERIFICATION.availableActions).toEqual([
      "VERIFY",
      "REJECT",
      "REQUEST_MORE_EVIDENCE",
      "REVISE",
      "ESCALATE",
    ]);
    expect(DECISION_TYPES.RESOLVE_RELATIONSHIP_VERIFICATION.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.REVIEW_COMPETING_HEIR_CANDIDATE.availableActions).toEqual([
      "RESEARCH",
      "VERIFY",
      "RULE_OUT",
      "ESCALATE",
    ]);
  });

  it("registers the doc 07 claim package review exception type (P6-17)", () => {
    expect(DECISION_TYPES.REVIEW_CLAIM_PACKAGE.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.REVIEW_CLAIM_PACKAGE.availableActions).toEqual([
      "APPROVE",
      "REVISE",
      "REJECT",
      "REQUEST_MORE_EVIDENCE",
      "ESCALATE",
    ]);
    expect(DECISION_TYPES.REVIEW_CLAIM_PACKAGE.highConsequence).toBe(true);
  });

  it("registers the doc 08 filing exception type (P7-18)", () => {
    expect(DECISION_TYPES.REVIEW_FILING_EXCEPTION.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.REVIEW_FILING_EXCEPTION.availableActions).toEqual([
      "REQUEST_DOCUMENT",
      "REVISE",
      "REJECT_CLAIM",
      "ESCALATE",
    ]);
  });

  it("registers the doc 09 post-filing exception type (P8-14)", () => {
    expect(DECISION_TYPES.REVIEW_POST_FILING_EXCEPTION.category).toBe("EXCEPTION");
    expect(DECISION_TYPES.REVIEW_POST_FILING_EXCEPTION.availableActions).toEqual([
      "YES",
      "NO",
      "REVISE",
      "ESCALATE",
    ]);
  });
});
