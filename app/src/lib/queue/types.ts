// Background job queue abstraction -- doc 01 Phase 10, PLAN.md P0-8.
//
// Same discipline as src/lib/providers/types.ts: the rest of the app
// depends only on this interface, never on BullMQ/Redis directly, so the
// queue backend can be swapped (or faked in tests) without touching call
// sites. Idempotency is required on every enqueue -- doc 04 section 34 /
// doc 11 section 36 -- "if a job retries, it must not [produce duplicate
// side effects]." The same discipline that governs
// CommunicationProvider.send() applies here to job creation itself: a
// retried enqueue with the same idempotencyKey must not create a second
// job.

export interface EnqueueJobInput<T = unknown> {
  queueName: string;
  jobName: string;
  data: T;
  idempotencyKey: string;
  /** Optional delay before the job becomes eligible to run, in ms. */
  delayMs?: number;
  /** Optional retry policy; provider-specific defaults apply if omitted. */
  maxAttempts?: number;
}

export interface EnqueueJobResult {
  jobId: string;
  /** QUEUED: newly created. DUPLICATE: idempotencyKey already had a job. */
  status: "QUEUED" | "DUPLICATE";
}

export interface JobQueueProvider {
  enqueue<T = unknown>(input: EnqueueJobInput<T>): Promise<EnqueueJobResult>;
}
