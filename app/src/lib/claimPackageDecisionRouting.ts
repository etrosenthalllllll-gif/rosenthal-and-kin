// Claim package decision integration -- doc 07 sections 44-48. PLAN.md
// P6-17.
//
// "Integrate claim package review with the existing Decision
// Dashboard: APPROVE / REVISE / REJECT / REQUEST_MORE_EVIDENCE /
// ESCALATE. At approval, create an immutable approval snapshot."
//
// Same wiring-layer role as documentDecisionRouting.ts (P4-14) /
// verificationDecisionRouting.ts (P5-10): composes
// claimCompletenessEngine.ts's (P6-13) and claimPackageIntegrity.ts's
// (P6-15) outputs into a DecisionRecommendation against
// decisionTypes.ts's REVIEW_CLAIM_PACKAGE entry. Pure -- no live
// Decision row created here. doc 07 section 45's AI-assisted package
// review needs an AIProvider (blocked, no vendor account exists yet);
// this routing logic works entirely off the completeness/integrity
// signals that are already real.

import type { DecisionTypeKey } from "./decisionTypes";
import type { CompletenessEvaluationResult } from "./claimCompletenessEngine";
import type { PackageIntegrityResult } from "./claimPackageIntegrity";

export interface DecisionRecommendation {
  decisionTypeKey: DecisionTypeKey;
  reason: string;
  evidenceRefs: string[];
}

/**
 * Pure: doc 07 sections 44-46. A package that's fully COMPLETE and
 * passes integrity needs no operator decision -- it can advance on its
 * own. Anything else (INCOMPLETE, REQUIRES_REVIEW, or an integrity
 * failure) becomes a REVIEW_CLAIM_PACKAGE decision, with the reason
 * combining whichever of the two modules actually flagged something so
 * an operator sees the complete picture in one place.
 */
export function planClaimPackageReviewDecision(
  claimPreparationId: string,
  completeness: CompletenessEvaluationResult,
  integrity: PackageIntegrityResult
): DecisionRecommendation | null {
  if (completeness.status === "COMPLETE" && integrity.passed) {
    return null;
  }

  const reasons: string[] = [];
  if (completeness.status !== "COMPLETE") {
    reasons.push(completeness.explanation);
  }
  if (!integrity.passed) {
    reasons.push(`Package integrity check failed: ${integrity.issues.map((i) => i.detail).join(" ")}`);
  }

  return {
    decisionTypeKey: "REVIEW_CLAIM_PACKAGE",
    reason: reasons.join("\n"),
    evidenceRefs: [claimPreparationId],
  };
}

// --- Approval snapshot (doc 07 section 48) --------------------------
//
// Same create-only discipline as verificationSnapshot.ts (P5-11):
// pure builder, no DB access, caller-supplied timestamp, and the
// immutability guarantee (never UPDATE this row) lives in the
// schema/calling-convention, not in this function.

export interface ClaimPackageApprovalSnapshotInput {
  claimPreparationId: string;
  packageVersion: number;
  completenessStatus: string;
  integrityPassed: boolean;
  reviewStatus: string;
  reviewerId?: string | null;
  createdAt: string; // ISO timestamp
}

export interface ClaimPackageApprovalSnapshotRecord extends ClaimPackageApprovalSnapshotInput {
  overallApproved: boolean;
  summaryLines: string[];
}

/**
 * Pure: doc 07 section 48. Builds an immutable point-in-time record of
 * a package's approval state. The caller `create()`s this -- never
 * `update()`s an existing row.
 */
export function buildClaimPackageApprovalSnapshot(
  input: ClaimPackageApprovalSnapshotInput
): ClaimPackageApprovalSnapshotRecord {
  const overallApproved =
    input.completenessStatus.toUpperCase() === "COMPLETE" &&
    input.integrityPassed &&
    input.reviewStatus.toUpperCase() === "APPROVED";

  const summaryLines = [
    `Package version: ${input.packageVersion}`,
    `Completeness: ${input.completenessStatus}`,
    `Integrity check: ${input.integrityPassed ? "Passed" : "Failed"}`,
    `Review status: ${input.reviewStatus}`,
  ];

  return { ...input, overallApproved, summaryLines };
}
