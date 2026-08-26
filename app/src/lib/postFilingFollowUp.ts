// Automated status follow-ups + idempotency + stop conditions -- doc
// 09 sections 32-34. PLAN.md P8-11.
//
// "Build automated follow-up workflows: no update after X days ->
// check authority; no response after X days -> send claimant
// notification; document request approaching deadline -> remind
// claimant; authority processing unusually long -> create operator
// review. Do not send duplicate follow-ups. Stop automated follow-ups
// when: claimant responds, document received, request satisfied, claim
// closed, opt-out received, operator disables automation, authority
// provides resolution, deadline changes, case is escalated."
//
// Same stop-condition-first, no-blind-resend discipline as
// followUpScheduler.ts (P3-7) -- every condition is checked before a
// SEND is ever returned, and a caller supplies whether this exact
// (case, trigger) follow-up has already been sent so a retried job
// never produces a duplicate, same recommended-idempotency-key pattern
// as P3-7 rather than re-deriving deduplication logic here.

// doc 09 section 32's own trigger list, verbatim.
export type PostFilingFollowUpTrigger =
  | "NO_AUTHORITY_UPDATE"
  | "NO_CLAIMANT_RESPONSE"
  | "DOCUMENT_REQUEST_DEADLINE_APPROACHING"
  | "AUTHORITY_PROCESSING_UNUSUALLY_LONG";

// doc 09 section 34's own stop-condition list, verbatim.
export interface PostFilingFollowUpStopConditions {
  claimantResponded: boolean;
  documentReceived: boolean;
  requestSatisfied: boolean;
  claimClosed: boolean;
  hasOptedOut: boolean;
  operatorDisabledAutomation: boolean;
  authorityProvidedResolution: boolean;
  deadlineChanged: boolean;
  caseEscalated: boolean;
}

const STOP_REASONS: Record<keyof PostFilingFollowUpStopConditions, string> = {
  claimantResponded: "Claimant responded -- do not continue messaging after the underlying issue is resolved.",
  documentReceived: "Document received.",
  requestSatisfied: "Request satisfied.",
  claimClosed: "Claim closed.",
  hasOptedOut: "Opt-out received.",
  operatorDisabledAutomation: "Operator disabled automation.",
  authorityProvidedResolution: "Authority provided resolution.",
  deadlineChanged: "Deadline changed.",
  caseEscalated: "Case is escalated.",
};

export interface PostFilingFollowUpContext {
  trigger: PostFilingFollowUpTrigger;
  stopConditions: PostFilingFollowUpStopConditions;
  // doc 09 section 33: whether this exact (case, trigger) follow-up has
  // already been sent -- checked before producing a SEND action so a
  // retried job never sends a duplicate.
  alreadySent: boolean;
}

export type PostFilingFollowUpPlan =
  | { action: "STOP"; reason: string }
  | { action: "ALREADY_SENT" }
  | { action: "SEND"; trigger: PostFilingFollowUpTrigger };

/**
 * Pure: doc 09 sections 32-34. Stop conditions are checked first and
 * unconditionally win -- even an already-triggered follow-up is
 * cancelled if the underlying issue has since resolved. Idempotency
 * (alreadySent) is checked next, before ever returning SEND.
 */
export function planPostFilingFollowUp(context: PostFilingFollowUpContext): PostFilingFollowUpPlan {
  for (const [key, triggered] of Object.entries(context.stopConditions) as [
    keyof PostFilingFollowUpStopConditions,
    boolean,
  ][]) {
    if (triggered) {
      return { action: "STOP", reason: STOP_REASONS[key] };
    }
  }

  if (context.alreadySent) {
    return { action: "ALREADY_SENT" };
  }

  return { action: "SEND", trigger: context.trigger };
}
