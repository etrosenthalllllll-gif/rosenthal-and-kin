// Financial audit trail -- doc 10 section 56. PLAN.md P9-17 (part 2 of
// 2, alongside auth.ts's financial permission extension).
//
// "Every financial action must be auditable. Record: who, what, when,
// why, source, and affected record."
//
// The generic AuditEvent writer (audit.ts, P0-6) already carries
// exactly this shape -- entityType/entityId (affected record),
// eventType (what), actorUserId (who), previousValue/newValue (the
// change itself), metadata (why/source), and Prisma's own createdAt
// (when). This module doesn't build a second audit mechanism; it's a
// thin, named mapping from a financial action onto that existing
// input shape, so callers describe a financial audit entry in
// financial vocabulary while still writing through the one real audit
// trail.

import type { AuditEventInput } from "./audit";

export interface FinancialAuditEntryInput {
  entityType: string; // e.g. "Recovery", "Distribution", "Invoice", "Payment"
  entityId: string;
  action: string; // e.g. "DISTRIBUTION_APPROVED", "PAYMENT_RECORDED"
  actorUserId: string;
  reason?: string;
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * Pure: maps a financial action onto audit.ts's (P0-6) AuditEventInput
 * shape. `reason` becomes part of `metadata` rather than a separate
 * field -- audit.ts's own shape doesn't have a dedicated "why" column,
 * and inventing one here would fork the audit trail into two slightly
 * different shapes instead of reusing the one that exists.
 */
export function buildFinancialAuditEntry(input: FinancialAuditEntryInput): AuditEventInput {
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.action,
    actorUserId: input.actorUserId,
    previousValue: input.previousValue,
    newValue: input.newValue,
    metadata: input.reason ? { reason: input.reason } : undefined,
  };
}
