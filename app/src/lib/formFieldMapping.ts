// Form field mapping + auto-population engine -- doc 07 sections 14-17.
// PLAN.md P6-8.
//
// "Map each form field to an explicit case-data path -- do not rely
// entirely on an LLM to populate forms. When multiple candidate
// values exist for one field, prefer in this order: human-verified >
// source-supported > validated document data > other case data > AI
// inference, and only where explicitly permitted. Missing required
// data should be flagged, not guessed. Every populated field should
// carry its source and verification status, for the review UI."
//
// Pure logic only: mappings and candidate values are supplied by the
// caller (a real implementation reads mappings from a config table and
// candidates from Prisma-backed case data); this module just resolves
// which candidate wins for each field and what that means for the
// review UI, same shape as claimRules.ts's evaluate/select pattern.

export type CaseDataSourcePriority =
  | "HUMAN_VERIFIED"
  | "SOURCE_SUPPORTED"
  | "VALIDATED_DOCUMENT_DATA"
  | "OTHER_CASE_DATA"
  | "AI_INFERENCE";

// doc 07 section 15's own priority order, verbatim, expressed as a
// config table rather than an inline if/else chain -- higher wins.
export const SOURCE_PRIORITY_ORDER: Record<CaseDataSourcePriority, number> = {
  HUMAN_VERIFIED: 4,
  SOURCE_SUPPORTED: 3,
  VALIDATED_DOCUMENT_DATA: 2,
  OTHER_CASE_DATA: 1,
  AI_INFERENCE: 0,
};

export interface FormFieldMapping {
  formId: string;
  fieldKey: string;
  // The explicit case-data path this field reads from -- e.g.
  // "claimant.fullName". This is the "do not rely entirely on an LLM"
  // requirement: every field has a named, structural source.
  casePath: string;
  required: boolean;
  // doc 07 section 16: AI inference only fills a field where explicitly
  // permitted -- defaults to false so a mapping never silently accepts
  // an AI-inferred value.
  aiInferenceAllowed?: boolean;
}

export interface CaseDataCandidate {
  casePath: string;
  value: string;
  source: CaseDataSourcePriority;
}

export type FieldVerificationStatus = "VERIFIED" | "SUPPORTED" | "UNVERIFIED" | "MISSING";

export interface PopulatedField {
  formId: string;
  fieldKey: string;
  value: string | null;
  source: CaseDataSourcePriority | null;
  verificationStatus: FieldVerificationStatus;
  required: boolean;
}

function verificationStatusFor(source: CaseDataSourcePriority): FieldVerificationStatus {
  if (source === "HUMAN_VERIFIED") return "VERIFIED";
  if (source === "SOURCE_SUPPORTED") return "SUPPORTED";
  return "UNVERIFIED";
}

/**
 * Pure: doc 07 sections 14-17. For each form field mapping, resolves
 * the highest-priority usable candidate value from the case-data
 * candidates supplied for that field's exact casePath. An AI_INFERENCE
 * candidate is excluded entirely unless the mapping explicitly permits
 * it -- never a silent fallback. A required field with no usable
 * candidate is flagged MISSING rather than left unexplained.
 */
export function populateFormFields(
  mappings: readonly FormFieldMapping[],
  candidates: readonly CaseDataCandidate[]
): PopulatedField[] {
  return mappings.map((mapping) => {
    const usable = candidates.filter(
      (c) => c.casePath === mapping.casePath && (c.source !== "AI_INFERENCE" || mapping.aiInferenceAllowed === true)
    );

    if (usable.length === 0) {
      return {
        formId: mapping.formId,
        fieldKey: mapping.fieldKey,
        value: null,
        source: null,
        verificationStatus: "MISSING",
        required: mapping.required,
      };
    }

    const best = usable.reduce((a, b) => (SOURCE_PRIORITY_ORDER[b.source] > SOURCE_PRIORITY_ORDER[a.source] ? b : a));

    return {
      formId: mapping.formId,
      fieldKey: mapping.fieldKey,
      value: best.value,
      source: best.source,
      verificationStatus: verificationStatusFor(best.source),
      required: mapping.required,
    };
  });
}

/**
 * Pure: the required, still-MISSING subset -- every one of these is a
 * candidate for a human data-entry prompt, same "detect what's missing
 * rather than assume it exists" discipline as
 * detectMissingDocuments()/detectRuleConflicts().
 */
export function detectMissingRequiredFields(fields: readonly PopulatedField[]): PopulatedField[] {
  return fields.filter((f) => f.required && f.verificationStatus === "MISSING");
}
