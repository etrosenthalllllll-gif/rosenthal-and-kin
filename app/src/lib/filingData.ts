// Filing data model + provenance -- doc 08 sections 14-15. PLAN.md P7-6.
//
// "Create structured FilingData ... claimant information, decedent
// information, contact information, mailing address, claim amount,
// property identifiers, holder information, case information,
// representative information, bank/payment information where
// legitimately required, filing-specific fields. The exact fields must
// be configurable by jurisdiction and claim type. Every important
// filing field must have provenance ... the filing system should never
// independently invent filing values."
//
// This is exactly the shape formFieldMapping.ts (P6-8) already built
// for form fields -- an explicit case-data-path mapping, a fixed
// source-priority order, and a MISSING/UNVERIFIED/VERIFIED status per
// field -- so filing data reuses that engine directly rather than
// re-implementing identical priority/provenance logic under a new
// name. The "filing data" concept is the same problem (populate a
// named field set from case data, never invent a value, never omit a
// source) applied to a filing instead of a generated form.

import {
  populateFormFields,
  detectMissingRequiredFields,
  type FormFieldMapping,
  type CaseDataCandidate,
  type PopulatedField,
} from "./formFieldMapping";

// doc 08 section 14's own suggested field categories, as documentation
// for what a jurisdiction/claim-type-specific FilingDataFieldMapping
// list will typically cover -- not itself a hardcoded requirement list;
// the actual configured fields live in each jurisdiction/claim type's
// own mapping array (a caller concern, mirroring how claimRules.ts/P6-4
// keeps requirements out of this module).
export const FILING_DATA_FIELD_CATEGORIES = [
  "claimant_information",
  "decedent_information",
  "contact_information",
  "mailing_address",
  "claim_amount",
  "property_identifiers",
  "holder_information",
  "case_information",
  "representative_information",
  "bank_payment_information",
  "filing_specific_fields",
] as const;

export type FilingDataFieldMapping = FormFieldMapping;
export type FilingDataCandidate = CaseDataCandidate;
export type PopulatedFilingDataField = PopulatedField;

/**
 * Pure: doc 08 sections 14-15. Delegates directly to
 * formFieldMapping.ts's populateFormFields() -- same priority order
 * (human-verified > source-supported > validated document data > other
 * case data > AI inference only where explicitly permitted), same
 * MISSING-rather-than-guessed behavior for an unfilled required field.
 */
export function populateFilingData(
  mappings: readonly FilingDataFieldMapping[],
  candidates: readonly FilingDataCandidate[]
): PopulatedFilingDataField[] {
  return populateFormFields(mappings, candidates);
}

export function detectMissingRequiredFilingData(
  fields: readonly PopulatedFilingDataField[]
): PopulatedFilingDataField[] {
  return detectMissingRequiredFields(fields);
}
