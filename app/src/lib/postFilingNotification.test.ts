import { describe, it, expect } from "vitest";
import {
  canSendPostFilingNotification,
  createPostFilingNotification,
  markNotificationSent,
  markNotificationDelivered,
  isConfirmedDelivered,
  type CreateNotificationInput,
} from "./postFilingNotification";

describe("canSendPostFilingNotification (delegates to communicationPreferences.ts)", () => {
  it("blocks sending when the person has a centralized do-not-contact status", () => {
    const result = canSendPostFilingNotification(
      { emailAllowed: true, smsAllowed: true, voiceAllowed: true, mailAllowed: true, doNotContact: true },
      "EMAIL"
    );
    expect(result.allowed).toBe(false);
  });

  it("allows sending on a permitted channel", () => {
    const result = canSendPostFilingNotification(
      { emailAllowed: true, smsAllowed: true, voiceAllowed: true, mailAllowed: true, doNotContact: false },
      "EMAIL"
    );
    expect(result.allowed).toBe(true);
  });
});

function input(overrides: Partial<CreateNotificationInput> = {}): CreateNotificationInput {
  return {
    notificationType: "DOCUMENT_REQUEST",
    templateId: "doc-request-v1",
    templateVersion: "1",
    recipientPersonId: "person-1",
    channel: "EMAIL",
    postFilingCaseId: "case-1",
    trigger: "authority requested additional evidence",
    createdAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("notification provenance", () => {
  it("starts QUEUED with every provenance field present", () => {
    const record = createPostFilingNotification(input());
    expect(record.deliveryStatus).toBe("QUEUED");
    expect(record.templateId).toBe("doc-request-v1");
    expect(record.templateVersion).toBe("1");
    expect(record.messageId).toBeNull();
  });
});

describe("delivery tracking", () => {
  it("SENT is a distinct status from DELIVERED -- never assumed", () => {
    const record = createPostFilingNotification(input());
    const sent = markNotificationSent(record, "msg-123");
    expect(sent.deliveryStatus).toBe("SENT");
    expect(isConfirmedDelivered(sent)).toBe(false);
  });

  it("DELIVERED requires its own explicit transition", () => {
    const record = createPostFilingNotification(input());
    const sent = markNotificationSent(record, "msg-123");
    const delivered = markNotificationDelivered(sent);
    expect(delivered.deliveryStatus).toBe("DELIVERED");
    expect(isConfirmedDelivered(delivered)).toBe(true);
  });
});
