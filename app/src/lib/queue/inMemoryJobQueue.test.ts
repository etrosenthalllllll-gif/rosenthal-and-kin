import { describe, it, expect } from "vitest";
import { InMemoryJobQueue } from "./inMemoryJobQueue";

describe("InMemoryJobQueue (JobQueueProvider idempotency contract)", () => {
  it("enqueues a new job and reports QUEUED", async () => {
    const queue = new InMemoryJobQueue();
    const result = await queue.enqueue({
      queueName: "outreach",
      jobName: "send-email",
      data: { claimantId: "c1" },
      idempotencyKey: "outreach:c1:1",
    });

    expect(result.status).toBe("QUEUED");
    expect(queue.enqueued).toHaveLength(1);
  });

  it("returns the same jobId and DUPLICATE on a retried enqueue with the same idempotencyKey", async () => {
    const queue = new InMemoryJobQueue();
    const first = await queue.enqueue({
      queueName: "outreach",
      jobName: "send-email",
      data: { claimantId: "c1" },
      idempotencyKey: "outreach:c1:1",
    });
    const retry = await queue.enqueue({
      queueName: "outreach",
      jobName: "send-email",
      data: { claimantId: "c1" },
      idempotencyKey: "outreach:c1:1",
    });

    expect(retry.status).toBe("DUPLICATE");
    expect(retry.jobId).toBe(first.jobId);
    expect(queue.enqueued).toHaveLength(1); // never actually re-enqueued
  });

  it("treats different idempotencyKeys as distinct jobs, even with identical data", async () => {
    const queue = new InMemoryJobQueue();
    const a = await queue.enqueue({
      queueName: "outreach",
      jobName: "send-email",
      data: { claimantId: "c1" },
      idempotencyKey: "outreach:c1:1",
    });
    const b = await queue.enqueue({
      queueName: "outreach",
      jobName: "send-email",
      data: { claimantId: "c1" },
      idempotencyKey: "outreach:c1:2", // e.g. a second, deliberate outreach attempt
    });

    expect(a.jobId).not.toBe(b.jobId);
    expect(a.status).toBe("QUEUED");
    expect(b.status).toBe("QUEUED");
    expect(queue.enqueued).toHaveLength(2);
  });

  it("keeps idempotency keys scoped per instance, not per queueName", async () => {
    // Same idempotencyKey used across two different queueNames: this
    // provider treats the key as globally unique, which is the safer
    // default -- callers that want per-queue scoping should namespace
    // their own keys (e.g. `${queueName}:${key}`).
    const queue = new InMemoryJobQueue();
    const a = await queue.enqueue({
      queueName: "outreach",
      jobName: "send-email",
      data: {},
      idempotencyKey: "shared-key",
    });
    const b = await queue.enqueue({
      queueName: "filing",
      jobName: "submit-filing",
      data: {},
      idempotencyKey: "shared-key",
    });

    expect(b.status).toBe("DUPLICATE");
    expect(b.jobId).toBe(a.jobId);
  });
});
