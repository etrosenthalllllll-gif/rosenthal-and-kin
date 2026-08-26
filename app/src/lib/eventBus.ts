// Event model + event bus + idempotent dedup -- doc 11 sections 7-10.
// PLAN.md P10-3.
//
// "Create a standardized Event model." Fields: event id, event type,
// entity type, entity id, case id, source system, timestamp, payload,
// correlation id, parent event, actor, version. / "Systems should be
// able to publish EVENT and automation workflows should subscribe to
// EVENT... Do not tightly couple these systems together." / "Every
// event should have a unique identifier. The system must detect
// duplicate event delivery... Store processed event IDs."
//
// Mirrors schema.prisma's AutomationEvent model (P10-3): `eventId` is
// the caller-supplied dedup key, unique at the DB layer. This module
// is the pure/in-memory half -- building well-formed events and
// deciding whether one has already been processed -- with a thin
// pub/sub abstraction so publishers and subscribers never call each
// other directly (doc 11 §9's decoupling requirement).

export interface AutomationEventInput {
  eventId: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  caseId?: string;
  sourceSystem: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  parentEventId?: string;
  actor?: string;
}

export interface AutomationEvent extends AutomationEventInput {
  version: number;
  createdAt: string;
}

// doc 11 §8's own worked example plus the trigger list from §7 --
// illustrative, not exhaustive. New event types are expected to be
// added over time without touching this module (a closed enum here
// would fight the "extensible" mandate the doc gives the workflow
// engine itself).
export const EXAMPLE_EVENT_TYPES: readonly string[] = [
  "LEAD_CREATED",
  "LEAD_SCORED",
  "LEAD_QUALIFIED",
  "OUTREACH_CREATED",
  "OUTREACH_SENT",
  "EMAIL_DELIVERED",
  "EMAIL_OPENED",
  "EMAIL_REPLIED",
  "SMS_SENT",
  "SMS_REPLIED",
  "CALL_COMPLETED",
  "CLAIMANT_IDENTIFIED",
  "RELATIONSHIP_VERIFIED",
  "CASE_CREATED",
  "CASE_APPROVED",
  "CASE_REJECTED",
  "DOCUMENT_RECEIVED",
  "DOCUMENT_VALIDATED",
  "CLAIM_PREPARED",
  "CLAIM_REVIEWED",
  "CLAIM_FILED",
  "CLAIM_REJECTED",
  "CLAIM_RESUBMITTED",
  "CLAIM_APPROVED",
  "RECOVERY_EXPECTED",
  "RECOVERY_RECEIVED",
  "PAYMENT_RECONCILED",
  "CASE_CLOSED",
  "OPERATOR_ACTION",
  "WORKFLOW_STARTED",
  "WORKFLOW_COMPLETED",
  "WORKFLOW_FAILED",
];

/**
 * Pure: builds a well-formed AutomationEvent from caller input,
 * stamping version 1 and the given timestamp. version is bumped only
 * by a corrected/superseding event (same never-overwrite discipline
 * as every versioned record in this codebase); a first-time event
 * always starts at 1.
 */
export function buildAutomationEvent(input: AutomationEventInput, now: string): AutomationEvent {
  return { ...input, version: 1, createdAt: now };
}

/**
 * Pure: doc 11 §10's idempotency check. `processedEventIds` is
 * whatever the caller already knows was processed (in production,
 * backed by AutomationEvent's unique `eventId` column). Returns true
 * only when this exact eventId has NOT been seen -- the caller should
 * process the event and then persist it; a duplicate delivery should
 * be a silent no-op, not an error and not a re-execution.
 */
export function shouldProcessEvent(eventId: string, processedEventIds: ReadonlySet<string>): boolean {
  return !processedEventIds.has(eventId);
}

// --- Event bus (pub/sub) ----------------------------------------------------

export type EventHandler = (event: AutomationEvent) => void | Promise<void>;

export interface EventBus {
  publish(event: AutomationEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): () => void;
  subscriberCount(eventType: string): number;
}

/**
 * In-memory event bus. Publishers call publish() with no knowledge of
 * who (if anyone) is subscribed; subscribers register interest in an
 * event type with no knowledge of who publishes it -- doc 11 §9's
 * "do not tightly couple these systems together." A production
 * deployment can swap this for a durable queue without changing
 * caller code, same connector-swap shape as filingConnector.ts.
 */
export function createInMemoryEventBus(): EventBus {
  const subscribers = new Map<string, Set<EventHandler>>();

  return {
    async publish(event) {
      const handlers = subscribers.get(event.eventType);
      if (!handlers || handlers.size === 0) return;
      for (const handler of handlers) {
        await handler(event);
      }
    },
    subscribe(eventType, handler) {
      if (!subscribers.has(eventType)) subscribers.set(eventType, new Set());
      subscribers.get(eventType)!.add(handler);
      return () => {
        subscribers.get(eventType)?.delete(handler);
      };
    },
    subscriberCount(eventType) {
      return subscribers.get(eventType)?.size ?? 0;
    },
  };
}
