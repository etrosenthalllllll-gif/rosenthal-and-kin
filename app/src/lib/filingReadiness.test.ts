import { describe, it, expect } from "vitest";
import { evaluateFilingReadiness, type FilingReadinessInput } from "./filingReadiness";

function readyInput(overrides: Partial<FilingReadinessInput> = {}): FilingReadinessInput {
  return {
    packageApproved: true,
    packageIntegrityPassed: true,
    requiredSignaturesComplete: true,
    requiredDocumentsPresent: true,
    requiredFormsValid: true,
    jurisdictionDetermined: true,
    filingDestinationDetermined: true,
    filingMethodDetermined: true,
    filingCredentialsAvailable: true,
    requiredMetadataAvailable: true,
    feeKnown: true,
    paymentMethodAvailable: true,
    feeAmountCents: 5000,
    noUnresolvedHardBlockers: true,
    noConflictingActiveFiling: true,
    ...overrides,
  };
}

describe("filing readiness", () => {
  it("is READY when every check passes", () => {
    const result = evaluateFilingReadiness(readyInput());
    expect(result.outcome).toBe("READY");
    expect(result.blockers).toEqual([]);
  });

  it("is NOT_READY and lists the specific blocker when the package isn't approved", () => {
    const result = evaluateFilingReadiness(readyInput({ packageApproved: false }));
    expect(result.outcome).toBe("NOT_READY");
    expect(result.blockers.some((b) => b.key === "packageApproved")).toBe(true);
  });

  it("lists every failing check, not just the first one", () => {
    const result = evaluateFilingReadiness(readyInput({ packageApproved: false, feeKnown: false }));
    expect(result.blockers.map((b) => b.key).sort()).toEqual(["feeKnown", "packageApproved"]);
  });

  it("does not require a payment method when the fee is zero", () => {
    const result = evaluateFilingReadiness(readyInput({ feeAmountCents: 0, paymentMethodAvailable: false }));
    expect(result.outcome).toBe("READY");
  });

  it("does require a payment method when the fee is nonzero", () => {
    const result = evaluateFilingReadiness(readyInput({ feeAmountCents: 5000, paymentMethodAvailable: false }));
    expect(result.outcome).toBe("NOT_READY");
    expect(result.blockers.some((b) => b.key === "paymentMethodAvailable")).toBe(true);
  });

  it("blocks on a conflicting active filing", () => {
    const result = evaluateFilingReadiness(readyInput({ noConflictingActiveFiling: false }));
    expect(result.outcome).toBe("NOT_READY");
    expect(result.blockers.some((b) => b.key === "noConflictingActiveFiling")).toBe(true);
  });
});
