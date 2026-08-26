import { describe, it, expect } from "vitest";
import {
  sourceOfTruthFor,
  detectSyncException,
  buildExternalApiSyncRecord,
  evaluatePollResult,
  evaluateWebhookIntake,
} from "./crossSystemSync";

describe("source of truth", () => {
  it("names the owning system for a known data object", () => {
    expect(sourceOfTruthFor("filingStatus")).toBe("Filing system");
    expect(sourceOfTruthFor("paymentStatus")).toBe("Financial system");
  });

  it("returns undefined for an unregistered data object rather than guessing", () => {
    expect(sourceOfTruthFor("somethingElse")).toBeUndefined();
  });
});

describe("sync exception detection", () => {
  it("returns null when internal and external values agree", () => {
    expect(
      detectSyncException({
        dataObject: "filingStatus",
        entityId: "f-1",
        internalValue: "SUBMITTED",
        externalValue: "SUBMITTED",
        internalSystem: "Filing system",
        externalSystem: "Provider",
      })
    ).toBeNull();
  });

  it("flags a disagreement for review rather than silently overwriting either side", () => {
    const exception = detectSyncException({
      dataObject: "filingStatus",
      entityId: "f-1",
      internalValue: "SUBMITTED",
      externalValue: "REJECTED",
      internalSystem: "Filing system",
      externalSystem: "Provider",
    });
    expect(exception?.requiresReview).toBe(true);
    expect(exception?.internalValue).toBe("SUBMITTED");
    expect(exception?.externalValue).toBe("REJECTED");
  });
});

describe("external API sync record", () => {
  it("starts retryCount at 0 and stamps requestTimestamp from now", () => {
    const record = buildExternalApiSyncRecord({
      provider: "Filing Provider",
      endpoint: "/submissions",
      requestId: "req-1",
      idempotencyKey: "RK-1842:SUBMIT_FILING:1:op-1",
      now: "2026-08-26T00:00:00.000Z",
    });
    expect(record.retryCount).toBe(0);
    expect(record.requestTimestamp).toBe("2026-08-26T00:00:00.000Z");
  });
});

describe("polling idempotency", () => {
  it("reports STATUS_UNCHANGED and does nothing when the status hasn't moved", () => {
    expect(evaluatePollResult("SUBMITTED", "SUBMITTED")).toBe("STATUS_UNCHANGED");
  });

  it("reports STATUS_CHANGED when the provider's status has moved", () => {
    expect(evaluatePollResult("SUBMITTED", "ACCEPTED")).toBe("STATUS_CHANGED");
  });

  it("reports STATUS_CHANGED the first time a status is observed (no prior status)", () => {
    expect(evaluatePollResult(null, "SUBMITTED")).toBe("STATUS_CHANGED");
  });
});

describe("webhook intake dedup", () => {
  it("accepts a webhook id never seen before", () => {
    expect(evaluateWebhookIntake({ webhookId: "wh-1", eventType: "FILING.ACCEPTED", payload: {} }, new Set())).toBe(
      "ACCEPTED_FOR_PROCESSING"
    );
  });

  it("ignores a duplicate-delivered webhook", () => {
    expect(
      evaluateWebhookIntake({ webhookId: "wh-1", eventType: "FILING.ACCEPTED", payload: {} }, new Set(["wh-1"]))
    ).toBe("DUPLICATE_IGNORED");
  });
});
