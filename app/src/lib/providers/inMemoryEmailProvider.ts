// Reference implementation of CommunicationProvider, for tests and local
// dev only -- never used against a real inbox. Demonstrates the
// idempotency contract every real provider (Twilio, etc.) must also honor:
// doc 04 section 34 / doc 11 section 36 -- "if a job retries, it must not
// send duplicate messages."
import type {
  CommunicationProvider,
  OutboundMessage,
  SendResult,
} from "./types";

export class InMemoryEmailProvider implements CommunicationProvider {
  channel = "EMAIL" as const;
  private sentByIdempotencyKey = new Map<string, SendResult>();
  public sentMessages: OutboundMessage[] = [];

  async send(message: OutboundMessage): Promise<SendResult> {
    const existing = this.sentByIdempotencyKey.get(message.idempotencyKey);
    if (existing) {
      return existing; // idempotent replay -- do not send again
    }

    this.sentMessages.push(message);
    const result: SendResult = {
      providerMessageId: `mem-${this.sentMessages.length}`,
      status: "SENT",
    };
    this.sentByIdempotencyKey.set(message.idempotencyKey, result);
    return result;
  }

  async getStatus(providerMessageId: string): Promise<SendResult["status"]> {
    const found = [...this.sentByIdempotencyKey.values()].find(
      (r) => r.providerMessageId === providerMessageId
    );
    return found?.status ?? "FAILED";
  }
}
