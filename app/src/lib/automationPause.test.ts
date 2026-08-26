import { describe, it, expect } from "vitest";
import { recordOperatorOverride, canStartNewAutomatedAction, isAutomationBlocked } from "./automationPause";

describe("operator override", () => {
  it("records a well-formed override", () => {
    const result = recordOperatorOverride({
      action: "APPROVE_OUTREACH",
      reason: "Verified manually with claimant on the phone",
      operator: "operator-1",
      timestamp: "2026-08-26T00:00:00.000Z",
    });
    expect(result.status).toBe("RECORDED");
  });

  it("rejects an override with no reason", () => {
    const result = recordOperatorOverride({
      action: "APPROVE_OUTREACH",
      reason: "",
      operator: "operator-1",
      timestamp: "2026-08-26T00:00:00.000Z",
    });
    expect(result.status).toBe("REJECTED_MISSING_AUTHORIZATION");
  });

  it("rejects an override with no operator", () => {
    const result = recordOperatorOverride({
      action: "APPROVE_OUTREACH",
      reason: "Reason given",
      operator: "",
      timestamp: "2026-08-26T00:00:00.000Z",
    });
    expect(result.status).toBe("REJECTED_MISSING_AUTHORIZATION");
  });
});

describe("global automation state", () => {
  it("permits starting new automated actions only when ACTIVE", () => {
    expect(canStartNewAutomatedAction("AUTOMATION_ACTIVE")).toBe(true);
    expect(canStartNewAutomatedAction("AUTOMATION_PAUSED")).toBe(false);
    expect(canStartNewAutomatedAction("AUTOMATION_EMERGENCY_STOP")).toBe(false);
  });
});

describe("scoped pause checks", () => {
  const activeState = { global: "AUTOMATION_ACTIVE" as const, pausedWorkflowIds: new Set<string>(), pausedCaseIds: new Set<string>() };

  it("blocks everything when the global switch is not ACTIVE", () => {
    const state = { ...activeState, global: "AUTOMATION_PAUSED" as const };
    expect(isAutomationBlocked(state, {})).toBe(true);
  });

  it("blocks a specific workflow that's individually paused, even while global is ACTIVE", () => {
    const state = { ...activeState, pausedWorkflowIds: new Set(["wf-1"]) };
    expect(isAutomationBlocked(state, { workflowId: "wf-1" })).toBe(true);
    expect(isAutomationBlocked(state, { workflowId: "wf-2" })).toBe(false);
  });

  it("blocks a specific case that's individually paused", () => {
    const state = { ...activeState, pausedCaseIds: new Set(["RK-1842"]) };
    expect(isAutomationBlocked(state, { caseId: "RK-1842" })).toBe(true);
    expect(isAutomationBlocked(state, { caseId: "RK-2000" })).toBe(false);
  });

  it("allows action when nothing relevant is paused", () => {
    expect(isAutomationBlocked(activeState, { workflowId: "wf-1", caseId: "RK-1842" })).toBe(false);
  });
});
