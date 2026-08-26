// Cross-system synchronization + sync exceptions -- doc 11 sections
// 44-49. PLAN.md P10-11.
//
// "Define ownership of each major data object... The automation layer
// coordinates these systems but should not become an uncontrolled
// duplicate database." / "When systems disagree: do not silently
// overwrite. Create SYNC_EXCEPTION." / For every external provider,
// track provider/endpoint/request id/idempotency key/response status/
// provider reference/last sync/error/retry count. / "Where webhooks
// are unavailable, support polling... Polling must be idempotent."

// doc 11 §45's own worked example, expressed as a lookup table rather
// than scattered comments -- the automation layer only ever reads
// this, never becomes a second writer of any of these fields.
export const SOURCE_OF_TRUTH: Record<string, string> = {
  caseStatus: "Case system",
  documentStatus: "Document system",
  filingStatus: "Filing system",
  paymentStatus: "Financial system",
  decision: "Decision system",
  communication: "Communications system",
};

export function sourceOfTruthFor(dataObject: string): string | undefined {
  return SOURCE_OF_TRUTH[dataObject];
}

// --- Sync exceptions (doc 11 §46) -------------------------------------------

export interface SyncExceptionInput {
  dataObject: string;
  entityId: string;
  internalValue: unknown;
  externalValue: unknown;
  internalSystem: string;
  externalSystem: string;
}

export interface SyncException extends SyncExceptionInput {
  requiresReview: true;
}

/**
 * Pure: doc 11 §46's rule, applied generically to any two systems that
 * disagree -- never silently overwritten in either direction. Same
 * never-silently-resolve discipline as conflictDetection.ts/
 * postFilingDocumentConflict.ts/financialReconciliation.ts.
 */
export function detectSyncException(input: SyncExceptionInput): SyncException | null {
  if (input.internalValue === input.externalValue) return null;
  return { ...input, requiresReview: true };
}

// --- External API sync tracking (doc 11 §47) --------------------------------

export interface ExternalApiSyncRecord {
  provider: string;
  endpoint: string;
  requestId: string;
  idempotencyKey: string;
  requestTimestamp: string;
  responseStatus?: number;
  providerReference?: string;
  lastSynchronization?: string;
  error?: string;
  retryCount: number;
}

export function buildExternalApiSyncRecord(input: {
  provider: string;
  endpoint: string;
  requestId: string;
  idempotencyKey: string;
  now: string;
}): ExternalApiSyncRecord {
  return { ...input, requestTimestamp: input.now, retryCount: 0 };
}

// --- Polling (doc 11 §48) ----------------------------------------------------

export type PollOutcome = "STATUS_CHANGED" | "STATUS_UNCHANGED";

/**
 * Pure: doc 11 §48 -- "if status changed: create event. if unchanged:
 * do nothing." Polling itself is idempotent by construction here: the
 * same (previousStatus, latestStatus) pair always yields the same
 * outcome, so a re-poll of an unchanged provider never re-fires an
 * event.
 */
export function evaluatePollResult(previousStatus: string | null, latestStatus: string): PollOutcome {
  return previousStatus === latestStatus ? "STATUS_UNCHANGED" : "STATUS_CHANGED";
}

// --- Webhook handling (doc 11 §49) ------------------------------------------

export interface WebhookEnvelope {
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export type WebhookIntakeOutcome = "DUPLICATE_IGNORED" | "ACCEPTED_FOR_PROCESSING";

/**
 * Pure: doc 11 §49 -- "receive webhook, verify authenticity, dedup
 * event, store event, publish internal event, trigger workflows. Never
 * directly execute complex business logic inside the webhook
 * handler." This function only does the dedup step (authenticity
 * verification is transport-specific and stays with the caller); a
 * duplicate webhookId is ignored, never reprocessed.
 */
export function evaluateWebhookIntake(
  webhook: WebhookEnvelope,
  seenWebhookIds: ReadonlySet<string>
): WebhookIntakeOutcome {
  return seenWebhookIds.has(webhook.webhookId) ? "DUPLICATE_IGNORED" : "ACCEPTED_FOR_PROCESSING";
}
