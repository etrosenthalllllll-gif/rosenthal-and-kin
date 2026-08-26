import { describe, it, expect } from "vitest";
import {
  generateDocumentFromTemplate,
  createDocumentDraftHistory,
  applyDocumentRevision,
  approveFinalDocument,
  type DocumentTemplate,
  type CaseFact,
} from "./claimDocumentGeneration";

const TEMPLATE: DocumentTemplate = {
  id: "declaration-v1",
  version: 1,
  documentType: "DECLARATION",
  bodyTemplate: "I, {{claimant.fullName}}, declare I am the heir of {{decedent.fullName}}.",
  requiredCasePaths: ["claimant.fullName", "decedent.fullName"],
  status: "EXAMPLE_PENDING_LEGAL_SOURCING",
};

describe("claim document generation", () => {
  it("generates the document when all required facts are present and verified", () => {
    const facts: CaseFact[] = [
      { casePath: "claimant.fullName", value: "Jane Doe", verified: true },
      { casePath: "decedent.fullName", value: "John Doe", verified: true },
    ];
    const result = generateDocumentFromTemplate(TEMPLATE, facts);
    expect(result.status).toBe("GENERATED");
    expect(result.bodyText).toContain("Jane Doe");
    expect(result.bodyText).toContain("John Doe");
  });

  it("blocks generation when a required fact is missing entirely", () => {
    const facts: CaseFact[] = [{ casePath: "claimant.fullName", value: "Jane Doe", verified: true }];
    const result = generateDocumentFromTemplate(TEMPLATE, facts);
    expect(result.status).toBe("MISSING_REQUIRED_DATA");
    expect(result.bodyText).toBeNull();
    expect(result.missingCasePaths).toContain("decedent.fullName");
  });

  it("blocks generation when a required fact is present but unverified, rather than asserting it as established", () => {
    const facts: CaseFact[] = [
      { casePath: "claimant.fullName", value: "Jane Doe", verified: true },
      { casePath: "decedent.fullName", value: "John Doe", verified: false },
    ];
    const result = generateDocumentFromTemplate(TEMPLATE, facts);
    expect(result.status).toBe("UNVERIFIED_DATA");
    expect(result.bodyText).toBeNull();
    expect(result.unverifiedCasePaths).toContain("decedent.fullName");
  });
});

describe("document draft/revision/approval history", () => {
  it("never overwrites the original draft on revision", () => {
    const history = createDocumentDraftHistory("original text");
    const revised = applyDocumentRevision(history, "revised text");
    expect(revised.originalDraft).toBe("original text");
    expect(revised.operatorRevision).toBe("revised text");
  });

  it("a document is not final until explicitly approved", () => {
    const history = createDocumentDraftHistory("original text");
    const revised = applyDocumentRevision(history, "revised text");
    expect(revised.approvedFinalVersion).toBeNull();

    const approved = approveFinalDocument(revised, "revised text");
    expect(approved.approvedFinalVersion).toBe("revised text");
    expect(approved.originalDraft).toBe("original text");
  });
});
