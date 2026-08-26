// Audit trail writer — doc 01 Phase 6.
//
// "Do not allow ordinary application users to modify or delete audit
// history." This module only ever creates AuditEvent rows; nothing here
// updates or deletes one. Every mutation in the app is expected to call
// recordAuditEvent as part of the same operation that changes data —
// never as an afterthought.
//
// Depends on a minimal injected interface rather than importing
// @prisma/client's generated types directly, so this is unit-testable
// without a live database (P0-10 is still blocked on a Render account).

export interface AuditEventInput {
  entityType: string;
  entityId: string;
  eventType: string;
  actorUserId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
  correlationId?: string | null;
}

export interface AuditEventWriter {
  auditEvent: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

const REQUIRED_FIELDS: Array<keyof AuditEventInput> = [
  "entityType",
  "entityId",
  "eventType",
];

export class InvalidAuditEventError extends Error {
  constructor(missingField: string) {
    super(`Cannot record audit event: missing required field "${missingField}"`);
    this.name = "InvalidAuditEventError";
  }
}

/**
 * Records one immutable audit event. Throws InvalidAuditEventError before
 * ever touching the database if a required field is missing — an audit
 * event with no entityType/entityId/eventType is worse than no event at
 * all, because it looks like coverage that isn't there.
 */
export async function recordAuditEvent(
  db: AuditEventWriter,
  input: AuditEventInput
): Promise<unknown> {
  for (const field of REQUIRED_FIELDS) {
    if (!input[field]) {
      throw new InvalidAuditEventError(field);
    }
  }

  return db.auditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      metadata: input.metadata ?? null,
      correlationId: input.correlationId ?? null,
    },
  });
}
