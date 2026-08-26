import { describe, it, expect } from "vitest";
import { evaluateSubmissionAuthorization, applyHumanOverride, type SubmissionAuthorizationInput } from "./filingAuthorization";

function baseInput(overrides: Partial<SubmissionAuthorizationInput> = {}): SubmissionAuthorizationInput {
  return {
    mode: "MANUAL_APPROVAL_REQUIRED",
    automationLevel: 1,
    isHighRiskCondition: false,
    readinessOutcome: "READY",
    operatorExplicitlyClickedSubmit: false,
    caseLevelApprovalGranted: false,
    ...overrides,
  };
}

describe("submission authorization", () => {
  it("blocks submission when not ready, regardless of mode/level", () => {
    const result = evaluateSubmissionAuthorization(
      baseInput({ readinessOutcome: "NOT_READY", automationLevel: 4 })
    );
    expect(result).toBe("BLOCKED_NOT_READY");
  });

  it("manual mode requires an explicit operator submit click", () => {
    expect(evaluateSubmissionAuthorization(baseInput())).toBe("REQUIRES_OPERATOR_SUBMIT");
    expect(evaluateSubmissionAuthorization(baseInput({ operatorExplicitlyClickedSubmit: true }))).toBe("AUTHORIZED");
  });

  it("automation level 3 requires case-level approval", () => {
    const input = baseInput({ mode: "AUTOMATIC_SUBMISSION_AFTER_CONFIGURED_APPROVAL", automationLevel: 3 });
    expect(evaluateSubmissionAuthorization(input)).toBe("REQUIRES_CASE_APPROVAL");
    expect(evaluateSubmissionAuthorization({ ...input, caseLevelApprovalGranted: true })).toBe("AUTHORIZED");
  });

  it("automation level 4 authorizes automatically once ready and not high-risk", () => {
    const input = baseInput({ mode: "AUTOMATIC_SUBMISSION_AFTER_CONFIGURED_APPROVAL", automationLevel: 4 });
    expect(evaluateSubmissionAuthorization(input)).toBe("AUTHORIZED");
  });

  it("a high-risk condition always requires an explicit operator submit, even at level 4", () => {
    const input = baseInput({
      mode: "AUTOMATIC_SUBMISSION_AFTER_CONFIGURED_APPROVAL",
      automationLevel: 4,
      isHighRiskCondition: true,
    });
    expect(evaluateSubmissionAuthorization(input)).toBe("REQUIRES_OPERATOR_SUBMIT");
    expect(evaluateSubmissionAuthorization({ ...input, operatorExplicitlyClickedSubmit: true })).toBe("AUTHORIZED");
  });
});

describe("human override", () => {
  it("never overrides a hard blocker, even with a complete override record", () => {
    const result = applyHumanOverride(
      "BLOCKED_NOT_READY",
      { reason: "urgent", operatorId: "op-1", timestamp: "t1", affectedRule: "readiness" },
      true
    );
    expect(result.authorized).toBe(false);
  });

  it("rejects an incomplete override record for a soft blocker", () => {
    const result = applyHumanOverride(
      "REQUIRES_CASE_APPROVAL",
      { reason: "", operatorId: "op-1", timestamp: "t1", affectedRule: "case-approval" },
      false
    );
    expect(result.authorized).toBe(false);
  });

  it("accepts a complete override record for a soft (non-hard) blocker", () => {
    const result = applyHumanOverride(
      "REQUIRES_CASE_APPROVAL",
      { reason: "case reviewed manually", operatorId: "op-1", timestamp: "t1", affectedRule: "case-approval" },
      false
    );
    expect(result.authorized).toBe(true);
  });

  it("an already-AUTHORIZED decision needs no override", () => {
    const result = applyHumanOverride(
      "AUTHORIZED",
      { reason: "", operatorId: "", timestamp: "", affectedRule: "" },
      false
    );
    expect(result.authorized).toBe(true);
  });
});
