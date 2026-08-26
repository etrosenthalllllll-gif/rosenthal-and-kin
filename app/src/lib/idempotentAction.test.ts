import { describe, it, expect } from "vitest";
import {
  buildIdempotencyKey,
  checkIdempotentAction,
  buildDuplicateEmailKey,
  checkDuplicateFiling,
  isDuplicatePayment,
  evaluateStepTimeout,
} from "./idempotentAction";

describe("idempotency key", () => {
  it("builds the doc's own worked-example shape", () => {
    expect(buildIdempotencyKey({ caseId: "RK-1842", actionType: "SEND_EMAIL", actionVersion: 1, operationId: "op-1" })).toBe(
      "RK-1842:SEND_EMAIL:1:op-1"
    );
  });

  it("produces identical keys for identical inputs", () => {
    const a = buildIdempotencyKey({ caseId: "RK-1", actionType: "X", actionVersion: 2, operationId: "op" });
    const b = buildIdempotencyKey({ caseId: "RK-1", actionType: "X", actionVersion: 2, operationId: "op" });
    expect(a).toBe(b);
  });
});

describe("check-before-execute", () => {
  it("returns the existing result rather than re-executing", () => {
    const store = new Map([["key-1", { messageId: "m-1" }]]);
    const outcome = checkIdempotentAction("key-1", store);
    expect(outcome.status).toBe("ALREADY_COMPLETED");
    if (outcome.status === "ALREADY_COMPLETED") expect(outcome.result.messageId).toBe("m-1");
  });

  it("says PROCEED for a key never seen before", () => {
    expect(checkIdempotentAction("key-2", new Map()).status).toBe("PROCEED");
  });
});

describe("duplicate email protection", () => {
  it("builds a composite key from all five doc-required fields", () => {
    const key = buildDuplicateEmailKey({
      caseId: "RK-1842",
      recipient: "heir@example.com",
      templateId: "outreach-v1",
      workflowId: "wf-1",
      actionId: "action-1",
    });
    expect(key).toBe("RK-1842:heir@example.com:outreach-v1:wf-1:action-1");
  });
});

describe("duplicate filing protection", () => {
  it("treats a filing with a submissionId as already submitted", () => {
    expect(checkDuplicateFiling({ filingId: "f-1", submissionId: "sub-1" })).toBe("ALREADY_SUBMITTED");
  });

  it("treats a filing with a providerReference as already submitted", () => {
    expect(checkDuplicateFiling({ filingId: "f-1", providerReference: "prov-1" })).toBe("ALREADY_SUBMITTED");
  });

  it("only allows submission when neither signal is present", () => {
    expect(checkDuplicateFiling({ filingId: "f-1" })).toBe("SAFE_TO_SUBMIT");
  });
});

describe("duplicate payment protection", () => {
  const existing = [{ transactionId: "tx-1", amountCents: 5000, date: "2026-08-20", invoiceId: "inv-1" }];

  it("flags a matching transactionId as a duplicate", () => {
    expect(isDuplicatePayment({ transactionId: "tx-1", amountCents: 9999, date: "2026-09-01", invoiceId: "inv-9" }, existing)).toBe(
      true
    );
  });

  it("flags a match on invoice+amount+date when there's no transaction id overlap", () => {
    expect(
      isDuplicatePayment({ transactionId: "tx-2", amountCents: 5000, date: "2026-08-20", invoiceId: "inv-1" }, existing)
    ).toBe(true);
  });

  it("does not flag a genuinely distinct payment", () => {
    expect(
      isDuplicatePayment({ transactionId: "tx-3", amountCents: 100, date: "2026-08-21", invoiceId: "inv-2" }, existing)
    ).toBe(false);
  });
});

describe("step timeout evaluation", () => {
  it("is WITHIN_TIMEOUT under the limit", () => {
    expect(evaluateStepTimeout(5000, 10_000)).toBe("WITHIN_TIMEOUT");
  });

  it("is TIMED_OUT_STATUS_UNKNOWN over the limit -- never assumed FAILED", () => {
    expect(evaluateStepTimeout(15_000, 10_000)).toBe("TIMED_OUT_STATUS_UNKNOWN");
  });
});
