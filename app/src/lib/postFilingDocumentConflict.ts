// Court/agency document ingestion + document-to-event linking + event/
// deadline conflict detection -- doc 09 sections 49-52. PLAN.md P8-15.
//
// "When new authority documents arrive: store, associate with case,
// OCR if needed, classify, extract dates/event types/requests, detect
// deadlines, compare against existing case state, create events/
// tasks, notify operator. Every detected event should reference its
// source document (page, extracted text) so an operator can verify it.
// Detect conflicts: an existing hearing date vs. a new document
// implying a different date -> EVENT_CONFLICT, route to review, do not
// automatically overwrite the previous event. If two sources indicate
// different deadlines, do not automatically choose one -> create
// DEADLINE_CONFLICT, require human review."
//
// Same never-pick-a-winner discipline as conflictDetection.ts (P5-6):
// this is the identical problem (two sources disagree on a fact) but
// applied to a scheduled date instead of a heirship fact, so the
// resolution -- surface both values, require human review, never
// silently overwrite -- is reused rather than re-invented.

export interface EventSourceReference {
  documentId: string;
  page?: number;
  extractedText: string;
}

/**
 * doc 09 section 50: an event with no traceable source can't be
 * verified by an operator -- fails closed to false (invalid) rather
 * than accepting a reference with an empty document id or extracted
 * text.
 */
export function isValidEventSourceReference(ref: EventSourceReference): boolean {
  return ref.documentId.trim().length > 0 && ref.extractedText.trim().length > 0;
}

export type DateConflictType = "EVENT_CONFLICT" | "DEADLINE_CONFLICT";

export interface DateConflictResult {
  hasConflict: boolean;
  conflictType?: DateConflictType;
  previousValue?: string;
  newValue?: string;
  // doc 09 sections 51-52: any conflict always requires human review --
  // there's no severity gradient here the way conflictDetection.ts
  // (P5-6) has for heirship facts. Both dates are preserved on the
  // result rather than one silently winning.
  requiresHumanReview: boolean;
}

/**
 * Pure: doc 09 sections 51-52. No conflict when the two values agree
 * (including both being absent); any disagreement is a conflict of the
 * given type, requiring review -- never auto-picked, never silently
 * overwriting the previous value.
 */
export function detectDateConflict(
  conflictType: DateConflictType,
  previousValue: string | null,
  newValue: string | null
): DateConflictResult {
  if (previousValue === newValue) {
    return { hasConflict: false, requiresHumanReview: false };
  }

  return {
    hasConflict: true,
    conflictType,
    previousValue: previousValue ?? undefined,
    newValue: newValue ?? undefined,
    requiresHumanReview: true,
  };
}
