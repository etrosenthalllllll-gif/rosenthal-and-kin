import { describe, it, expect } from "vitest";
import { evaluateSubmissionGuard, resolveUnknownSubmission } from "./filingSubmissionGuard";

describe("idempotent submission guard", () => {
  it("allows a fresh submission when nothing has been attempted yet", () => {
    expect(evaluateSubmissionGuard({ currentAttemptStatus: "NONE", idempotencyKeyAlreadyUsed: false })).toBe("PROCEED");
  });

  it("allows a retry after a clean failure", () => {
    expect(evaluateSubmissionGuard({ currentAttemptStatus: "FAILED", idempotencyKeyAlreadyUsed: false })).toBe("PROCEED");
  });

  it("blocks a duplicate submission when the idempotency key was already used, regardless of status", () => {
    expect(evaluateSubmissionGuard({ currentAttemptStatus: "NONE", idempotencyKeyAlreadyUsed: true })).toBe(
      "ALREADY_SUBMITTED"
    );
  });

  it("blocks resubmission when the filing is already SUBMITTED", () => {
    expect(evaluateSubmissionGuard({ currentAttemptStatus: "SUBMITTED", idempotencyKeyAlreadyUsed: false })).toBe(
      "ALREADY_SUBMITTED"
    );
  });

  it("blocks a concurrent double-click while a submission is IN_PROGRESS", () => {
    expect(evaluateSubmissionGuard({ currentAttemptStatus: "IN_PROGRESS", idempotencyKeyAlreadyUsed: false })).toBe(
      "SUBMISSION_IN_PROGRESS"
    );
  });

  it("never auto-resubmits on an UNKNOWN status -- must reconcile first", () => {
    expect(evaluateSubmissionGuard({ currentAttemptStatus: "UNKNOWN", idempotencyKeyAlreadyUsed: false })).toBe(
      "UNKNOWN_MUST_RECONCILE"
    );
  });
});

describe("unknown-submission reconciliation", () => {
  it("treats it as submitted once the provider confirms it exists", () => {
    expect(resolveUnknownSubmission(true)).toBe("TREAT_AS_SUBMITTED");
  });

  it("is safe to resubmit only once the provider confirms it does not exist", () => {
    expect(resolveUnknownSubmission(false)).toBe("SAFE_TO_RESUBMIT");
  });

  it("stays STILL_UNKNOWN when the provider itself can't be reached to confirm either way", () => {
    expect(resolveUnknownSubmission(null)).toBe("STILL_UNKNOWN");
  });
});
