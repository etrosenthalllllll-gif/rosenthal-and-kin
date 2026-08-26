import { describe, it, expect } from "vitest";
import { populateFormFields, detectMissingRequiredFields, type FormFieldMapping, type CaseDataCandidate } from "./formFieldMapping";

describe("form field mapping + auto-population", () => {
  it("populates a field from its single candidate", () => {
    const mappings: FormFieldMapping[] = [{ formId: "F1", fieldKey: "name", casePath: "claimant.fullName", required: true }];
    const candidates: CaseDataCandidate[] = [{ casePath: "claimant.fullName", value: "Jane Doe", source: "VALIDATED_DOCUMENT_DATA" }];
    const result = populateFormFields(mappings, candidates);
    expect(result[0].value).toBe("Jane Doe");
    expect(result[0].verificationStatus).toBe("UNVERIFIED");
  });

  it("prefers human-verified over source-supported over validated document data", () => {
    const mappings: FormFieldMapping[] = [{ formId: "F1", fieldKey: "name", casePath: "claimant.fullName", required: true }];
    const candidates: CaseDataCandidate[] = [
      { casePath: "claimant.fullName", value: "From Document", source: "VALIDATED_DOCUMENT_DATA" },
      { casePath: "claimant.fullName", value: "From Human Review", source: "HUMAN_VERIFIED" },
      { casePath: "claimant.fullName", value: "From Source", source: "SOURCE_SUPPORTED" },
    ];
    const result = populateFormFields(mappings, candidates);
    expect(result[0].value).toBe("From Human Review");
    expect(result[0].verificationStatus).toBe("VERIFIED");
  });

  it("excludes an AI_INFERENCE candidate unless the mapping explicitly permits it", () => {
    const mappings: FormFieldMapping[] = [{ formId: "F1", fieldKey: "notes", casePath: "case.notes", required: false }];
    const candidates: CaseDataCandidate[] = [{ casePath: "case.notes", value: "AI guess", source: "AI_INFERENCE" }];
    const result = populateFormFields(mappings, candidates);
    expect(result[0].value).toBeNull();
    expect(result[0].verificationStatus).toBe("MISSING");
  });

  it("accepts an AI_INFERENCE candidate when the mapping explicitly permits it", () => {
    const mappings: FormFieldMapping[] = [
      { formId: "F1", fieldKey: "notes", casePath: "case.notes", required: false, aiInferenceAllowed: true },
    ];
    const candidates: CaseDataCandidate[] = [{ casePath: "case.notes", value: "AI guess", source: "AI_INFERENCE" }];
    const result = populateFormFields(mappings, candidates);
    expect(result[0].value).toBe("AI guess");
    expect(result[0].verificationStatus).toBe("UNVERIFIED");
  });

  it("flags a required field with no usable candidate as MISSING rather than guessing", () => {
    const mappings: FormFieldMapping[] = [{ formId: "F1", fieldKey: "name", casePath: "claimant.fullName", required: true }];
    const result = populateFormFields(mappings, []);
    expect(result[0].verificationStatus).toBe("MISSING");
    expect(result[0].value).toBeNull();
  });

  it("detectMissingRequiredFields returns only required + MISSING fields", () => {
    const mappings: FormFieldMapping[] = [
      { formId: "F1", fieldKey: "name", casePath: "claimant.fullName", required: true },
      { formId: "F1", fieldKey: "middleName", casePath: "claimant.middleName", required: false },
    ];
    const result = populateFormFields(mappings, []);
    const missing = detectMissingRequiredFields(result);
    expect(missing).toHaveLength(1);
    expect(missing[0].fieldKey).toBe("name");
  });
});
