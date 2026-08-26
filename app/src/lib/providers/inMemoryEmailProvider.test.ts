import { describe, it, expect } from "vitest";
import { InMemoryEmailProvider } from "./inMemoryEmailProvider";

describe("InMemoryEmailProvider (reference CommunicationProvider)", () => {
  it("sends a message and returns a SENT result", async () => {
    const provider = new InMemoryEmailProvider();
    const result = await provider.send({
      channel: "EMAIL",
      to: "jane@example.com",
      subject: "Hello",
      body: "Hi Jane",
      idempotencyKey: "case-1:outreach:1",
    });
    expect(result.status).toBe("SENT");
    expect(provider.sentMessages).toHaveLength(1);
  });

  it("does not send twice for the same idempotency key", async () => {
    const provider = new InMemoryEmailProvider();
    const message = {
      channel: "EMAIL" as const,
      to: "jane@example.com",
      body: "Hi Jane",
      idempotencyKey: "case-1:outreach:1",
    };

    const first = await provider.send(message);
    const second = await provider.send(message); // simulates a job retry

    expect(first.providerMessageId).toBe(second.providerMessageId);
    expect(provider.sentMessages).toHaveLength(1);
  });

  it("sends separately for different idempotency keys", async () => {
    const provider = new InMemoryEmailProvider();
    await provider.send({
      channel: "EMAIL",
      to: "jane@example.com",
      body: "First",
      idempotencyKey: "case-1:outreach:1",
    });
    await provider.send({
      channel: "EMAIL",
      to: "jane@example.com",
      body: "Second",
      idempotencyKey: "case-1:outreach:2",
    });
    expect(provider.sentMessages).toHaveLength(2);
  });

  it("getStatus returns FAILED for an unknown message id", async () => {
    const provider = new InMemoryEmailProvider();
    expect(await provider.getStatus("nonexistent")).toBe("FAILED");
  });
});
