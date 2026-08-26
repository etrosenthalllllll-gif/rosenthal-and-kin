import { describe, it, expect } from "vitest";
import { evaluateDocumentRequestSatisfaction, type DocumentRequestValidationInput } from "./postFilingDocumentRequest";

function input(overrides: Partial<DocumentRequestValidationInput> = {}): DocumentRequestValidationInput {
  return {
    requestedDocumentType: "PROOF_OF_RELATIONSHIP",
    uploadedDocumentType: "PROOF_OF_RELATIONSHIP",
    validationStatus: "VALID",
    matchConfidence: "HIGH",
    ...overrides,
  };
}

describe("document request satisfaction evaluation", () => {
  it("accepts a document that matches type, validates clean, and matches with high confidence", () => {
    expect(evaluateDocumentRequestSatisfaction(input())).toBe("ACCEPTED");
  });

  it("rejects a document the validation pipeline already flagged INVALID", () => {
    expect(evaluateDocumentRequestSatisfaction(input({ validationStatus: "INVALID" }))).toBe("REJECTED");
  });

  it("requires review on a document-type mismatch, never auto-accepting", () => {
    expect(evaluateDocumentRequestSatisfaction(input({ uploadedDocumentType: "IDENTIFICATION" }))).toBe(
      "REQUIRES_REVIEW"
    );
  });

  it("requires review when the match itself is ambiguous", () => {
    expect(evaluateDocumentRequestSatisfaction(input({ matchConfidence: "AMBIGUOUS" }))).toBe("REQUIRES_REVIEW");
  });

  it("requires review rather than auto-accepting an incomplete or uncertain validation", () => {
    expect(evaluateDocumentRequestSatisfaction(input({ validationStatus: "INCOMPLETE" }))).toBe("REQUIRES_REVIEW");
    expect(evaluateDocumentRequestSatisfaction(input({ validationStatus: "UNCERTAIN" }))).toBe("REQUIRES_REVIEW");
  });

  it("never automatically marks a request satisfied solely because a document was uploaded", () => {
    // Uploaded, but wrong type AND uncertain validation -- must not accept.
    const result = evaluateDocumentRequestSatisfaction(
      input({ uploadedDocumentType: "OTHER", validationStatus: "UNCERTAIN" })
    );
    expect(result).not.toBe("ACCEPTED");
  });
});
