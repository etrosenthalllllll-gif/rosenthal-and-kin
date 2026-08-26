import { describe, it, expect } from "vitest";
import {
  planDocumentMatchDecision,
  planDuplicateDocumentDecision,
  planCaseDataConflictDecision,
  planCrossDocumentConflictDecision,
  planMissingDocumentDecisions,
} from "./documentDecisionRouting";
import { calculateClaimReadiness } from "./claimReadiness";
import { buildDocumentChecklist } from "./documentRequirements";

describe("planDocumentMatchDecision", () => {
  it("returns null when the document auto-attached cleanly", () => {
    const result = planDocumentMatchDecision("doc-1", {
      outcome: "AUTO_ATTACH",
      match: { claimantId: "c1", caseNumber: "RK-1", confidence: 0.95, reasons: [] },
    });
    expect(result).toBeNull();
  });

  it("recommends RESOLVE_AMBIGUOUS_DOCUMENT_MATCH when ambiguous", () => {
    const result = planDocumentMatchDecision("doc-1", {
      outcome: "AMBIGUOUS",
      candidates: [
        { claimantId: "c1", caseNumber: "RK-1842", confidence: 0.5, reasons: [] },
        { claimantId: "c2", caseNumber: "RK-1917", confidence: 0.45, reasons: [] },
      ],
    });
    expect(result?.decisionTypeKey).toBe("RESOLVE_AMBIGUOUS_DOCUMENT_MATCH");
    expect(result?.evidenceRefs).toEqual(["doc-1"]);
    expect(result?.reason).toMatch(/RK-1842/);
  });

  it("recommends RESOLVE_AMBIGUOUS_DOCUMENT_MATCH (not silent drop) on NO_MATCH", () => {
    const result = planDocumentMatchDecision("doc-1", { outcome: "NO_MATCH" });
    expect(result?.decisionTypeKey).toBe("RESOLVE_AMBIGUOUS_DOCUMENT_MATCH");
  });
});

describe("planDuplicateDocumentDecision", () => {
  it("returns null for a unique document", () => {
    expect(planDuplicateDocumentDecision("doc-new", { outcome: "UNIQUE" })).toBeNull();
  });

  it("recommends RESOLVE_SUSPECTED_DUPLICATE_DOCUMENT with both documents as evidence", () => {
    const result = planDuplicateDocumentDecision("doc-new", {
      outcome: "CONFIRMED_DUPLICATE",
      matchingDocumentId: "doc-old",
    });
    expect(result?.decisionTypeKey).toBe("RESOLVE_SUSPECTED_DUPLICATE_DOCUMENT");
    expect(result?.evidenceRefs).toEqual(["doc-new", "doc-old"]);
  });
});

describe("planCaseDataConflictDecision", () => {
  it("returns null when the field matches or there's no case data", () => {
    expect(planCaseDataConflictDecision("doc-1", "dateOfBirth", "MATCH")).toBeNull();
    expect(planCaseDataConflictDecision("doc-1", "dateOfBirth", "NO_CASE_DATA")).toBeNull();
  });

  it("recommends RESOLVE_DOCUMENT_CONFLICT on a case-data conflict", () => {
    const result = planCaseDataConflictDecision("doc-1", "dateOfBirth", "CONFLICT");
    expect(result?.decisionTypeKey).toBe("RESOLVE_DOCUMENT_CONFLICT");
    expect(result?.evidenceRefs).toEqual(["doc-1"]);
    expect(result?.reason).toMatch(/dateOfBirth/);
  });
});

describe("planCrossDocumentConflictDecision", () => {
  it("returns null when documents are consistent", () => {
    const result = planCrossDocumentConflictDecision("dateOfBirth", {
      status: "CONSISTENT",
      distinctValues: [{ value: "1981-01-02", documentIds: ["doc-1", "doc-2"] }],
    });
    expect(result).toBeNull();
  });

  it("recommends RESOLVE_DOCUMENT_CONFLICT with every conflicting document as evidence", () => {
    const result = planCrossDocumentConflictDecision("dateOfBirth", {
      status: "CONFLICT",
      distinctValues: [
        { value: "1981-01-02", documentIds: ["doc-1"] },
        { value: "1982-01-02", documentIds: ["doc-2"] },
      ],
    });
    expect(result?.decisionTypeKey).toBe("RESOLVE_DOCUMENT_CONFLICT");
    expect(result?.evidenceRefs.sort()).toEqual(["doc-1", "doc-2"]);
  });
});

describe("planMissingDocumentDecisions", () => {
  it("returns one REQUEST_DOCUMENTS recommendation per missing requirement", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", []);
    const readiness = calculateClaimReadiness({ checklist, unresolvedConflicts: [] });
    const recs = planMissingDocumentDecisions(readiness);
    expect(recs).toHaveLength(2);
    expect(recs.every((r) => r.decisionTypeKey === "REQUEST_DOCUMENTS")).toBe(true);
  });

  it("returns no recommendations when nothing is missing", () => {
    const checklist = buildDocumentChecklist("CLAIMANT_VERIFICATION", [
      { id: "d1", documentType: "DRIVER_LICENSE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
      { id: "d2", documentType: "BIRTH_CERTIFICATE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
    ]);
    const readiness = calculateClaimReadiness({ checklist, unresolvedConflicts: [] });
    expect(planMissingDocumentDecisions(readiness)).toEqual([]);
  });
});
