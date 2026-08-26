// Retry engine + failure classification + dead-letter queue -- doc 11
// sections 30-34. PLAN.md P10-8.
//
// "Retry only failures that are potentially transient... Do not
// blindly retry: invalid data, permission failure, permanent
// validation failure, rejected filing, human decision rejection." /
// Retry policy: max attempts, initial delay, backoff multiplier,
// max delay, jitter, retryable error types. / "Failed jobs that cannot
// automatically recover should enter DEAD_LETTER_QUEUE."

export type FailureClassification =
  | "TRANSIENT"
  | "PERMANENT"
  | "DATA_ERROR"
  | "AUTH_ERROR"
  | "RATE_LIMIT"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "HUMAN_REVIEW_REQUIRED"
  | "UNKNOWN";

// Only these classifications are ever retried automatically -- every
// other classification (including UNKNOWN) goes straight to
// human/dead-letter handling. Fail closed: an unrecognized failure is
// never assumed retryable.
const RETRYABLE_CLASSIFICATIONS: ReadonlySet<FailureClassification> = new Set([
  "TRANSIENT",
  "RATE_LIMIT",
  "PROVIDER_ERROR",
  "TIMEOUT",
]);

export function isRetryableFailure(classification: FailureClassification): boolean {
  return RETRYABLE_CLASSIFICATIONS.has(classification);
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
  jitterMs?: number;
}

/**
 * Pure: exponential backoff, capped at maxDelayMs, optional bounded
 * jitter supplied by the caller (this module never calls Math.random()
 * itself -- deterministic output for a given input, same discipline as
 * financialAdjustments.ts's applyRounding()).
 */
export function computeRetryDelayMs(policy: RetryPolicy, attemptNumber: number, jitter = 0): number {
  const raw = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attemptNumber - 1);
  const capped = Math.min(raw, policy.maxDelayMs);
  return Math.round(capped + jitter);
}

export type RetryDecision =
  | { action: "RETRY"; delayMs: number }
  | { action: "DEAD_LETTER"; reason: string };

/**
 * Pure: doc 11 §30-31's core decision -- given a classified failure
 * and how many attempts have already been made, decide whether to
 * retry (with the computed delay) or send the job to the dead-letter
 * queue. A non-retryable classification always dead-letters
 * immediately, regardless of how many attempts remain.
 */
export function planRetry(
  classification: FailureClassification,
  policy: RetryPolicy,
  attemptsSoFar: number,
  jitter = 0
): RetryDecision {
  if (!isRetryableFailure(classification)) {
    return { action: "DEAD_LETTER", reason: `Failure classification "${classification}" is not retryable.` };
  }
  if (attemptsSoFar >= policy.maxAttempts) {
    return { action: "DEAD_LETTER", reason: `Exhausted ${policy.maxAttempts} retry attempts.` };
  }
  return { action: "RETRY", delayMs: computeRetryDelayMs(policy, attemptsSoFar + 1, jitter) };
}

// --- Dead-letter queue (doc 11 §33) -----------------------------------------

export type DeadLetterAction = "RETRY" | "SKIP" | "REASSIGN" | "ESCALATE" | "CANCEL";

export interface DeadLetterEntry {
  jobId: string;
  workflowId?: string;
  caseId?: string;
  classification: FailureClassification;
  error: string;
  attemptCount: number;
  createdAt: string;
  lastAction?: DeadLetterAction;
}

/**
 * Pure: builds a dead-letter entry from a failed job -- always
 * created, never silently dropped, so every unrecoverable failure
 * stays visible to an operator (doc 11 §33's own operator-action list
 * is exposed via DeadLetterAction, applied by whatever caller performs
 * the chosen action).
 */
export function buildDeadLetterEntry(params: {
  jobId: string;
  workflowId?: string;
  caseId?: string;
  classification: FailureClassification;
  error: string;
  attemptCount: number;
  now: string;
}): DeadLetterEntry {
  return {
    jobId: params.jobId,
    workflowId: params.workflowId,
    caseId: params.caseId,
    classification: params.classification,
    error: params.error,
    attemptCount: params.attemptCount,
    createdAt: params.now,
  };
}
