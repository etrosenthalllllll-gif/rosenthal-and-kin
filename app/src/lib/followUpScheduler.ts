// Automated follow-up sequence scheduler -- doc 04 section 21 (and the
// idempotency/rate-limit requirements of sections 34-35). PLAN.md P3-7.
//
// "Build a follow-up scheduler. The system should support configurable
// sequences. Example: DAY 0: Initial outreach / DAY 7: Follow-up / DAY
// 14: Second follow-up / DAY 30: Final follow-up. The system should
// stop the sequence when: Person responds / Person opts out / Case
// closes / Person becomes inactive / Operator pauses sequence /
// Workflow changes / Another communication channel takes over. Do not
// blindly send follow-ups after meaningful responses."
//
// Outbound idempotency itself (section 34's "if a job retries, it must
// not send duplicate messages") is NOT re-implemented here -- it's
// already enforced two layers down: JobQueueProvider.enqueue() requires
// an idempotencyKey (queue/types.ts), and Communication.idempotencyKey
// is a DB unique constraint (P3-1 schema). This module's own
// responsibility is purely the scheduling decision -- which step (if
// any) is due next, and whether a stop condition means the whole
// sequence should end. The recommended idempotency key for a follow-up
// job is `followup:${conversationId}:${stepIndex}`, so a retried
// schedule call for the same step is naturally deduped by the queue
// itself rather than by logic duplicated here.

export interface FollowUpStep {
  dayOffset: number; // days after the sequence's initialSentAt
  templateKey: string;
}

export interface FollowUpSequence {
  key: string;
  steps: readonly FollowUpStep[]; // must be sorted ascending by dayOffset
}

// doc 04 section 21's own example sequence, verbatim day offsets.
export const DEFAULT_OUTREACH_SEQUENCE: FollowUpSequence = {
  key: "DEFAULT_OUTREACH",
  steps: [
    { dayOffset: 0, templateKey: "INITIAL_OUTREACH" },
    { dayOffset: 7, templateKey: "FOLLOW_UP_1" },
    { dayOffset: 14, templateKey: "FOLLOW_UP_2" },
    { dayOffset: 30, templateKey: "FINAL_FOLLOW_UP" },
  ],
};

// Each flag maps directly to one of doc 04 section 21's stop conditions.
export interface FollowUpStopConditions {
  hasResponded: boolean;
  hasOptedOut: boolean;
  caseClosed: boolean;
  personInactive: boolean;
  operatorPaused: boolean;
  workflowChanged: boolean;
  anotherChannelTookOver: boolean;
}

export interface FollowUpContext {
  sequence: FollowUpSequence;
  initialSentAt: Date;
  now: Date;
  // Indexes into sequence.steps that have already been sent -- prevents
  // re-sending a step whose due date has already passed, and lets the
  // scheduler find the next un-sent step regardless of how it's stored
  // upstream (Communication rows, a job log, etc.).
  sentStepIndexes: readonly number[];
  stopConditions: FollowUpStopConditions;
}

export type FollowUpPlan =
  | { action: "STOP"; reason: string }
  | { action: "SEQUENCE_COMPLETE" }
  | { action: "WAIT"; stepIndex: number; dueAt: Date }
  | { action: "SEND"; stepIndex: number; step: FollowUpStep };

const STOP_REASONS: Record<keyof FollowUpStopConditions, string> = {
  hasResponded: "Person responded -- do not blindly send follow-ups after a meaningful response.",
  hasOptedOut: "Person opted out.",
  caseClosed: "Case closed.",
  personInactive: "Person became inactive.",
  operatorPaused: "Operator paused the sequence.",
  workflowChanged: "Workflow changed.",
  anotherChannelTookOver: "Another communication channel took over.",
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Pure: decides what a follow-up sequence should do right now. No DB
 * access, no scheduling side effect -- the caller (a background job)
 * enqueues the actual send when this returns `SEND`.
 */
export function planNextFollowUp(context: FollowUpContext): FollowUpPlan {
  for (const [key, triggered] of Object.entries(context.stopConditions) as [
    keyof FollowUpStopConditions,
    boolean,
  ][]) {
    if (triggered) {
      return { action: "STOP", reason: STOP_REASONS[key] };
    }
  }

  const sentSet = new Set(context.sentStepIndexes);
  const nextIndex = context.sequence.steps.findIndex((_, i) => !sentSet.has(i));

  if (nextIndex === -1) {
    return { action: "SEQUENCE_COMPLETE" };
  }

  const step = context.sequence.steps[nextIndex];
  const dueAt = addDays(context.initialSentAt, step.dayOffset);

  if (context.now.getTime() < dueAt.getTime()) {
    return { action: "WAIT", stepIndex: nextIndex, dueAt };
  }

  return { action: "SEND", stepIndex: nextIndex, step };
}
