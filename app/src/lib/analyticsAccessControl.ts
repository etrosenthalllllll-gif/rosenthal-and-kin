// Analytics security + auditability -- doc 13 sections 88-89. PLAN.md
// P12-29 (part 1 of 2, alongside analyticsReconciliation.ts).
//
// "Analytics must respect existing: Authentication / Authorization /
// Role permissions / Case access permissions / Financial permissions /
// Sensitive information restrictions. Do not expose financial or
// claimant information to unauthorized users." / "Every important
// financial/business metric should be traceable. For example: Revenue
// $X should be drillable to Transactions, Cases, Payments, Invoices,
// Recovery records. This makes analytics trustworthy."
//
// Reuses `auth.ts`'s existing role/permission table rather than a
// second, parallel analytics-only authorization system -- P12-28
// already established this pattern for exports (`authorizeExport()`);
// this extends the same discipline to viewing analytics data at all,
// not just exporting it.

import { hasPermission, type Permission, type UserRole } from "./auth";

// --- Security: gate analytics views by existing permissions (doc 13 §88) ---

export type AnalyticsDataScope = "GENERAL" | "FINANCIAL" | "CASE_LEVEL";

// GENERAL covers aggregate, non-financial dashboards (funnel counts,
// automation rates). FINANCIAL covers anything touching revenue, cost,
// ROI, or recovery amounts. CASE_LEVEL covers drill-down into specific
// cases/claimants, which can expose claimant PII -- gated the same way
// document access is gated elsewhere in this codebase.
const SCOPE_REQUIRED_PERMISSION: Record<AnalyticsDataScope, Permission> = {
  GENERAL: "VIEW_CASES",
  FINANCIAL: "VIEW_FINANCIAL_DATA",
  CASE_LEVEL: "VIEW_DOCUMENTS",
};

export interface AnalyticsAccessAuthorization {
  isAuthorized: boolean;
  requiredPermission: Permission;
  reason: string | null;
}

/**
 * Pure: doc 13 §88 -- "do not expose financial or claimant information
 * to unauthorized users." Every analytics read goes through this
 * before rendering, same as `dashboardOperations.ts`'s (P12-28)
 * `authorizeExport()` for exports specifically.
 */
export function authorizeAnalyticsAccess(role: UserRole, scope: AnalyticsDataScope): AnalyticsAccessAuthorization {
  const requiredPermission = SCOPE_REQUIRED_PERMISSION[scope];
  const isAuthorized = hasPermission(role, requiredPermission);
  return {
    isAuthorized,
    requiredPermission,
    reason: isAuthorized ? null : `role ${role} lacks ${requiredPermission} required for ${scope} analytics`,
  };
}

// --- Auditability: every metric drillable to source records (doc 13 §89) ---

export interface MetricAuditTrailInput {
  metricName: string;
  claimedValueCents: number;
  underlyingPaymentsCents: readonly number[];
  transactionIds: readonly string[];
  caseIds: readonly string[];
  invoiceIds: readonly string[];
  recoveryIds: readonly string[];
}

export interface MetricAuditTrailResult {
  metricName: string;
  claimedValueCents: number;
  sumOfUnderlyingCents: number;
  /** True only when at least one underlying record exists AND the sum
   * of underlying payment amounts exactly matches the claimed metric
   * value -- a metric with no backing records, or one whose backing
   * records don't add up, is not trustworthy per doc 13 §89. */
  isTraceable: boolean;
  transactionIds: readonly string[];
  caseIds: readonly string[];
  invoiceIds: readonly string[];
  recoveryIds: readonly string[];
}

/**
 * Pure: doc 13 §89's own worked example -- "Revenue: $X should be
 * drillable to: Transactions, Cases, Payments, Invoices, Recovery
 * records." Verifies the claimed figure is actually reproducible from
 * its underlying records rather than just asserting a list of IDs
 * exists alongside it.
 */
export function verifyMetricAuditTrail(input: MetricAuditTrailInput): MetricAuditTrailResult {
  const sumOfUnderlyingCents = input.underlyingPaymentsCents.reduce((sum, cents) => sum + cents, 0);
  const isTraceable = input.underlyingPaymentsCents.length > 0 && sumOfUnderlyingCents === input.claimedValueCents;
  return {
    metricName: input.metricName,
    claimedValueCents: input.claimedValueCents,
    sumOfUnderlyingCents,
    isTraceable,
    transactionIds: input.transactionIds,
    caseIds: input.caseIds,
    invoiceIds: input.invoiceIds,
    recoveryIds: input.recoveryIds,
  };
}
