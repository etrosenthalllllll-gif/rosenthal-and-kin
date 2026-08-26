import { describe, it, expect } from "vitest";
import {
  createCorrectionCase,
  evaluateResubmissionReadiness,
  checkDuplicateFilingProtection,
  type ResubmissionReadinessInput,
} from "./filingCorrection";

describe("correction case creation", () => {
  it("starts OPEN, unassigned, unresolved", () => {
    const correction = createCorrectionCase({
      id: "corr-1",
      filingId: "filing-1",
      filingAttemptId: "attempt-1",
      reason: "Missing relationship document",
      requiredAction: "Upload proof of relationship",
      createdAt: "2026-08-26T00:00:00.000Z",
    });
    expect(correction.status).toBe("OPEN");
    expect(correction.assignedOperator).toBeNull();
    expect(correction.resolution).toBeNull();
  });
});

function readyResubmission(overrides: Partial<ResubmissionReadinessInput> = {}): ResubmissionReadinessInput {
  return {
    correctionResolved: true,
    newPackageApproved: true,
    feeRequirementsVerified: true,
    paymentRequirementsVerified: true,
    destinationVerified: true,
    noUnresolvedBlocker: true,
    providerAcceptsResubmission: true,
    ...overrides,
  };
}

describe("resubmission readiness", () => {
  it("is READY when every check passes", () => {
    const result = evaluateResubmissionReadiness(readyResubmission());
    expect(result.outcome).toBe("READY");
    expect(result.blockers).toEqual([]);
  });

  it("is NOT_READY and names the blocker when the correction isn't resolved", () => {
    const result = evaluateResubmissionReadiness(readyResubmission({ correctionResolved: false }));
    expect(result.outcome).toBe("NOT_READY");
    expect(result.blockers.some((b) => b.key === "correctionResolved")).toBe(true);
  });

  it("lists every failing check, not just the first", () => {
    const result = evaluateResubmissionReadiness(
      readyResubmission({ correctionResolved: false, providerAcceptsResubmission: false })
    );
    expect(result.blockers.map((b) => b.key).sort()).toEqual(["correctionResolved", "providerAcceptsResubmission"]);
  });
});

describe("duplicate-filing protection", () => {
  it("proceeds when there are no existing active filings", () => {
    const result = checkDuplicateFilingProtection([]);
    expect(result.decision).toBe("PROCEED");
  });

  it("pauses and requires review when a possible duplicate exists, never silently blocking or allowing", () => {
    const result = checkDuplicateFilingProtection([{ filingId: "filing-existing", status: "PROCESSING" }]);
    expect(result.decision).toBe("PAUSE_REQUIRES_REVIEW");
    expect(result.existingFilings).toHaveLength(1);
  });
});
