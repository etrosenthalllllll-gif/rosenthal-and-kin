// Claimant notification engine + preferences + provenance + delivery
// tracking -- doc 09 sections 31, 35-39. PLAN.md P8-10.
//
// "Build a notification service. Notification types: FILING_RECEIVED,
// STATUS_UPDATE, DOCUMENT_REQUEST, DOCUMENT_RECEIVED,
// DEADLINE_APPROACHING, HEARING_SCHEDULED, HEARING_CHANGED,
// HEARING_CANCELLED, DECISION_RECEIVED, CLAIM_COMPLETED,
// ACTION_REQUIRED, ESCALATION. Respect opt-outs and communication
// restrictions. Messages should be generated from approved templates
// -- do not let an AI model freely invent consequential legal
// instructions. Every claimant notification should record: template,
// template version, recipient, channel, case, trigger, timestamp,
// delivery status, message ID. Track: QUEUED, SENT, DELIVERED, FAILED,
// BOUNCED, OPENED, REPLIED. Do not assume SENT means DELIVERED."
//
// Reuses P3's Communication/preference infrastructure directly --
// communicationPreferences.ts's (P3-6) canSendOnChannel() is the exact
// same "should we send on this channel at all" check doc 09 section 36
// asks for, so this module doesn't rebuild it under a new name; it
// only adds the post-filing-specific notification-type vocabulary and
// the provenance/delivery-tracking record shape.

import { canSendOnChannel, type PersonCommunicationPreferences, type SendPermissionResult } from "./communicationPreferences";
import type { CommunicationChannel } from "./communicationTimeline";

// doc 09 section 35's own notification-type list, verbatim.
export type PostFilingNotificationType =
  | "FILING_RECEIVED"
  | "STATUS_UPDATE"
  | "DOCUMENT_REQUEST"
  | "DOCUMENT_RECEIVED"
  | "DEADLINE_APPROACHING"
  | "HEARING_SCHEDULED"
  | "HEARING_CHANGED"
  | "HEARING_CANCELLED"
  | "DECISION_RECEIVED"
  | "CLAIM_COMPLETED"
  | "ACTION_REQUIRED"
  | "ESCALATION";

// doc 09 section 39's own delivery-status list, verbatim.
export type DeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "BOUNCED" | "OPENED" | "REPLIED";

/**
 * doc 09 section 36: whether a notification may be sent on this
 * channel at all, respecting opt-outs/restrictions -- delegates
 * directly to communicationPreferences.ts's (P3-6) own check rather
 * than re-deriving it.
 */
export function canSendPostFilingNotification(
  preferences: PersonCommunicationPreferences,
  channel: CommunicationChannel
): SendPermissionResult {
  return canSendOnChannel(preferences, channel);
}

export interface PostFilingNotificationRecord {
  notificationType: PostFilingNotificationType;
  templateId: string;
  templateVersion: string;
  recipientPersonId: string;
  channel: CommunicationChannel;
  postFilingCaseId: string;
  trigger: string;
  createdAt: string;
  deliveryStatus: DeliveryStatus;
  messageId: string | null;
}

export interface CreateNotificationInput {
  notificationType: PostFilingNotificationType;
  templateId: string;
  templateVersion: string;
  recipientPersonId: string;
  channel: CommunicationChannel;
  postFilingCaseId: string;
  trigger: string;
  createdAt: string;
}

/**
 * Pure: doc 09 section 38. Every field the doc requires is present on
 * the record from the moment it's created -- provenance isn't
 * something bolted on after the fact. `templateId`/`templateVersion`
 * being required fields (not optional) is the enforcement mechanism
 * for section 37's "generated from approved templates only" -- there's
 * no shape in this type for a message with no named template.
 */
export function createPostFilingNotification(input: CreateNotificationInput): PostFilingNotificationRecord {
  return { ...input, deliveryStatus: "QUEUED", messageId: null };
}

export function markNotificationSent(
  record: PostFilingNotificationRecord,
  messageId: string
): PostFilingNotificationRecord {
  return { ...record, deliveryStatus: "SENT", messageId };
}

/**
 * doc 09 section 39: "Do not assume SENT means DELIVERED." DELIVERED
 * is always its own explicit transition (e.g. a delivery webhook/
 * receipt), never inferred automatically once SENT is recorded.
 */
export function markNotificationDelivered(record: PostFilingNotificationRecord): PostFilingNotificationRecord {
  return { ...record, deliveryStatus: "DELIVERED" };
}

export function isConfirmedDelivered(record: PostFilingNotificationRecord): boolean {
  return record.deliveryStatus === "DELIVERED";
}
