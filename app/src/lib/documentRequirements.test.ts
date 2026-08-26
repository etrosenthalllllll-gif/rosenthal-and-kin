import { describe, it, expect } from "vitest";
import {
  buildDocumentChecklist,
  detectMissingDocuments,
  isChecklistComplete,
  type RequirementCandidateDocument,
} from "./documentRequirements";

function doc(overrides: Partial<RequirementCandidateDocument> = {}): RequirementCandidateDocument {
  return {
    id: "doc-1",
    documentType: "BIRTH_CERTIFICATE",
    validationStatus: "VALID",
    duplicateStatus: "UNIQUE",
    ...overrides,
  };
}

describe("buildDocumentChecklist", () => {
  it("marks a requirement MISSING when no matching document exists", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", []);
    expect(checklist.every((item) => item.status === "MISSING")).toBe(true);
  });

  it("marks a requirement SATISFIED when a valid matching document exists", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      doc({ id: "id-1", documentType: "DRIVER_LICENSE" }),
      doc({ id: "id-2", documentType: "BIRTH_CERTIFICATE" }),
    ]);
    const identity = checklist.find((c) => c.requirement.key === "IDENTITY")!;
    const relationship = checklist.find((c) => c.requirement.key === "PROOF_OF_RELATIONSHIP")!;
    expect(identity.status).toBe("SATISFIED");
    expect(identity.matchingDocumentIds).toEqual(["id-1"]);
    expect(relationship.status).toBe("SATISFIED");
  });

  it("marks RECEIVED_UNVALIDATED when a matching document exists but isn't validated yet", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      doc({ id: "id-1", documentType: "DRIVER_LICENSE", validationStatus: "NOT_VALIDATED" }),
    ]);
    const identity = checklist.find((c) => c.requirement.key === "IDENTITY")!;
    expect(identity.status).toBe("RECEIVED_UNVALIDATED");
  });

  it("does not let a confirmed duplicate satisfy a requirement", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      doc({ id: "id-1", documentType: "DRIVER_LICENSE", duplicateStatus: "CONFIRMED_DUPLICATE" }),
    ]);
    const identity = checklist.find((c) => c.requirement.key === "IDENTITY")!;
    expect(identity.status).toBe("MISSING");
  });

  it("satisfies a requirement with any one of several accepted document types", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      doc({ id: "id-1", documentType: "PASSPORT" }),
      doc({ id: "id-2", documentType: "MARRIAGE_CERTIFICATE" }),
    ]);
    expect(checklist.every((item) => item.status === "SATISFIED")).toBe(true);
  });

  it("scopes requirements to the given workflow stage", () => {
    const checklist = buildDocumentChecklist("CLAIM_PREPARATION", []);
    expect(checklist.map((c) => c.requirement.key).sort()).toEqual(
      ["AUTHORIZATION", "IDENTITY", "RELATIONSHIP_EVIDENCE"].sort()
    );
  });
});

describe("detectMissingDocuments", () => {
  it("returns only the required, unsatisfied checklist items", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      doc({ id: "id-1", documentType: "DRIVER_LICENSE" }),
    ]);
    const missing = detectMissingDocuments(checklist);
    expect(missing).toHaveLength(1);
    expect(missing[0].requirement.key).toBe("PROOF_OF_RELATIONSHIP");
  });

  it("returns an empty array once every required item is satisfied", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      doc({ id: "id-1", documentType: "DRIVER_LICENSE" }),
      doc({ id: "id-2", documentType: "BIRTH_CERTIFICATE" }),
    ]);
    expect(detectMissingDocuments(checklist)).toEqual([]);
  });
});

describe("isChecklistComplete", () => {
  it("is false while any required item is missing or unvalidated", () => {
    const missing = buildDocumentChecklist("CLAIMANT_VERIFICATION", []);
    expect(isChecklistComplete(missing)).toBe(false);

    const unvalidated = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      doc({ id: "id-1", documentType: "DRIVER_LICENSE", validationStatus: "NOT_VALIDATED" }),
      doc({ id: "id-2", documentType: "BIRTH_CERTIFICATE", validationStatus: "NOT_VALIDATED" }),
    ]);
    expect(isChecklistComplete(unvalidated)).toBe(false);
  });

  it("is true once every required item is SATISFIED", () => {
    const complete = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      doc({ id: "id-1", documentType: "DRIVER_LICENSE" }),
      doc({ id: "id-2", documentType: "BIRTH_CERTIFICATE" }),
    ]);
    expect(isChecklistComplete(complete)).toBe(true);
  });
});
