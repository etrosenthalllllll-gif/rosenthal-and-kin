import { describe, it, expect } from "vitest";
import { canAccessMonitoringApi, detectRepeatedFailurePattern, buildSecurityEventAuditEntry } from "./monitoringSecurity";

describe("monitoring API permission gating", () => {
  it("matches doc 12 §79's three-tier example: Operator can view but not configure", () => {
    expect(canAccessMonitoringApi("OPERATOR", "VIEW")).toBe(true);
    expect(canAccessMonitoringApi("OPERATOR", "CONFIGURE")).toBe(false);
  });

  it("Reviewer (Manager tier) can view and resolve, but not configure or execute remediation", () => {
    expect(canAccessMonitoringApi("REVIEWER", "VIEW")).toBe(true);
    expect(canAccessMonitoringApi("REVIEWER", "RESOLVE")).toBe(true);
    expect(canAccessMonitoringApi("REVIEWER", "CONFIGURE")).toBe(false);
    expect(canAccessMonitoringApi("REVIEWER", "EXECUTE_REMEDIATION")).toBe(false);
  });

  it("Admin can do everything", () => {
    expect(canAccessMonitoringApi("ADMIN", "SUPPRESS")).toBe(true);
    expect(canAccessMonitoringApi("ADMIN", "CONFIGURE")).toBe(true);
    expect(canAccessMonitoringApi("ADMIN", "EXECUTE_REMEDIATION")).toBe(true);
  });

  it("Read-only can access nothing monitoring-related", () => {
    expect(canAccessMonitoringApi("READ_ONLY", "VIEW")).toBe(false);
  });
});

describe("repeated failure pattern detection", () => {
  it("flags at or above the configured threshold", () => {
    expect(detectRepeatedFailurePattern(5)).toBe(true);
    expect(detectRepeatedFailurePattern(4)).toBe(false);
  });
});

describe("security event audit mapping", () => {
  it("maps onto audit.ts's existing AuditEventInput shape", () => {
    const entry = buildSecurityEventAuditEntry({
      eventType: "REPEATED_AUTH_FAILURE",
      actor: "unknown",
      resource: "/api/login",
      detail: { attempts: 6 },
    });
    expect(entry.entityType).toBe("SecurityEvent");
    expect(entry.eventType).toBe("REPEATED_AUTH_FAILURE");
    expect(entry.actorUserId).toBe("unknown");
  });
});
