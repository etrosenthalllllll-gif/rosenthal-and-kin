// Verification snapshot -- doc 06 section 34. PLAN.md P5-11.
//
// "At important workflow stages, create a verification snapshot...
// CLAIM READINESS SNAPSHOT: Identity: Verified / Decedent: Verified /
// Relationship: Supported / Competing heirs: None identified /
// Conflicts: None / Required evidence: Complete / Review status:
// Approved. Store: Snapshot ID, Case ID, Timestamp, Evidence state,
// Verification state, Reviewer where applicable. Future evidence
// should not rewrite historical snapshots."
//
// Pure builder only -- no DB access. `createdAt` is a caller-supplied
// timestamp rather than this module calling `new Date()` itself, so
// the function stays fully deterministic and testable, same as every
// other pure module in this codebase. The actual immutability
// guarantee (never UPDATE a snapshot row) is a schema.prisma /
// calling-convention discipline documented on the VerificationSnapshot
// model itself, not something a pure function can enforce on its own.

export interface VerificationSnapshotInput {
  estateId: string;
  claimantId?: string | null;
  workflowStage: string;
  identityStatus: string;
  relationshipStatus: string;
  competingHeirsCount: number;
  conflictsCount: number;
  requiredEvidenceComplete: boolean;
  reviewStatus: string;
  reviewerId?: string | null;
  createdAt: string; // ISO timestamp
}

export interface VerificationSnapshotRecord extends VerificationSnapshotInput {
  // doc 06 section 39's own "READY FOR OPERATOR APPROVAL" / "NOT_READY"
  // shape, derived here rather than duplicated -- a snapshot with
  // conflicts or an incomplete evidence set is never ready regardless
  // of what any individual field says.
  overallReady: boolean;
  summaryLines: string[];
}

/**
 * Pure: doc 06 section 34. Builds an immutable point-in-time record of
 * the case's current verification state. Does not read or write
 * anything -- the caller is responsible for `create()`-ing this (never
 * `update()`-ing an existing row).
 */
export function buildVerificationSnapshot(
  input: VerificationSnapshotInput
): VerificationSnapshotRecord {
  const overallReady =
    input.competingHeirsCount === 0 &&
    input.conflictsCount === 0 &&
    input.requiredEvidenceComplete &&
    input.reviewStatus.toUpperCase() === "APPROVED";

  // doc 06 section 34's own example format, verbatim shape --
  // "Competing heirs: None identified" / "Conflicts: None" when the
  // counts are zero, the actual count otherwise.
  const summaryLines = [
    `Identity: ${input.identityStatus}`,
    `Relationship: ${input.relationshipStatus}`,
    `Competing heirs: ${input.competingHeirsCount === 0 ? "None identified" : input.competingHeirsCount}`,
    `Conflicts: ${input.conflictsCount === 0 ? "None" : input.conflictsCount}`,
    `Required evidence: ${input.requiredEvidenceComplete ? "Complete" : "Incomplete"}`,
    `Review status: ${input.reviewStatus}`,
  ];

  return { ...input, overallReady, summaryLines };
}
