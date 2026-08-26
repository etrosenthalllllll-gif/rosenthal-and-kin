import { describe, it, expect } from "vitest";
import { buildAutomationControlCenterSummary, buildCaseAutomationPanel, OPERATOR_APPROVAL_FLOW } from "./automationControlCenter";

describe("automation control center summary", () => {
  it("assembles all of the doc's own top-level metrics", () => {
    const summary = buildAutomationControlCenterSummary({
      activeWorkflows: 12,
      waitingApprovals: 3,
      failedJobs: 1,
      retrying: 2,
      deadLetterJobs: 0,
      syncExceptions: 1,
      staleWorkflows: 0,
      criticalAlerts: 0,
      scheduledJobs: 40,
      automationSuccessRate: 96.5,
      humanInterventionRate: 12,
    });
    expect(summary.activeWorkflows).toBe(12);
    expect(summary.automationSuccessRate).toBe(96.5);
  });
});

describe("case automation panel", () => {
  it("matches the doc's own worked example fields", () => {
    const panel = buildCaseAutomationPanel({
      automationStatus: "ACTIVE",
      currentWorkflow: "Claim preparation",
      currentStep: "Document validation",
      waitingFor: "Operator approval",
      nextAction: "Generate claim package",
      confidencePercent: 96,
      lastEvent: "Document validation completed",
    });
    expect(panel.currentWorkflow).toBe("Claim preparation");
    expect(panel.lastError).toBeUndefined();
  });
});

describe("one-click operator approval flow", () => {
  it("follows the doc's own worked-example order", () => {
    expect(OPERATOR_APPROVAL_FLOW).toEqual([
      "EXECUTE_ACTION",
      "RECORD_DECISION",
      "VERIFY_RESULT",
      "ADVANCE_WORKFLOW",
      "CREATE_NEXT_TASK",
      "UPDATE_CASE_STATE",
      "LOG_EVENT",
    ]);
  });
});
