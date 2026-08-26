// Status change detection + event normalization -- doc 09 sections
// 10-13. PLAN.md P8-5.
//
// "Compare previous external status against current external status.
// If unchanged, record the check. If changed, create a
// STATUS_CHANGE_EVENT. Normalize authority terminology into:
// STATUS_UPDATED, DOCUMENT_REQUESTED, HEARING_SCHEDULED,
// HEARING_RESCHEDULED, HEARING_CANCELLED, DEADLINE_CREATED,
// DEADLINE_CHANGED, DECISION_ISSUED, PAYMENT_REQUESTED,
// PAYMENT_ISSUED, ADDITIONAL_INFORMATION_REQUIRED, CASE_CLOSED,
// UNKNOWN_EVENT. Always preserve the original external wording. If an
// authority sends an event the system does not recognize, do not
// ignore it -- create UNKNOWN_EXTERNAL_EVENT, route to human review."
//
// Same fails-closed-to-UNKNOWN, always-preserve-the-raw-value
// discipline as filingProviderNormalization.ts's (P7-14)
// normalizeProviderStatus() -- this is the identical problem (map an
// arbitrary external vocabulary onto a fixed internal one, never
// discard the original, never guess on an unrecognized value) applied
// to authority events instead of filing-provider statuses.

// --- Status change detection (doc 09 section 10) -----------------------

export interface StatusChangeResult {
  changed: boolean;
  previousStatus: string;
  newStatus: string;
}

/**
 * Pure: doc 09 section 10. A STATUS_CHANGE_EVENT should only be
 * created when the status actually changed -- an unchanged status is
 * just a recorded check, not an event.
 */
export function detectStatusChange(previousStatus: string, newStatus: string): StatusChangeResult {
  return { changed: previousStatus !== newStatus, previousStatus, newStatus };
}

export function shouldCreateStatusChangeEvent(result: StatusChangeResult): boolean {
  return result.changed;
}

// --- Event normalization (doc 09 sections 12-13) ------------------------

// doc 09 section 12's own normalized vocabulary, verbatim.
export type NormalizedExternalEventType =
  | "STATUS_UPDATED"
  | "DOCUMENT_REQUESTED"
  | "HEARING_SCHEDULED"
  | "HEARING_RESCHEDULED"
  | "HEARING_CANCELLED"
  | "DEADLINE_CREATED"
  | "DEADLINE_CHANGED"
  | "DECISION_ISSUED"
  | "PAYMENT_REQUESTED"
  | "PAYMENT_ISSUED"
  | "ADDITIONAL_INFORMATION_REQUIRED"
  | "CASE_CLOSED"
  | "UNKNOWN_EVENT";

export interface ExternalEventMapping {
  connectorId: string;
  rawEventType: string;
  normalizedEventType: NormalizedExternalEventType;
}

export interface NormalizedExternalEvent {
  normalizedEventType: NormalizedExternalEventType;
  rawEventType: string;
  // "Always preserve the original external wording" -- doc 09 section
  // 12, kept separately from the type-only rawEventType.
  rawEventText: string;
  // doc 09 section 13: an unrecognized event routes to human review
  // rather than being silently ignored.
  requiresHumanReview: boolean;
}

/**
 * Pure: doc 09 sections 12-13. An unrecognized (connector, rawEventType)
 * pair fails closed to UNKNOWN_EVENT -- never guessed into one of the
 * known types -- and is flagged for human review. The raw event type
 * and wording are preserved on the result regardless of recognition.
 */
export function normalizeExternalEvent(
  connectorId: string,
  rawEventType: string,
  rawEventText: string,
  mappings: readonly ExternalEventMapping[]
): NormalizedExternalEvent {
  const mapping = mappings.find((m) => m.connectorId === connectorId && m.rawEventType === rawEventType);
  const normalizedEventType = mapping?.normalizedEventType ?? "UNKNOWN_EVENT";

  return {
    normalizedEventType,
    rawEventType,
    rawEventText,
    requiresHumanReview: normalizedEventType === "UNKNOWN_EVENT",
  };
}
