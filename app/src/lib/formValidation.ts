// Form validation + cross-form consistency -- doc 07 sections 18-19.
// PLAN.md P6-9.
//
// "Validate required fields, format, and dates before a form can
// proceed. Compare values that should match across multiple generated
// forms for the same case -- do not silently pick a winner when they
// disagree."
//
// Field-level validation composes with formFieldMapping.ts (P6-8)'s
// PopulatedField output. Cross-form consistency generalizes
// crossSourceComparison.ts's (P5-5) compareAcrossSources() again --
// same as claimRequirementChecklist.ts reused claimRules.ts, this
// module treats "the same fact appearing on two generated forms" as
// just another kind of source disagreement, not a new comparison
// engine.

import { compareAcrossSources, type CrossSourceComparisonResult, type SourceRecord } from "./crossSourceComparison";
import type { PopulatedField } from "./formFieldMapping";

export type FieldValidationOutcome = "VALID" | "MISSING_REQUIRED" | "INVALID_FORMAT" | "INVALID_DATE";

export interface FieldValidationRule {
  formId: string;
  fieldKey: string;
  format?: RegExp; // e.g. an SSN or phone-number pattern
  isDate?: boolean;
}

export interface FieldValidationResult {
  formId: string;
  fieldKey: string;
  outcome: FieldValidationOutcome;
}

function isParsableDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Pure: doc 07 section 18. A missing required field always fails
 * regardless of format rules (nothing to check format against);
 * format/date rules only apply once a value is actually present.
 */
export function validateFormField(
  field: PopulatedField,
  rule?: FieldValidationRule
): FieldValidationResult {
  if (field.value == null) {
    return {
      formId: field.formId,
      fieldKey: field.fieldKey,
      outcome: field.required ? "MISSING_REQUIRED" : "VALID",
    };
  }

  if (rule?.isDate && !isParsableDate(field.value)) {
    return { formId: field.formId, fieldKey: field.fieldKey, outcome: "INVALID_DATE" };
  }

  if (rule?.format && !rule.format.test(field.value)) {
    return { formId: field.formId, fieldKey: field.fieldKey, outcome: "INVALID_FORMAT" };
  }

  return { formId: field.formId, fieldKey: field.fieldKey, outcome: "VALID" };
}

export function validateFormFields(
  fields: readonly PopulatedField[],
  rules: readonly FieldValidationRule[] = []
): FieldValidationResult[] {
  const ruleByKey = new Map(rules.map((r) => [`${r.formId}::${r.fieldKey}`, r]));
  return fields.map((field) => validateFormField(field, ruleByKey.get(`${field.formId}::${field.fieldKey}`)));
}

export interface CrossFormValue {
  formId: string;
  fieldKey: string;
  // Ties two form fields together as "should represent the same
  // real-world fact" -- e.g. the claimant's date of birth appearing on
  // both Form A and Form B.
  casePath: string;
  value: string;
}

/**
 * Pure: doc 07 section 19. Groups cross-form values by casePath and
 * runs each group through crossSourceComparison.ts's own
 * compareAcrossSources() -- one form field is just another "source" of
 * a fact, so a disagreement between two generated forms gets exactly
 * the same never-pick-a-winner treatment as a disagreement between two
 * external sources.
 */
export function compareValuesAcrossForms(
  values: readonly CrossFormValue[]
): Map<string, CrossSourceComparisonResult> {
  const byCasePath = new Map<string, CrossFormValue[]>();
  for (const v of values) {
    const existing = byCasePath.get(v.casePath) ?? [];
    existing.push(v);
    byCasePath.set(v.casePath, existing);
  }

  const result = new Map<string, CrossSourceComparisonResult>();
  for (const [casePath, group] of byCasePath) {
    const records: SourceRecord[] = group.map((v) => ({
      sourceId: `${v.formId}::${v.fieldKey}`,
      value: v.value,
    }));
    result.set(casePath, compareAcrossSources(records));
  }

  return result;
}
