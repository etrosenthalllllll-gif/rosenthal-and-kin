import { describe, it, expect } from "vitest";
import { checkAuthenticatedActor, buildAutomationAuditEntry } from "./automationAudit";

describe("authenticated actor check", () => {
  it("rejects a missing actor -- no anonymous automation", () => {
    expect(checkAuthenticatedActor(undefined).authenticated).toBe(false);
    expect(checkAuthenticatedActor(null).authenticated).toBe(false);
    expect(checkAuthenticatedActor("").authenticated).toBe(false);
    expect(checkAuthenticatedActor("   ").authenticated).toBe(false);
  });

  it("accepts a real actor identity", () => {
    const result = checkAuthenticatedActor("automation-service");
    expect(result.authenticated).toBe(true);
  });
});

describe("automation audit entry", () => {
  it("maps onto audit.ts's AuditEventInput shape, folding workflow/permission/result into metadata", () => {
    const entry = buildAutomationAuditEntry({
      workflowId: "wf-1",
      caseId: "RK-1842",
      action: "SEND_EMAIL",
      actor: "automation-service",
      permission: "SEND_OUTREACH",
      result: "SUCCESS",
    });
    expect(entry.entityId).toBe("RK-1842");
    expect(entry.eventType).toBe("SEND_EMAIL");
    expect(entry.actorUserId).toBe("automation-service");
    expect(entry.metadata).toEqual({ workflowId: "wf-1", permission: "SEND_OUTREACH", result: "SUCCESS" });
  });

  it("falls back to workflowId as entityId when no caseId is available", () => {
    const entry = buildAutomationAuditEntry({
      workflowId: "wf-1",
      action: "SCHEDULED_RECONCILIATION",
      actor: "automation-service",
      result: "SUCCESS",
    });
    expect(entry.entityId).toBe("wf-1");
  });
});
