import { describe, it, expect } from "vitest";
import { buildFinancialAuditEntry } from "./financialAudit";

describe("financial audit entry mapping", () => {
  it("maps a financial action onto AuditEventInput's who/what/when/affected-record shape", () => {
    const entry = buildFinancialAuditEntry({
      entityType: "Distribution",
      entityId: "dist-1",
      action: "DISTRIBUTION_APPROVED",
      actorUserId: "operator-1",
      reason: "Recovery verified, fees calculated.",
    });
    expect(entry.entityType).toBe("Distribution");
    expect(entry.entityId).toBe("dist-1");
    expect(entry.eventType).toBe("DISTRIBUTION_APPROVED");
    expect(entry.actorUserId).toBe("operator-1");
    expect(entry.metadata).toEqual({ reason: "Recovery verified, fees calculated." });
  });

  it("omits metadata when no reason is supplied, rather than an empty object", () => {
    const entry = buildFinancialAuditEntry({
      entityType: "Payment",
      entityId: "payment-1",
      action: "PAYMENT_RECORDED",
      actorUserId: "operator-1",
    });
    expect(entry.metadata).toBeUndefined();
  });
});
