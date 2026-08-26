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
});
