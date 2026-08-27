import { describe, it, expect } from "vitest";
import { buildCaseAutomationHealthPanel, evaluateCaseAttentionRequired } from "./caseLevelMonitoring";

describe("case automation health panel", () => {
  it("assembles all of the doc's own required fields", () => {
    const panel = buildCaseAutomationHealthPanel({
      caseId: "RK-1842",
      currentWorkflow: "Claim preparation",
      currentStep: "Document validation",
      pendingApproval: true,
      pendingExternalAction: false,
      slaStatus: "WITHIN_SLA",
      potentiallyStuck: false,
      recentErrors: [],
      recentAlerts: [],
    });
    expect(panel.pendingApproval).toBe(true);
    expect(panel.slaStatus).toBe("WITHIN_SLA");
  });
});

const noTriggers = {
  noStateChange: false,
  workflowWaitingTooLong: false,
  providerNotResponded: false,
  requiredDocumentMissing: false,
  approvalNotOccurred: false,
  scheduledActionMissed: false,
  syncFailed: false,
};

describe("CASE_ATTENTION_REQUIRED evaluation", () => {
  it("returns no triggers when everything is normal", () => {
    expect(evaluateCaseAttentionRequired(noTriggers)).toEqual([]);
  });

  it("collects every fired trigger, not just the first", () => {
    const triggers = evaluateCaseAttentionRequired({
      ...noTriggers,
      workflowWaitingTooLong: true,
      requiredDocumentMissing: true,
    });
    expect(triggers).toEqual(["WORKFLOW_WAITING_TOO_LONG", "REQUIRED_DOCUMENT_MISSING"]);
  });
});
