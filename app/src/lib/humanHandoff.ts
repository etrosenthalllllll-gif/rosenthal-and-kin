// Human handoff / takeover -- doc 04 sections 10, 30-31. PLAN.md P3-8.
//
// Doc 04 section 10's escalation trigger list overlaps heavily with
// what P3-4 (classification routing) and P3-5 (automation rules)
// already cover -- a LEGAL_QUESTION classification, an opted-out
// channel, an ambiguous case match (P3-2/P3-3) all already escalate.
// This module covers what's genuinely NOT covered elsewhere:
//
// 1. Human takeover/resume -- section 30's state transition
//    (`humanHandling` flag) plus the specific operator actions
//    permitted in each state. "Set HUMAN_HANDLING = TRUE. Pause
//    conflicting automation... the operator should be able to: Reply,
//    Call, Send SMS, Add note, Escalate, Resume automation."
// 2. "Automation repeatedly fails" (section 10's own trigger, distinct
//    from any single classification) -- nothing else in this phase
//    tracks a consecutive-failure count.
// 3. Never-overwrite-the-original-draft (section 8) -- the specific
//    data-shape rule for AI draft -> operator revision -> final sent
//    version.
//
// The full decision-package UI (§31: conversation summary + AI
// recommendation + confidence + evidence, shown to the operator) is
// deliberately NOT built here -- like caseSummary.ts (P1-3), it needs
// real upstream conversation-history/AI-summary data this phase's
// pipeline doesn't yet produce, and faking it would break this
// project's verify-for-real discipline.

export type ConversationAttentionStatus = "AUTOMATED" | "OPERATOR_REQUIRED" | "EXCEPTION";

export interface ConversationHandlingState {
  humanHandling: boolean;
  attentionStatus: ConversationAttentionStatus;
}

export type OperatorAction = "REPLY" | "CALL" | "SEND_SMS" | "ADD_NOTE" | "ESCALATE" | "RESUME_AUTOMATION";

// doc 04 section 30's own list -- REPLY/CALL/SEND_SMS/ADD_NOTE/ESCALATE
// are available whenever a human already owns the conversation;
// RESUME_AUTOMATION is the only action that hands it back.
const HUMAN_OWNED_ACTIONS: readonly OperatorAction[] = [
  "REPLY",
  "CALL",
  "SEND_SMS",
  "ADD_NOTE",
  "ESCALATE",
  "RESUME_AUTOMATION",
];

export function availableOperatorActions(state: ConversationHandlingState): readonly OperatorAction[] {
  return state.humanHandling ? HUMAN_OWNED_ACTIONS : [];
}

/**
 * Pure: doc 04 section 30 -- "When an operator takes over a
 * conversation: Set HUMAN_HANDLING = TRUE. Pause conflicting
 * automation." Idempotent -- taking over an already-human-owned
 * conversation is a no-op, not an error.
 */
export function takeoverConversation(state: ConversationHandlingState): ConversationHandlingState {
  return { ...state, humanHandling: true };
}

/**
 * Pure: "the system can return the conversation to the automated
 * workflow" once RESUME_AUTOMATION is selected. Deliberately does not
 * reset attentionStatus -- resuming automation doesn't retroactively
 * mean nothing was ever wrong; if the conversation is still flagged
 * EXCEPTION/OPERATOR_REQUIRED, whatever set that flag needs its own
 * resolution, separate from who's currently handling replies.
 */
export function resumeAutomation(state: ConversationHandlingState): ConversationHandlingState {
  return { ...state, humanHandling: false };
}

// --- "Automation repeatedly fails" (doc 04 section 10) --------------------

export interface RepeatedFailureCheck {
  shouldEscalate: boolean;
  reason: string;
}

/**
 * Pure: doc 04 section 10 names "automation repeatedly fails" as its
 * own distinct escalation trigger, separate from any single
 * classification's confidence. `threshold` is the number of
 * consecutive automation failures (send errors, classification
 * failures, etc. -- whatever the caller counts) that trip escalation;
 * defaults to 3 since doc 04 doesn't specify an exact number itself
 * (same "don't blindly use exact numbers, make it configurable"
 * instruction as section 28's confidence thresholds).
 */
export function checkRepeatedFailureEscalation(
  consecutiveFailures: number,
  threshold: number = 3
): RepeatedFailureCheck {
  if (consecutiveFailures >= threshold) {
    return {
      shouldEscalate: true,
      reason: `${consecutiveFailures} consecutive automation failures (threshold: ${threshold}).`,
    };
  }
  return { shouldEscalate: false, reason: "Failure count below the escalation threshold." };
}

// --- AI draft / operator revision / final sent (doc 04 section 8) --------

export interface MessageRevisionHistory {
  originalAiDraft: string;
  operatorRevision: string | null;
  finalSentVersion: string | null;
}

/**
 * Pure: builds the initial revision-history record for an AI-generated
 * draft. `originalAiDraft` is fixed at creation and this record's own
 * shape makes it impossible to overwrite later -- callers must produce
 * a new record via applyOperatorRevision()/recordFinalSend() rather
 * than mutate `originalAiDraft` directly, per section 8's explicit
 * "Never overwrite the original draft."
 */
export function createDraftHistory(originalAiDraft: string): MessageRevisionHistory {
  return { originalAiDraft, operatorRevision: null, finalSentVersion: null };
}

export function applyOperatorRevision(
  history: MessageRevisionHistory,
  revisedText: string
): MessageRevisionHistory {
  return { ...history, operatorRevision: revisedText };
}

export function recordFinalSend(
  history: MessageRevisionHistory,
  finalText: string
): MessageRevisionHistory {
  return { ...history, finalSentVersion: finalText };
}
