// Data consistency: outbox/inbox pattern + event correlation +
// cross-system case timeline -- doc 11 sections 81-85. PLAN.md P10-20.
//
// "Where a workflow modifies multiple systems: use reliable
// coordination patterns. Do not assume that a database update AND an
// external API call can always succeed atomically. If the external
// call succeeds but internal update fails: create a reconciliation
// task." / Outbox: "store event in outbox, commit transaction,
// background worker publishes event, mark outbox event delivered.
// This prevents lost events." / Inbox: "store event before processing,
// deduplicate, process, mark processed." / "Every related action
// should carry a correlation ID... this allows one-click tracing." /
// "Build a unified automation timeline... WHAT HAPPENED, WHEN, WHY,
// WHICH SYSTEM DID IT, WHICH WORKFLOW CAUSED IT, WHAT HAPPENS NEXT."

// --- Outbox pattern (doc 11 §82) --------------------------------------------

export interface OutboxEntry {
  id: string;
  eventPayload: Record<string, unknown>;
  delivered: boolean;
  createdAt: string;
}

/**
 * Pure: doc 11 §82 -- an outbox row is created (delivered: false) in
 * the SAME database transaction as the state change that caused it,
 * so the event is never lost even if the background publisher hasn't
 * run yet. This function only builds the row; the caller is
 * responsible for inserting it inside that same transaction.
 */
export function buildOutboxEntry(id: string, eventPayload: Record<string, unknown>, now: string): OutboxEntry {
  return { id, eventPayload, delivered: false, createdAt: now };
}

/**
 * Pure: marks an outbox row delivered once the background publisher
 * has successfully published it -- never mutates the original row,
 * returns a new one (same never-in-place-mutate discipline as the
 * rest of this codebase's status transitions).
 */
export function markOutboxDelivered(entry: OutboxEntry): OutboxEntry {
  return { ...entry, delivered: true };
}

// --- Inbox pattern (doc 11 §83) ---------------------------------------------

export interface InboxEntry {
  externalEventId: string;
  payload: Record<string, unknown>;
  processed: boolean;
  receivedAt: string;
}

export function buildInboxEntry(externalEventId: string, payload: Record<string, unknown>, now: string): InboxEntry {
  return { externalEventId, payload, processed: false, receivedAt: now };
}

export type InboxIntakeOutcome = "DUPLICATE_IGNORED" | "STORE_AND_PROCESS";

/**
 * Pure: doc 11 §83's store-before-processing discipline, generalized
 * beyond webhooks (crossSystemSync.ts's evaluateWebhookIntake()
 * covers that one named case) -- any incoming external event is
 * checked against already-received ids first.
 */
export function evaluateInboxIntake(
  externalEventId: string,
  alreadyReceivedIds: ReadonlySet<string>
): InboxIntakeOutcome {
  return alreadyReceivedIds.has(externalEventId) ? "DUPLICATE_IGNORED" : "STORE_AND_PROCESS";
}

export function markInboxProcessed(entry: InboxEntry): InboxEntry {
  return { ...entry, processed: true };
}

// --- Reconciliation task on partial failure (doc 11 §81) --------------------

export interface ReconciliationTask {
  reason: string;
  externalCallSucceeded: boolean;
  internalUpdateSucceeded: boolean;
  createdAt: string;
}

/**
 * Pure: doc 11 §81's own scenario -- when an external call succeeds
 * but the matching internal update fails (or vice versa), the two
 * systems are now out of sync. This never resolves the mismatch
 * itself; it only decides whether a reconciliation task is warranted.
 */
export function needsReconciliationTask(externalCallSucceeded: boolean, internalUpdateSucceeded: boolean): boolean {
  return externalCallSucceeded !== internalUpdateSucceeded;
}

// --- Event correlation (doc 11 §84) -----------------------------------------

export function attachCorrelationId<T extends Record<string, unknown>>(event: T, correlationId: string): T & { correlationId: string } {
  return { ...event, correlationId };
}

// --- Cross-system case timeline (doc 11 §85) --------------------------------

export interface CaseTimelineEntry {
  system: string;
  description: string;
  timestamp: string;
  workflowId?: string;
  reason?: string;
}

/**
 * Pure: merges entries already tagged by their owning system (per
 * P10-11's SOURCE_OF_TRUTH ownership) into one chronological view --
 * "what happened, when, why, which system, which workflow." Never
 * infers ownership itself; the caller supplies `system` per entry.
 */
export function buildCaseTimeline(entries: readonly CaseTimelineEntry[]): CaseTimelineEntry[] {
  return [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
