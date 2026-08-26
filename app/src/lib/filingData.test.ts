import { describe, it, expect } from "vitest";
import {
  populateFilingData,
  detectMissingRequiredFilingData,
  FILING_DATA_FIELD_CATEGORIES,
  type FilingDataFieldMapping,
  type FilingDataCandidate,
} from "./filingData";

describe("filing data + provenance", () => {
  it("documents doc 08 section 14's field categories", () => {
    expect(FILING_DATA_FIELD_CATEGORIES).toContain("claim_amount");
    expect(FILING_DATA_FIELD_CATEGORIES).toContain("decedent_information");
  });

  it("populates filing-specific fields from case data with provenance", () => {
    const mappings: FilingDataFieldMapping[] = [
      { formId: "FILING-1", fieldKey: "claimAmount", casePath: "case.estimatedRecoveryCents", required: true },
      { formId: "FILING-1", fieldKey: "decedentName", casePath: "estate.decedentName", required: true },
    ];
    const candidates: FilingDataCandidate[] = [
      { casePath: "case.estimatedRecoveryCents", value: "1248221", source: "VALIDATED_DOCUMENT_DATA" },
      { casePath: "estate.decedentName", value: "John Doe", source: "HUMAN_VERIFIED" },
    ];
    const result = populateFilingData(mappings, candidates);
    expect(result.find((f) => f.fieldKey === "claimAmount")?.value).toBe("1248221");
    expect(result.find((f) => f.fieldKey === "decedentName")?.source).toBe("HUMAN_VERIFIED");
  });

  it("never invents a filing value -- a required field with no candidate is MISSING", () => {
    const mappings: FilingDataFieldMapping[] = [
      { formId: "FILING-1", fieldKey: "claimAmount", casePath: "case.estimatedRecoveryCents", required: true },
    ];
    const result = populateFilingData(mappings, []);
    expect(result[0].value).toBeNull();
    expect(result[0].verificationStatus).toBe("MISSING");
  });

  it("detectMissingRequiredFilingData surfaces only the unfilled required fields", () => {
    const mappings: FilingDataFieldMapping[] = [
      { formId: "FILING-1", fieldKey: "claimAmount", casePath: "case.estimatedRecoveryCents", required: true },
      { formId: "FILING-1", fieldKey: "notes", casePath: "case.notes", required: false },
    ];
    const result = populateFilingData(mappings, []);
    const missing = detectMissingRequiredFilingData(result);
    expect(missing).toHaveLength(1);
    expect(missing[0].fieldKey).toBe("claimAmount");
  });
});
