import { describe, it, expect } from "vitest";
import { calculateClaimReadiness } from "./claimReadiness";
import { buildDocumentChecklist } from "./documentRequirements";

describe("calculateClaimReadiness", () => {
  it("is READY_FOR_OPERATOR_APPROVAL when documents are complete and there are no conflicts", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      { id: "d1", documentType: "DRIVER_LICENSE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
      { id: "d2", documentType: "BIRTH_CERTIFICATE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
    ]);
    const result = calculateClaimReadiness({ checklist, unresolvedConflicts: [] });
    expect(result.status).toBe("READY_FOR_OPERATOR_APPROVAL");
    expect(result.reasons).toEqual([]);
  });

  it("is NOT_READY with a named reason when a required document is missing", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      { id: "d1", documentType: "DRIVER_LICENSE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
    ]);
    const result = calculateClaimReadiness({ checklist, unresolvedConflicts: [] });
    expect(result.status).toBe("NOT_READY");
    expect(result.missingDocumentNames).toEqual(["Proof of Relationship"]);
    expect(result.reasons).toContain("Proof of Relationship missing.");
  });

  it("is NOT_READY when documents are complete but a conflict is still open", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      { id: "d1", documentType: "DRIVER_LICENSE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
      { id: "d2", documentType: "BIRTH_CERTIFICATE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
    ]);
    const result = calculateClaimReadiness({
      checklist,
      unresolvedConflicts: [{ description: "Conflicting date of birth across documents." }],
    });
    expect(result.status).toBe("NOT_READY");
    expect(result.conflictCount).toBe(1);
    expect(result.reasons).toContain("Conflicting date of birth across documents.");
  });

  it("does not let requirements not yet validated count as complete", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      { id: "d1", documentType: "DRIVER_LICENSE", validationStatus: "NOT_VALIDATED", duplicateStatus: "UNIQUE" },
      { id: "d2", documentType: "BIRTH_CERTIFICATE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
    ]);
    const result = calculateClaimReadiness({ checklist, unresolvedConflicts: [] });
    expect(result.status).toBe("NOT_READY");
    expect(result.requiredDocumentsComplete).toBe(false);
  });

  // --- doc 06 section 39's extension (P5-12) --------------------------

  function readyChecklist() {
    return buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      { id: "d1", documentType: "DRIVER_LICENSE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
      { id: "d2", documentType: "BIRTH_CERTIFICATE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
    ]);
  }

  it("is NOT_READY when identity is not yet verified, even with documents complete", () => {
    const result = calculateClaimReadiness({
      checklist: readyChecklist(),
      unresolvedConflicts: [],
      identityVerified: false,
    });
    expect(result.status).toBe("NOT_READY");
    expect(result.reasons).toContain("Identity is not yet verified.");
  });

  it("is NOT_READY when relationship is not yet verified", () => {
    const result = calculateClaimReadiness({
      checklist: readyChecklist(),
      unresolvedConflicts: [],
      relationshipVerified: false,
    });
    expect(result.status).toBe("NOT_READY");
    expect(result.reasons).toContain("Relationship is not yet verified.");
  });

  it("is NOT_READY when a potential competing heir is outstanding, singular reason text", () => {
    const result = calculateClaimReadiness({
      checklist: readyChecklist(),
      unresolvedConflicts: [],
      competingHeirsCount: 1,
    });
    expect(result.status).toBe("NOT_READY");
    expect(result.reasons).toContain("1 potential competing heir requires resolution.");
  });

  it("pluralizes the competing-heir reason correctly for more than one", () => {
    const result = calculateClaimReadiness({
      checklist: readyChecklist(),
      unresolvedConflicts: [],
      competingHeirsCount: 2,
    });
    expect(result.reasons).toContain("2 potential competing heirs require resolution.");
  });

  it("is NOT_READY when verification review is required, even if everything else looks clean", () => {
    const result = calculateClaimReadiness({
      checklist: readyChecklist(),
      unresolvedConflicts: [],
      verificationReviewRequired: true,
    });
    expect(result.status).toBe("NOT_READY");
    expect(result.reasons).toContain("Verification requires human review.");
  });

  it("is READY when documents, conflicts, identity, relationship, competing heirs, and review are all clean", () => {
    const result = calculateClaimReadiness({
      checklist: readyChecklist(),
      unresolvedConflicts: [],
      identityVerified: true,
      relationshipVerified: true,
      competingHeirsCount: 0,
      verificationReviewRequired: false,
    });
    expect(result.status).toBe("READY_FOR_OPERATOR_APPROVAL");
    expect(result.reasons).toEqual([]);
  });

  it("does not block readiness on verification fields the caller never evaluated (P4-6 backward compatibility)", () => {
    const result = calculateClaimReadiness({ checklist: readyChecklist(), unresolvedConflicts: [] });
    expect(result.status).toBe("READY_FOR_OPERATOR_APPROVAL");
    expect(result.identityVerified).toBeNull();
    expect(result.relationshipVerified).toBeNull();
  });
});
