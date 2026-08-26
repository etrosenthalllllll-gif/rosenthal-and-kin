import { describe, it, expect } from "vitest";
import {
  getActionRiskLevel,
  requiresHumanApprovalRegardlessOfConfidence,
  evaluateOrchestrationSafety,
} from "./orchestrationRisk";

describe("action risk levels", () => {
  it("matches the doc's own worked examples", () => {
    expect(getActionRiskLevel("DRAFT_EMAIL")).toBe("LOW");
    expect(getActionRiskLevel("SEND_EMAIL")).toBe("MEDIUM");
    expect(getActionRiskLevel("SUBMIT_CLAIM")).toBe("HIGH");
    expect(getActionRiskLevel("DISTRIBUTE_FUNDS")).toBe("CRITICAL");
    expect(getActionRiskLevel("CLOSE_CASE")).toBe("HIGH");
  });

  it("fails closed to CRITICAL for an action type it's never seen", () => {
    expect(getActionRiskLevel("SOMETHING_NEW")).toBe("CRITICAL");
  });
});

describe("high-risk approval requirement", () => {
  it("requires human approval for HIGH and CRITICAL regardless of confidence", () => {
    expect(requiresHumanApprovalRegardlessOfConfidence("HIGH")).toBe(true);
    expect(requiresHumanApprovalRegardlessOfConfidence("CRITICAL")).toBe(true);
  });

  it("does not require it for LOW/MEDIUM", () => {
    expect(requiresHumanApprovalRegardlessOfConfidence("LOW")).toBe(false);
    expect(requiresHumanApprovalRegardlessOfConfidence("MEDIUM")).toBe(false);
  });
});

describe("combined orchestration safety decision", () => {
  it("allows automation for a LOW-risk action with AUTOMATED_ACTION_ALLOWED", () => {
    expect(evaluateOrchestrationSafety("LOW", "AUTOMATED_ACTION_ALLOWED")).toBe("AUTOMATED_ACTION_ALLOWED");
  });

  it("downgrades a HIGH-risk action to human approval even when confidence alone would allow it", () => {
    expect(evaluateOrchestrationSafety("HIGH", "AUTOMATED_ACTION_ALLOWED")).toBe("HUMAN_APPROVAL_REQUIRED");
  });

  it("downgrades a CRITICAL-risk action to human approval even when confidence alone would allow it", () => {
    expect(evaluateOrchestrationSafety("CRITICAL", "AUTOMATED_ACTION_ALLOWED")).toBe("HUMAN_APPROVAL_REQUIRED");
  });

  it("stays BLOCKED_RULE_FAILED regardless of risk level -- risk never overrides a rule failure", () => {
    expect(evaluateOrchestrationSafety("LOW", "BLOCKED_RULE_FAILED")).toBe("BLOCKED_RULE_FAILED");
  });
});
