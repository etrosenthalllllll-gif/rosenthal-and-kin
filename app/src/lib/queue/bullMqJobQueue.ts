// Real JobQueueProvider backed by BullMQ + Redis (Render Key Value,
// PLAN.md P0-8). Not unit-tested against a live Redis instance -- that
// would make tests depend on network state, the same reason
// src/lib/audit.ts's real DB path isn't unit-tested either. The
// idempotency *contract* is what's tested, against
// InMemoryJobQueue (see inMemoryJobQueue.test.ts); this file is exercised
// for real once a worker actually processes a job (Phase 4+), and via
// `next build`'s type-check in the meantime.
//
// Idempotency approach: the idempotencyKey IS the BullMQ job ID. BullMQ
// keys job state in Redis by ID, so re-adding the same ID while the job
// is still waiting/active/delayed is naturally a no-op at the storage
// layer -- but it does not tell the caller that happened, so we check
// getJob() first and report DUPLICATE explicitly rather than silently
// returning as if a new job had been queued.
import { Queue, type ConnectionOptions } from "bullmq";
import type {
  EnqueueJobInput,
  EnqueueJobResult,
  JobQueueProvider,
} from "./types";

export class BullMqJobQueue implements JobQueueProvider {
  private queues = new Map<string, Queue>();

  constructor(private readonly connection: ConnectionOptions) {}

  private getQueue(queueName: string): Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      queue = new Queue(queueName, { connection: this.connection });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  async enqueue<T = unknown>(
    input: EnqueueJobInput<T>
  ): Promise<EnqueueJobResult> {
    const queue = this.getQueue(input.queueName);

    const existing = await queue.getJob(input.idempotencyKey);
    if (existing) {
      return { jobId: existing.id ?? input.idempotencyKey, status: "DUPLICATE" };
    }

    const job = await queue.add(input.jobName, input.data, {
      jobId: input.idempotencyKey,
      delay: input.delayMs,
      attempts: input.maxAttempts,
    });

    return { jobId: job.id ?? input.idempotencyKey, status: "QUEUED" };
  }

  /** Closes all underlying BullMQ Queue connections. Call on shutdown. */
  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}

/**
 * Builds a BullMqJobQueue from a redis:// connection string (Render's
 * REDIS_URL env var). BullMQ/ioredis want a parsed options object, not a
 * raw URL, when maxRetriesPerRequest needs overriding -- BullMQ requires
 * it set to null so its own retry/backoff logic (not ioredis's) governs
 * blocking commands.
 */
export function createBullMqJobQueue(redisUrl: string): BullMqJobQueue {
  const url = new URL(redisUrl);
  return new BullMqJobQueue({
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  });
}
