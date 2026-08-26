import { describe, it, expect } from "vitest";
import { evaluateRecoveryVerification, type RecoveryVerificationInput } from "./recoveryVerification";

function input(overrides: Partial<RecoveryVerificationInput> = {}): RecoveryVerificationInput {
  return {
    amountPresent: true,
    sourcePresent: true,
    datePresent: true,
    referencePresent: true,
    supportingDocumentPresent: true,
    caseAssociationConfirmed: true,
    claimAssociationConfirmed: true,
    conflictsWithExpectedRecovery: false,
    ...overrides,
  };
}

describe("recovery verification", () => {
  it("is VERIFIED when every check passes and there's no conflict", () => {
    const result = evaluateRecoveryVerification(input());
    expect(result.outcome).toBe("VERIFIED");
    expect(result.unmetChecks).toEqual([]);
  });

  it("requires review when a required field is missing", () => {
    const result = evaluateRecoveryVerification(input({ referencePresent: false }));
    expect(result.outcome).toBe("REQUIRES_REVIEW");
    expect(result.unmetChecks.some((c) => c.key === "referencePresent")).toBe(true);
  });

  it("requires review on a conflict with the expected recovery, even when every other field is clean", () => {
    const result = evaluateRecoveryVerification(input({ conflictsWithExpectedRecovery: true }));
    expect(result.outcome).toBe("REQUIRES_REVIEW");
    expect(result.unmetChecks.some((c) => c.key === "conflictsWithExpectedRecovery")).toBe(true);
  });

  it("lists every unmet check, not just the first", () => {
    const result = evaluateRecoveryVerification(input({ amountPresent: false, sourcePresent: false }));
    expect(result.unmetChecks).toHaveLength(2);
  });
});
