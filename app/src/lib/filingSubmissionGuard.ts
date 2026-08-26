// Idempotent submission engine -- doc 08 sections 29-30, 57. PLAN.md
// P7-12.
//
// "The system must prevent duplicate submissions caused by double
// clicks, browser refresh, job retry, network timeout, provider
// timeout, worker crash. If a provider timeout occurs after a
// submission request, DO NOT automatically submit again -- first
// determine whether the original submission succeeded. Never blindly
// submit twice."
//
// Pure state-check logic reusing the job queue's idempotency-key
// discipline (P0-8) at the filing-attempt level: this module doesn't
// perform the lock/DB-check itself (that's the caller's job, backed by
// FilingAttempt's own unique (filingId, attemptNumber) constraint from
// P7-1) -- it decides, given the current known state, whether a new
// submission attempt may proceed at all.

export type FilingAttemptStatus = "NONE" | "IN_PROGRESS" | "SUBMITTED" | "UNKNOWN" | "FAILED";

export interface FilingSubmissionState {
  currentAttemptStatus: FilingAttemptStatus;
  // Whether this exact idempotency key has already been used for a
  // submission -- checked before status, since a reused key is a
  // guaranteed duplicate regardless of what status the prior attempt
  // ended up in.
  idempotencyKeyAlreadyUsed: boolean;
}

export type SubmissionGuardOutcome =
  | "PROCEED"
  | "ALREADY_SUBMITTED"
  | "SUBMISSION_IN_PROGRESS"
  | "UNKNOWN_MUST_RECONCILE";

/**
 * Pure: doc 08 sections 29-30. A reused idempotency key is always
 * ALREADY_SUBMITTED regardless of status (double-click/job-retry/
 * browser-refresh protection). An UNKNOWN status (timeout after send,
 * doc 08 section 57) never triggers an automatic resubmit -- the
 * caller must reconcile with the provider first
 * (resolveUnknownSubmission below). Only NONE/FAILED allow a fresh
 * attempt to proceed.
 */
export function evaluateSubmissionGuard(state: FilingSubmissionState): SubmissionGuardOutcome {
  if (state.idempotencyKeyAlreadyUsed) return "ALREADY_SUBMITTED";

  switch (state.currentAttemptStatus) {
    case "SUBMITTED":
      return "ALREADY_SUBMITTED";
    case "IN_PROGRESS":
      return "SUBMISSION_IN_PROGRESS";
    case "UNKNOWN":
      return "UNKNOWN_MUST_RECONCILE";
    case "NONE":
    case "FAILED":
      return "PROCEED";
  }
}

export type UnknownSubmissionResolution = "TREAT_AS_SUBMITTED" | "SAFE_TO_RESUBMIT" | "STILL_UNKNOWN";

/**
 * Pure: doc 08 section 57's own resolution sequence -- "query provider
 * status ... only if confirmed absent may a retry be considered."
 * `providerConfirmedExists` is `null` when the provider itself
 * couldn't be reached/queried (outage, timeout on the reconciliation
 * check too) -- that's STILL_UNKNOWN, not treated as either outcome.
 */
export function resolveUnknownSubmission(providerConfirmedExists: boolean | null): UnknownSubmissionResolution {
  if (providerConfirmedExists === true) return "TREAT_AS_SUBMITTED";
  if (providerConfirmedExists === false) return "SAFE_TO_RESUBMIT";
  return "STILL_UNKNOWN";
}
