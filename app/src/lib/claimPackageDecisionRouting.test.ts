import { describe, it, expect } from "vitest";
import {
  planClaimPackageReviewDecision,
  buildClaimPackageApprovalSnapshot,
} from "./claimPackageDecisionRouting";
import type { CompletenessEvaluationResult } from "./claimCompletenessEngine";
import type { PackageIntegrityResult } from "./claimPackageIntegrity";

const COMPLETE: CompletenessEvaluationResult = {
  status: "COMPLETE",
  hardBlockers: [],
  softWarnings: [],
  explanation: "All requirements satisfied; no outstanding blockers or warnings.",
};

const PASSED_INTEGRITY: PackageIntegrityResult = { passed: true, issues: [] };

describe("claim package decision routing", () => {
  it("returns no decision when the package is complete and integrity passes", () => {
    expect(planClaimPackageReviewDecision("prep-1", COMPLETE, PASSED_INTEGRITY)).toBeNull();
  });

  it("recommends REVIEW_CLAIM_PACKAGE when completeness is not COMPLETE", () => {
    const incomplete: CompletenessEvaluationResult = {
      status: "INCOMPLETE",
      hardBlockers: [{ key: "documents", isHardBlocker: true, satisfied: false, explanation: "Missing death certificate." }],
      softWarnings: [],
      explanation: "Missing death certificate.",
    };
    const result = planClaimPackageReviewDecision("prep-1", incomplete, PASSED_INTEGRITY);
    expect(result?.decisionTypeKey).toBe("REVIEW_CLAIM_PACKAGE");
    expect(result?.reason).toContain("Missing death certificate.");
  });

  it("recommends REVIEW_CLAIM_PACKAGE when integrity fails, even if completeness is COMPLETE", () => {
    const failedIntegrity: PackageIntegrityResult = {
      passed: false,
      issues: [{ type: "MISSING_DOCUMENT", documentId: "doc-1", detail: "doc-1 does not exist." }],
    };
    const result = planClaimPackageReviewDecision("prep-1", COMPLETE, failedIntegrity);
    expect(result?.decisionTypeKey).toBe("REVIEW_CLAIM_PACKAGE");
    expect(result?.reason).toContain("doc-1 does not exist.");
  });

  it("combines both completeness and integrity reasons when both are unsatisfied", () => {
    const incomplete: CompletenessEvaluationResult = {
      status: "REQUIRES_REVIEW",
      hardBlockers: [],
      softWarnings: [{ key: "competingHeir", isHardBlocker: false, satisfied: false, explanation: "Competing heir needs review." }],
      explanation: "Competing heir needs review.",
    };
    const failedIntegrity: PackageIntegrityResult = {
      passed: false,
      issues: [{ type: "MISSING_REQUIRED_SIGNATURE", documentId: "", detail: "Claimant signature missing." }],
    };
    const result = planClaimPackageReviewDecision("prep-1", incomplete, failedIntegrity);
    expect(result?.reason).toContain("Competing heir needs review.");
    expect(result?.reason).toContain("Claimant signature missing.");
  });
});

describe("claim package approval snapshot", () => {
  it("is overallApproved only when complete, integrity-passed, and reviewStatus is APPROVED", () => {
    const snapshot = buildClaimPackageApprovalSnapshot({
      claimPreparationId: "prep-1",
      packageVersion: 2,
      completenessStatus: "COMPLETE",
      integrityPassed: true,
      reviewStatus: "APPROVED",
      createdAt: "2026-08-26T00:00:00.000Z",
    });
    expect(snapshot.overallApproved).toBe(true);
    expect(snapshot.summaryLines).toContain("Package version: 2");
  });

  it("is not overallApproved when integrity failed even if reviewStatus is APPROVED", () => {
    const snapshot = buildClaimPackageApprovalSnapshot({
      claimPreparationId: "prep-1",
      packageVersion: 1,
      completenessStatus: "COMPLETE",
      integrityPassed: false,
      reviewStatus: "APPROVED",
      createdAt: "2026-08-26T00:00:00.000Z",
    });
    expect(snapshot.overallApproved).toBe(false);
  });
});
