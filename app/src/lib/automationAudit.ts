// Security + audit trail for automation actions -- doc 11 sections
// 79-80. PLAN.md P10-19.
//
// "Every automation action must execute under an authenticated service
// identity or authorized user context. Record: actor, permission,
// workflow, action, case, timestamp, result. Do not use anonymous
// automation." / "Every significant automation event must be
// auditable."
//
// Same reuse discipline as financialAudit.ts (P9-17): maps an
// automation action onto audit.ts's existing AuditEventInput shape
// rather than building a second audit mechanism.

import type { AuditEventInput } from "./audit";

export type AuthenticatedActorCheck =
  | { authenticated: true; actor: string }
  | { authenticated: false; reason: "ANONYMOUS_ACTOR_NOT_PERMITTED" };

/**
 * Pure: doc 11 §79 -- "do not use anonymous automation." A blank/
 * missing actor is rejected outright; the caller must never execute
 * the action on a rejection.
 */
export function checkAuthenticatedActor(actor: string | undefined | null): AuthenticatedActorCheck {
  if (!actor || !actor.trim()) {
    return { authenticated: false, reason: "ANONYMOUS_ACTOR_NOT_PERMITTED" };
  }
  return { authenticated: true, actor };
}

export interface AutomationAuditEntryInput {
  workflowId: string;
  caseId?: string;
  action: string;
  actor: string;
  permission?: string;
  result: "SUCCESS" | "FAILURE";
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * Pure: maps an automation action onto audit.ts's (P0-6)
 * AuditEventInput shape -- workflow/permission/result go into
 * `metadata` since audit.ts's own columns don't have dedicated fields
 * for them, same "extend metadata, don't fork the shape" approach
 * financialAudit.ts already established.
 */
export function buildAutomationAuditEntry(input: AutomationAuditEntryInput): AuditEventInput {
  return {
    entityType: "WorkflowExecution",
    entityId: input.caseId ?? input.workflowId,
    eventType: input.action,
    actorUserId: input.actor,
    previousValue: input.previousValue,
    newValue: input.newValue,
    metadata: {
      workflowId: input.workflowId,
      permission: input.permission,
      result: input.result,
    },
  };
}
