import { describe, it, expect } from "vitest";
import {
  validateRequiredFields,
  compareFieldToCaseData,
  compareFieldAcrossDocuments,
  type ExtractedField,
} from "./documentValidation";

function field(overrides: Partial<ExtractedField>): ExtractedField {
  return { field: "name", value: "Jane Smith", confidence: 0.95, ...overrides };
}

describe("validateRequiredFields", () => {
  it("returns VALID when every required field is present with high confidence", () => {
    const result = validateRequiredFields("BIRTH_CERTIFICATE", [
      field({ field: "name" }),
      field({ field: "dateOfBirth", value: "1981-01-02" }),
      field({ field: "parentNames", value: "Mary Smith, John Smith" }),
      field({ field: "issuingAuthority", value: "State of Ohio" }),
    ]);
    expect(result.status).toBe("VALID");
  });

  it("returns INCOMPLETE when a required field is missing entirely", () => {
    const result = validateRequiredFields("BIRTH_CERTIFICATE", [field({ field: "name" })]);
    expect(result.status).toBe("INCOMPLETE");
    expect(result.missingFields).toContain("dateOfBirth");
  });

  it("returns UNCERTAIN when a required field is present but low-confidence, never silently VALID", () => {
    const result = validateRequiredFields("BIRTH_CERTIFICATE", [
      field({ field: "name" }),
      field({ field: "dateOfBirth", value: "1981-01-02", confidence: 0.58 }),
      field({ field: "parentNames", value: "Mary Smith, John Smith" }),
      field({ field: "issuingAuthority", value: "State of Ohio" }),
    ]);
    expect(result.status).toBe("UNCERTAIN");
    expect(result.lowConfidenceFields).toEqual(["dateOfBirth"]);
  });

  it("fails closed to UNCERTAIN for a document type with no configured required-field set", () => {
    const result = validateRequiredFields("CORRESPONDENCE", []);
    expect(result.status).toBe("UNCERTAIN");
  });

  it("prioritizes INCOMPLETE over UNCERTAIN when a field is both missing and others are low-confidence", () => {
    const result = validateRequiredFields("BIRTH_CERTIFICATE", [
      field({ field: "name", confidence: 0.4 }),
    ]);
    expect(result.status).toBe("INCOMPLETE");
  });
});

describe("compareFieldToCaseData", () => {
  it("returns MATCH for equal normalized values", () => {
    expect(compareFieldToCaseData("1981-01-02", "1981-01-02")).toBe("MATCH");
    expect(compareFieldToCaseData("Jane Smith", "  jane smith ")).toBe("MATCH");
  });

  it("returns CONFLICT for differing values", () => {
    expect(compareFieldToCaseData("1981-01-02", "1982-01-02")).toBe("CONFLICT");
  });

  it("returns NO_CASE_DATA when the case has nothing to compare against", () => {
    expect(compareFieldToCaseData("1981-01-02", null)).toBe("NO_CASE_DATA");
    expect(compareFieldToCaseData("1981-01-02", "")).toBe("NO_CASE_DATA");
  });

  it("returns NO_CASE_DATA (not CONFLICT) when the document value itself is missing", () => {
    expect(compareFieldToCaseData(null, "1981-01-02")).toBe("NO_CASE_DATA");
  });
});

describe("compareFieldAcrossDocuments", () => {
  it("returns CONSISTENT when every document reports the same normalized value", () => {
    const result = compareFieldAcrossDocuments([
      { documentId: "doc-1", value: "1981-01-02" },
      { documentId: "doc-2", value: "1981-01-02" },
    ]);
    expect(result.status).toBe("CONSISTENT");
    expect(result.distinctValues).toHaveLength(1);
  });

  it("returns CONFLICT and preserves every distinct value with its source documents -- never picks one", () => {
    const result = compareFieldAcrossDocuments([
      { documentId: "doc-1", value: "1981-01-02" },
      { documentId: "doc-2", value: "1982-01-02" },
    ]);
    expect(result.status).toBe("CONFLICT");
    expect(result.distinctValues.sort((a, b) => a.value.localeCompare(b.value))).toEqual([
      { value: "1981-01-02", documentIds: ["doc-1"] },
      { value: "1982-01-02", documentIds: ["doc-2"] },
    ]);
  });

  it("ignores empty values rather than treating them as a conflicting third value", () => {
    const result = compareFieldAcrossDocuments([
      { documentId: "doc-1", value: "1981-01-02" },
      { documentId: "doc-2", value: "" },
    ]);
    expect(result.status).toBe("CONSISTENT");
  });
});
