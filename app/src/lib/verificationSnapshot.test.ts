import { describe, it, expect } from "vitest";
import { buildVerificationSnapshot, type VerificationSnapshotInput } from "./verificationSnapshot";

function input(overrides: Partial<VerificationSnapshotInput> = {}): VerificationSnapshotInput {
  return {
    estateId: "estate-1",
    claimantId: "claimant-1",
    workflowStage: "CLAIM_PREPARATION",
    identityStatus: "Verified",
    relationshipStatus: "Supported",
    competingHeirsCount: 0,
    conflictsCount: 0,
    requiredEvidenceComplete: true,
    reviewStatus: "Approved",
    reviewerId: "user-1",
    createdAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildVerificationSnapshot", () => {
  it("reproduces doc 06 section 34's own worked example summary lines", () => {
    const snapshot = buildVerificationSnapshot(input());
    expect(snapshot.summaryLines).toEqual([
      "Identity: Verified",
      "Relationship: Supported",
      "Competing heirs: None identified",
      "Conflicts: None",
      "Required evidence: Complete",
      "Review status: Approved",
    ]);
    expect(snapshot.overallReady).toBe(true);
  });

  it("shows the actual count rather than 'None' when competing heirs or conflicts exist", () => {
    const snapshot = buildVerificationSnapshot(
      input({ competingHeirsCount: 2, conflictsCount: 1 })
    );
    expect(snapshot.summaryLines).toContain("Competing heirs: 2");
    expect(snapshot.summaryLines).toContain("Conflicts: 1");
  });

  it("is not overallReady when a competing heir or conflict exists", () => {
    expect(buildVerificationSnapshot(input({ competingHeirsCount: 1 })).overallReady).toBe(false);
    expect(buildVerificationSnapshot(input({ conflictsCount: 1 })).overallReady).toBe(false);
  });

  it("is not overallReady when required evidence is incomplete or review isn't approved", () => {
    expect(
      buildVerificationSnapshot(input({ requiredEvidenceComplete: false })).overallReady
    ).toBe(false);
    expect(buildVerificationSnapshot(input({ reviewStatus: "Pending" })).overallReady).toBe(
      false
    );
  });

  it("preserves every input field unchanged on the output record", () => {
    const snapshot = buildVerificationSnapshot(input());
    expect(snapshot.estateId).toBe("estate-1");
    expect(snapshot.claimantId).toBe("claimant-1");
    expect(snapshot.createdAt).toBe("2026-08-26T00:00:00.000Z");
  });
});
