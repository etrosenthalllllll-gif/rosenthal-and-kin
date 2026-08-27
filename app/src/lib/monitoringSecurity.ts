// Monitoring API + permissions + security monitoring -- doc 12
// sections 78-80. PLAN.md P11-26.
//
// "Expose internal APIs for: health, metrics, alerts, incidents,
// workflow status, queue status, provider status, case monitoring.
// Protect with authentication and permissions." / "Define roles...
// Only authorized users can: suppress alerts, change thresholds,
// disable monitoring, execute remediation, resolve incidents." /
// "Monitor security-relevant events such as: repeated authentication
// failures, unauthorized API requests, permission failures, suspicious
// automation activity, unexpected privileged actions, repeated failed
// access attempts. Integrate with the existing audit system."
//
// Permissions extend auth.ts's existing Permission union (P11-26) --
// no parallel monitoring-specific authorization system. Security-event
// auditing maps onto audit.ts's existing AuditEventInput shape, same
// reuse discipline as financialAudit.ts/automationAudit.ts.

import { hasPermission, type Permission, type UserRole } from "./auth";
import type { AuditEventInput } from "./audit";

// doc 12 §78's own endpoint-category list, used to gate each
// monitoring API surface behind a real permission check rather than a
// single blanket flag.
export type MonitoringApiResource =
  | "HEALTH"
  | "METRICS"
  | "ALERTS"
  | "INCIDENTS"
  | "WORKFLOW_STATUS"
  | "QUEUE_STATUS"
  | "PROVIDER_STATUS"
  | "CASE_MONITORING";

export type MonitoringApiAction = "VIEW" | "SUPPRESS" | "CONFIGURE" | "EXECUTE_REMEDIATION" | "RESOLVE";

const ACTION_PERMISSION: Record<MonitoringApiAction, Permission> = {
  VIEW: "VIEW_MONITORING",
  SUPPRESS: "SUPPRESS_ALERTS",
  CONFIGURE: "CONFIGURE_MONITORING",
  EXECUTE_REMEDIATION: "EXECUTE_REMEDIATION",
  RESOLVE: "RESOLVE_INCIDENTS",
};

/**
 * Pure: doc 12 §78-79 -- every monitoring API call is gated by a real
 * permission check, not just a hidden UI button (same "enforce on the
 * backend" discipline as auth.ts's own requirePermission()). Every
 * monitoring resource uses the same action->permission mapping, so a
 * new resource never accidentally skips authorization.
 */
export function canAccessMonitoringApi(role: UserRole, action: MonitoringApiAction): boolean {
  return hasPermission(role, ACTION_PERMISSION[action]);
}

// --- Security-relevant event monitoring (doc 12 §80) ------------------------

export type SecurityEventType =
  | "REPEATED_AUTH_FAILURE"
  | "UNAUTHORIZED_API_REQUEST"
  | "PERMISSION_FAILURE"
  | "SUSPICIOUS_AUTOMATION_ACTIVITY"
  | "UNEXPECTED_PRIVILEGED_ACTION"
  | "REPEATED_FAILED_ACCESS_ATTEMPT";

/**
 * Pure: doc 12 §80's own repeated-failure pattern, generalized -- N or
 * more failures for the same actor/resource within a window is
 * flagged as security-relevant.
 */
export function detectRepeatedFailurePattern(failureCount: number, threshold = 5): boolean {
  return failureCount >= threshold;
}

export interface SecurityEventAuditInput {
  eventType: SecurityEventType;
  actor: string;
  resource: string;
  detail?: Record<string, unknown>;
}

/**
 * Pure: maps a security event onto audit.ts's (P0-6) existing
 * AuditEventInput shape -- "integrate with the existing audit system"
 * taken literally, no second security-log mechanism.
 */
export function buildSecurityEventAuditEntry(input: SecurityEventAuditInput): AuditEventInput {
  return {
    entityType: "SecurityEvent",
    entityId: input.resource,
    eventType: input.eventType,
    actorUserId: input.actor,
    metadata: input.detail,
  };
}
