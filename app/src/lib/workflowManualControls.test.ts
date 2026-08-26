import { describe, it, expect } from "vitest";
import {
  buildDryRunReport,
  canPerformRealAction,
  buildManualExecutionPreview,
  evaluateSkipStep,
  resolveRestartStepIndex,
  buildCancellationConsequences,
} from "./workflowManualControls";

describe("dry-run reporting", () => {
  it("matches the doc's own worked example when everything would proceed automatically", () => {
    const report = buildDryRunReport({ triggerFired: true, ruleAndConfidenceDecision: "AUTOMATED_ACTION_ALLOWED" });
    expect(report).toEqual({ wouldTrigger: true, wouldApprove: true, wouldSend: true, wouldRequireHuman: false });
  });

  it("reports wouldRequireHuman when the rule passed but confidence didn't clear HIGH", () => {
    const report = buildDryRunReport({ triggerFired: true, ruleAndConfidenceDecision: "HUMAN_REVIEW_REQUIRED" });
    expect(report.wouldSend).toBe(false);
    expect(report.wouldRequireHuman).toBe(true);
  });

  it("reports wouldApprove: false when the rule failed", () => {
    const report = buildDryRunReport({ triggerFired: true, ruleAndConfidenceDecision: "BLOCKED_RULE_FAILED" });
    expect(report.wouldApprove).toBe(false);
    expect(report.wouldSend).toBe(false);
  });
});

describe("execution mode gating", () => {
  it("only LIVE mode may perform a real action", () => {
    expect(canPerformRealAction("LIVE")).toBe(true);
    expect(canPerformRealAction("DRY_RUN")).toBe(false);
    expect(canPerformRealAction("TEST")).toBe(false);
  });
});

describe("manual execution preview", () => {
  it("always requires confirmation", () => {
    const preview = buildManualExecutionPreview({
      workflowId: "wf-1",
      workflowVersion: 2,
      inputs: { caseId: "RK-1842" },
      expectedActions: ["SEND_EMAIL"],
    });
    expect(preview.requiresConfirmation).toBe(true);
  });
});

describe("skip step", () => {
  it("requires a reason even for a non-mandatory step", () => {
    const outcome = evaluateSkipStep({ isMandatoryComplianceGate: false, hasElevatedPermission: false, reason: "" });
    expect(outcome.allowed).toBe(false);
  });

  it("allows skipping a non-mandatory step with a reason", () => {
    const outcome = evaluateSkipStep({ isMandatoryComplianceGate: false, hasElevatedPermission: false, reason: "Not needed" });
    expect(outcome.allowed).toBe(true);
  });

  it("never allows skipping a mandatory compliance gate without elevated permission", () => {
    const outcome = evaluateSkipStep({ isMandatoryComplianceGate: true, hasElevatedPermission: false, reason: "Trust me" });
    expect(outcome.allowed).toBe(false);
  });

  it("allows skipping a mandatory compliance gate with elevated permission", () => {
    const outcome = evaluateSkipStep({ isMandatoryComplianceGate: true, hasElevatedPermission: true, reason: "Supervisor approved" });
    expect(outcome.allowed).toBe(true);
  });
});

describe("workflow restart options", () => {
  const params = { failedStepIndex: 4, lastSuccessfulStepIndex: 3 };

  it("resolves RESTART_FROM_BEGINNING to step 0", () => {
    expect(resolveRestartStepIndex("RESTART_FROM_BEGINNING", params)).toBe(0);
  });

  it("resolves RETRY_FAILED_STEP to the failed step's own index", () => {
    expect(resolveRestartStepIndex("RETRY_FAILED_STEP", params)).toBe(4);
  });

  it("resolves RESUME_FROM_LAST_SUCCESSFUL_STEP to the step after the last success", () => {
    expect(resolveRestartStepIndex("RESUME_FROM_LAST_SUCCESSFUL_STEP", params)).toBe(4);
  });
});

describe("cancellation consequences", () => {
  it("packages the required fields for display before cancellation", () => {
    const consequences = buildCancellationConsequences({
      currentStep: "SEND_EMAIL",
      pendingActions: ["SCHEDULE_FOLLOWUP"],
      externalActionsCompleted: ["FILING_SUBMITTED"],
    });
    expect(consequences.externalActionsCompleted).toEqual(["FILING_SUBMITTED"]);
  });
});
