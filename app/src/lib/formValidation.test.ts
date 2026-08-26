import { describe, it, expect } from "vitest";
import {
  validateFormField,
  validateFormFields,
  compareValuesAcrossForms,
  type FieldValidationRule,
  type CrossFormValue,
} from "./formValidation";
import type { PopulatedField } from "./formFieldMapping";

function field(overrides: Partial<PopulatedField> = {}): PopulatedField {
  return {
    formId: "F1",
    fieldKey: "dob",
    value: "1950-01-01",
    source: "VALIDATED_DOCUMENT_DATA",
    verificationStatus: "UNVERIFIED",
    required: true,
    ...overrides,
  };
}

describe("form field validation", () => {
  it("a missing required field fails MISSING_REQUIRED", () => {
    const result = validateFormField(field({ value: null }));
    expect(result.outcome).toBe("MISSING_REQUIRED");
  });

  it("a missing optional field is VALID (nothing owed)", () => {
    const result = validateFormField(field({ value: null, required: false }));
    expect(result.outcome).toBe("VALID");
  });

  it("a valid date passes the isDate rule", () => {
    const result = validateFormField(field(), { formId: "F1", fieldKey: "dob", isDate: true });
    expect(result.outcome).toBe("VALID");
  });

  it("an unparsable date fails INVALID_DATE", () => {
    const result = validateFormField(field({ value: "not-a-date" }), { formId: "F1", fieldKey: "dob", isDate: true });
    expect(result.outcome).toBe("INVALID_DATE");
  });

  it("a value failing the format rule fails INVALID_FORMAT", () => {
    const rule: FieldValidationRule = { formId: "F1", fieldKey: "ssn", format: /^\d{3}-\d{2}-\d{4}$/ };
    const result = validateFormField(field({ fieldKey: "ssn", value: "12345" }), rule);
    expect(result.outcome).toBe("INVALID_FORMAT");
  });

  it("validateFormFields applies the matching rule per formId+fieldKey", () => {
    const fields = [field({ value: "not-a-date" })];
    const rules: FieldValidationRule[] = [{ formId: "F1", fieldKey: "dob", isDate: true }];
    const results = validateFormFields(fields, rules);
    expect(results[0].outcome).toBe("INVALID_DATE");
  });
});

describe("cross-form value comparison", () => {
  it("reports CONSISTENT when two forms agree on the same fact", () => {
    const values: CrossFormValue[] = [
      { formId: "F1", fieldKey: "dob", casePath: "claimant.dob", value: "1950-01-01" },
      { formId: "F2", fieldKey: "birthDate", casePath: "claimant.dob", value: "1950-01-01" },
    ];
    const result = compareValuesAcrossForms(values);
    expect(result.get("claimant.dob")?.status).toBe("CONSISTENT");
  });

  it("reports CONFLICT rather than picking a winner when two forms disagree", () => {
    const values: CrossFormValue[] = [
      { formId: "F1", fieldKey: "dob", casePath: "claimant.dob", value: "1950-01-01" },
      { formId: "F2", fieldKey: "birthDate", casePath: "claimant.dob", value: "1951-06-15" },
    ];
    const result = compareValuesAcrossForms(values);
    const comparison = result.get("claimant.dob");
    expect(comparison?.status).toBe("CONFLICT");
    expect(comparison?.distinctValues).toHaveLength(2);
  });

  it("keeps unrelated case paths in separate comparison groups", () => {
    const values: CrossFormValue[] = [
      { formId: "F1", fieldKey: "dob", casePath: "claimant.dob", value: "1950-01-01" },
      { formId: "F1", fieldKey: "name", casePath: "claimant.fullName", value: "Jane Doe" },
    ];
    const result = compareValuesAcrossForms(values);
    expect(result.size).toBe(2);
  });
});
