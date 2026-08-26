import { describe, it, expect } from "vitest";
import { checkExhibitEligibility, buildExhibitAssembly, type ExhibitCandidateDocument } from "./exhibitAssembly";

function doc(overrides: Partial<ExhibitCandidateDocument> = {}): ExhibitCandidateDocument {
  return {
    id: "doc-1",
    caseId: "case-1",
    documentType: "DEATH_CERTIFICATE",
    validationStatus: "VALID",
    duplicateStatus: "UNIQUE",
    pageCount: 2,
    ...overrides,
  };
}

describe("exhibit eligibility", () => {
  it("a validated, unique, non-superseded document for the right case is eligible", () => {
    expect(checkExhibitEligibility(doc(), "case-1").eligible).toBe(true);
  });

  it("a document from a different case is ineligible", () => {
    const result = checkExhibitEligibility(doc({ caseId: "case-2" }), "case-1");
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("WRONG_CASE");
  });

  it("a confirmed duplicate is ineligible", () => {
    const result = checkExhibitEligibility(doc({ duplicateStatus: "CONFIRMED_DUPLICATE" }), "case-1");
    expect(result.reason).toBe("CONFIRMED_DUPLICATE");
  });

  it("a superseded document is ineligible", () => {
    const result = checkExhibitEligibility(doc({ isSuperseded: true }), "case-1");
    expect(result.reason).toBe("SUPERSEDED");
  });

  it("an unvalidated document is ineligible", () => {
    const result = checkExhibitEligibility(doc({ validationStatus: "NOT_VALIDATED" }), "case-1");
    expect(result.reason).toBe("NOT_VALIDATED");
  });
});

describe("exhibit assembly", () => {
  const documents: ExhibitCandidateDocument[] = [
    doc({ id: "doc-b", documentType: "BIRTH_CERTIFICATE", pageCount: 1 }),
    doc({ id: "doc-a", documentType: "DEATH_CERTIFICATE", pageCount: 3 }),
    doc({ id: "doc-dup", duplicateStatus: "CONFIRMED_DUPLICATE" }),
  ];

  it("excludes ineligible documents and records why", () => {
    const result = buildExhibitAssembly({ documents, caseId: "case-1", scheme: "NUMERICAL" });
    expect(result.entries.map((e) => e.documentId)).not.toContain("doc-dup");
    expect(result.excluded).toEqual([{ documentId: "doc-dup", reason: "CONFIRMED_DUPLICATE" }]);
  });

  it("assigns alphabetical labels deterministically by documentType then id", () => {
    const result = buildExhibitAssembly({ documents, caseId: "case-1", scheme: "ALPHABETICAL" });
    expect(result.entries[0].documentId).toBe("doc-b"); // BIRTH_CERTIFICATE sorts before DEATH_CERTIFICATE
    expect(result.entries[0].label).toBe("Exhibit A");
    expect(result.entries[1].label).toBe("Exhibit B");
  });

  it("tracks a running page map across exhibits", () => {
    const result = buildExhibitAssembly({ documents, caseId: "case-1", scheme: "ALPHABETICAL" });
    expect(result.entries[0].startPage).toBe(1);
    expect(result.entries[0].endPage).toBe(1);
    expect(result.entries[1].startPage).toBe(2);
    expect(result.entries[1].endPage).toBe(4);
    expect(result.totalPages).toBe(4);
  });

  it("honors a custom order", () => {
    const result = buildExhibitAssembly({
      documents,
      caseId: "case-1",
      scheme: "CUSTOM",
      customOrder: ["doc-a", "doc-b"],
    });
    expect(result.entries.map((e) => e.documentId)).toEqual(["doc-a", "doc-b"]);
    expect(result.entries[0].label).toBe("Exhibit 1");
  });

  it("fails closed with MISSING_CUSTOM_ORDER rather than silently falling back to another scheme", () => {
    const result = buildExhibitAssembly({ documents, caseId: "case-1", scheme: "CUSTOM" });
    expect(result.status).toBe("MISSING_CUSTOM_ORDER");
    expect(result.entries).toEqual([]);
  });

  it("produces identical output on regeneration -- never collides or renumbers", () => {
    const first = buildExhibitAssembly({ documents, caseId: "case-1", scheme: "ALPHABETICAL" });
    const second = buildExhibitAssembly({ documents, caseId: "case-1", scheme: "ALPHABETICAL" });
    expect(second).toEqual(first);
  });
});
