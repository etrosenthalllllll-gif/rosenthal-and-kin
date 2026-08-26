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
});
