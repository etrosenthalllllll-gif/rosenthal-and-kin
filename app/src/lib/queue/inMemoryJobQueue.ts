// Reference implementation of JobQueueProvider, for tests and local dev
// only -- never used against a real Redis instance. Demonstrates the
// idempotency contract every real backend (BullMQ, etc.) must also honor:
// a retried enqueue with the same idempotencyKey returns the original
// job, it does not create a second one.
import type {
  EnqueueJobInput,
  EnqueueJobResult,
  JobQueueProvider,
} from "./types";

export class InMemoryJobQueue implements JobQueueProvider {
  private jobIdByIdempotencyKey = new Map<string, string>();
  public enqueued: EnqueueJobInput[] = [];

  async enqueue<T = unknown>(
    input: EnqueueJobInput<T>
  ): Promise<EnqueueJobResult> {
    const existing = this.jobIdByIdempotencyKey.get(input.idempotencyKey);
    if (existing) {
      return { jobId: existing, status: "DUPLICATE" };
    }

    this.enqueued.push(input);
    const jobId = `mem-${this.enqueued.length}`;
    this.jobIdByIdempotencyKey.set(input.idempotencyKey, jobId);
    return { jobId, status: "QUEUED" };
  }
}
