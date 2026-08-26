// Timeouts + idempotency keys + duplicate-action protection -- doc 11
// sections 35-39. PLAN.md P10-9.
//
// "Every externally impactful action must be idempotent... Generate an
// idempotency key. Example: CASE_ID + ACTION_TYPE + ACTION_VERSION +
// UNIQUE_OPERATION_ID. Before executing: CHECK WHETHER ACTION ALREADY
// COMPLETED. If yes: return existing result. Do NOT perform action
// twice." Named duplicate-protection cases: email, filing, payment --
// each of those systems already exists (Communication, Filing,
// Invoice/FinancialTransaction); this module gives them one shared,
// reusable check rather than three separate ad-hoc ones.

export interface IdempotencyKeyInput {
  caseId: string;
  actionType: string;
  actionVersion: number | string;
  operationId: string;
}

/**
 * Pure: doc 11 §36's own worked example, applied literally. Same
 * inputs always produce the same key -- callers use this to look up
 * whether the action already ran before attempting it again.
 */
export function buildIdempotencyKey(input: IdempotencyKeyInput): string {
  return [input.caseId, input.actionType, input.actionVersion, input.operationId].join(":");
}

export type IdempotentActionOutcome<T> =
  | { status: "ALREADY_COMPLETED"; result: T }
  | { status: "PROCEED" };

/**
 * Pure: doc 11 §36's check-before-execute gate. `completedActions` is
 * whatever store the caller already maintains (DB unique constraint,
 * in-memory map, etc.) keyed by idempotency key -- this function only
 * decides what to do given that lookup, it doesn't own the storage.
 */
export function checkIdempotentAction<T>(
  key: string,
  completedActions: ReadonlyMap<string, T>
): IdempotentActionOutcome<T> {
  const existing = completedActions.get(key);
  if (existing !== undefined) return { status: "ALREADY_COMPLETED", result: existing };
  return { status: "PROCEED" };
}

// --- Duplicate-action protection (doc 11 §37-39) ----------------------------

export interface DuplicateEmailCheck {
  caseId: string;
  recipient: string;
  templateId: string;
  workflowId: string;
  actionId: string;
}

/**
 * Pure: doc 11 §37's five-field duplicate-email check, expressed as a
 * lookup key -- "same case, same recipient, same template, same
 * workflow, same action id" collapses to one composite key so the
 * caller can check it against whatever store of already-sent actions
 * it maintains, same shape as buildIdempotencyKey().
 */
export function buildDuplicateEmailKey(input: DuplicateEmailCheck): string {
  return [input.caseId, input.recipient, input.templateId, input.workflowId, input.actionId].join(":");
}

export interface DuplicateFilingCheck {
  filingId: string;
  submissionId?: string;
  providerReference?: string;
}

export type DuplicateFilingOutcome = "ALREADY_SUBMITTED" | "SAFE_TO_SUBMIT";

/**
 * Pure: doc 11 §38 -- "never blindly resubmit because an API request
 * timed out; first query provider status where possible." A filing
 * with an existing submissionId or providerReference has already been
 * accepted by (or is in flight at) the provider and must not be
 * resubmitted; only a filing with neither is safe to submit.
 */
export function checkDuplicateFiling(input: DuplicateFilingCheck): DuplicateFilingOutcome {
  if (input.submissionId || input.providerReference) return "ALREADY_SUBMITTED";
  return "SAFE_TO_SUBMIT";
}

export interface DuplicatePaymentCheck {
  transactionId: string;
  providerReference?: string;
  amountCents: number;
  date: string;
  invoiceId: string;
}

/**
 * Pure: doc 11 §39 -- a payment is a duplicate of an existing one when
 * it matches on transaction id or provider reference (the strongest
 * signal), or failing that, on invoice + amount + date all matching
 * (the doc's fallback signal set for providers that don't return a
 * stable reference).
 */
export function isDuplicatePayment(
  candidate: DuplicatePaymentCheck,
  existing: readonly DuplicatePaymentCheck[]
): boolean {
  return existing.some((e) => {
    if (candidate.transactionId && e.transactionId === candidate.transactionId) return true;
    if (candidate.providerReference && e.providerReference === candidate.providerReference) return true;
    return e.invoiceId === candidate.invoiceId && e.amountCents === candidate.amountCents && e.date === candidate.date;
  });
}

// --- Timeout system (doc 11 §35) --------------------------------------------

export type TimeoutOutcome = "WITHIN_TIMEOUT" | "TIMED_OUT_STATUS_UNKNOWN";

/**
 * Pure: doc 11 §35 -- "do not assume failure if the external provider
 * may have actually completed the operation." A step that exceeds its
 * timeout is TIMED_OUT_STATUS_UNKNOWN, never treated as a confirmed
 * failure -- the caller should reconcile against the provider (same
 * discipline as checkDuplicateFiling()) before retrying, not assume
 * the action never happened.
 */
export function evaluateStepTimeout(elapsedMs: number, timeoutMs: number): TimeoutOutcome {
  return elapsedMs > timeoutMs ? "TIMED_OUT_STATUS_UNKNOWN" : "WITHIN_TIMEOUT";
}
