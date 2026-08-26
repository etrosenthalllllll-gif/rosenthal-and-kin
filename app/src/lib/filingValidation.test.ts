import { describe, it, expect } from "vitest";
import {
  validateFilingFields,
  checkDocumentRequirements,
  validateFilingDocuments,
  hasAnyDocumentViolations,
  type FilingDocumentAttachment,
  type FilingConnectorDocumentRequirements,
} from "./filingValidation";
import type { PopulatedFilingDataField } from "./filingData";

describe("filing field validation (reuses formValidation.ts)", () => {
  it("flags a missing required field", () => {
    const fields: PopulatedFilingDataField[] = [
      { formId: "F1", fieldKey: "claimAmount", value: null, source: null, verificationStatus: "MISSING", required: true },
    ];
    const results = validateFilingFields(fields);
    expect(results[0].outcome).toBe("MISSING_REQUIRED");
  });
});

describe("filing document requirements", () => {
  const requirements: FilingConnectorDocumentRequirements = {
    maxFileSizeBytes: 1_000_000,
    allowedFileTypes: ["PDF"],
    maxPages: 20,
    namingPattern: /^exhibit-[a-z]+\.pdf$/,
  };

  function doc(overrides: Partial<FilingDocumentAttachment> = {}): FilingDocumentAttachment {
    return {
      documentId: "doc-1",
      fileName: "exhibit-a.pdf",
      fileSizeBytes: 500_000,
      fileType: "PDF",
      pageCount: 5,
      ...overrides,
    };
  }

  it("passes a document that satisfies every declared requirement", () => {
    const result = checkDocumentRequirements(doc(), requirements);
    expect(result.violations).toEqual([]);
  });

  it("flags a file that exceeds the max size", () => {
    const result = checkDocumentRequirements(doc({ fileSizeBytes: 2_000_000 }), requirements);
    expect(result.violations).toContain("FILE_TOO_LARGE");
  });

  it("flags a disallowed file type", () => {
    const result = checkDocumentRequirements(doc({ fileType: "DOCX" }), requirements);
    expect(result.violations).toContain("DISALLOWED_FILE_TYPE");
  });

  it("flags a document exceeding the page limit", () => {
    const result = checkDocumentRequirements(doc({ pageCount: 25 }), requirements);
    expect(result.violations).toContain("TOO_MANY_PAGES");
  });

  it("flags a document violating the naming pattern", () => {
    const result = checkDocumentRequirements(doc({ fileName: "random.pdf" }), requirements);
    expect(result.violations).toContain("INVALID_NAMING");
  });

  it("only checks requirements the connector actually declared", () => {
    const result = checkDocumentRequirements(doc({ fileSizeBytes: 50_000_000 }), {});
    expect(result.violations).toEqual([]);
  });

  it("hasAnyDocumentViolations reports true when any document has a violation", () => {
    const results = validateFilingDocuments([doc(), doc({ documentId: "doc-2", fileType: "DOCX" })], requirements);
    expect(hasAnyDocumentViolations(results)).toBe(true);
  });
});
