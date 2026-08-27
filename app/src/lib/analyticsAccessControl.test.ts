import { describe, it, expect } from "vitest";
import { authorizeAnalyticsAccess, verifyMetricAuditTrail } from "./analyticsAccessControl";

describe("analytics access control", () => {
  it("allows READ_ONLY to view general analytics", () => {
    expect(authorizeAnalyticsAccess("READ_ONLY", "GENERAL").isAuthorized).toBe(true);
  });

  it("denies READ_ONLY financial analytics", () => {
    const result = authorizeAnalyticsAccess("READ_ONLY", "FINANCIAL");
    expect(result.isAuthorized).toBe(false);
    expect(result.requiredPermission).toBe("VIEW_FINANCIAL_DATA");
    expect(result.reason).toContain("READ_ONLY");
  });

  it("allows OPERATOR financial analytics (has VIEW_FINANCIAL_DATA)", () => {
    expect(authorizeAnalyticsAccess("OPERATOR", "FINANCIAL").isAuthorized).toBe(true);
  });

  it("allows ADMIN case-level drill-down", () => {
    expect(authorizeAnalyticsAccess("ADMIN", "CASE_LEVEL").isAuthorized).toBe(true);
  });
});

describe("metric audit trail", () => {
  it("traces a metric whose underlying payments sum to the claimed value", () => {
    const result = verifyMetricAuditTrail({
      metricName: "Revenue",
      claimedValueCents: 15000,
      underlyingPaymentsCents: [10000, 5000],
      transactionIds: ["txn-1", "txn-2"],
      caseIds: ["case-1"],
      invoiceIds: ["inv-1"],
      recoveryIds: ["rec-1"],
    });
    expect(result.isTraceable).toBe(true);
    expect(result.sumOfUnderlyingCents).toBe(15000);
  });

  it("flags a metric whose underlying records don't sum to the claimed value", () => {
    const result = verifyMetricAuditTrail({
      metricName: "Revenue",
      claimedValueCents: 15000,
      underlyingPaymentsCents: [10000, 4000],
      transactionIds: ["txn-1"],
      caseIds: [],
      invoiceIds: [],
      recoveryIds: [],
    });
    expect(result.isTraceable).toBe(false);
  });

  it("flags a metric with no underlying records at all as not traceable", () => {
    const result = verifyMetricAuditTrail({
      metricName: "Revenue",
      claimedValueCents: 0,
      underlyingPaymentsCents: [],
      transactionIds: [],
      caseIds: [],
      invoiceIds: [],
      recoveryIds: [],
    });
    expect(result.isTraceable).toBe(false);
  });
});
