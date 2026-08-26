// Document validation + cross-document/case-data conflict detection --
// doc 05 sections 15, 16, 17. PLAN.md P4-5.
//
// "Build a document validation engine. Validation should determine
// whether a document satisfies the requirements for its document
// type... Do not treat 'document exists' as equivalent to 'document is
// valid.'" / "Documents should also be validated against the case...
// Result: CONFLICT... Create: DATA_CONFLICT and route to review." /
// "Compare information across documents... CONFLICTING DOB. Create
// exception. Do not automatically choose one."
//
// Pure comparison logic only. Every function here takes already-
// extracted field values as plain input -- the extraction pipeline
// itself is blocked (P4-9: no AI/OCR provider account exists yet),
// same split as matchDocumentToCase.ts's extractedText signal: the
// comparison rules are what doc 05 actually asks this module to own,
// and they're exactly as testable today with synthetic field values as
// they will be with real extraction output later.

import type { DocumentType } from "./documentRequirements";

// doc 05 section 15's own worked example -- required fields per
// document type. Deliberately a config table, not a switch statement,
// same reasoning as DOCUMENT_REQUIREMENTS in documentRequirements.ts.
// Only the types the doc gives worked examples for (birth certificate
// here, section 9 gives death/marriage/identity too) are populated;
// types with no configured required-field set simply can't produce
// INVALID/INCOMPLETE, only UNCERTAIN -- see validateRequiredFields().
export const REQUIRED_FIELDS_BY_DOCUMENT_TYPE: Partial<Record<DocumentType, readonly string[]>> = {
  BIRTH_CERTIFICATE: ["name", "dateOfBirth", "parentNames", "issuingAuthority"],
  DEATH_CERTIFICATE: ["decedentName", "dateOfDeath", "placeOfDeath", "issuingAuthority"],
  MARRIAGE_CERTIFICATE: ["spouse1", "spouse2", "marriageDate", "issuingAuthority"],
  IDENTIFICATION: ["name", "dateOfBirth"],
  DRIVER_LICENSE: ["name", "dateOfBirth", "expirationDate"],
  PASSPORT: ["name", "dateOfBirth", "expirationDate"],
};

// doc 05 section 34: critical identity fields get stricter thresholds
// than incidental ones -- used below to decide when a low-confidence
// field should downgrade a VALID result to UNCERTAIN rather than
// passing it through.
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export interface ExtractedField {
  field: string;
  value: string;
  confidence: number; // 0.0-1.0
}

export type ValidationStatus = "VALID" | "INVALID" | "INCOMPLETE" | "UNCERTAIN";

export interface ValidationResult {
  status: ValidationStatus;
  missingFields: string[];
  lowConfidenceFields: string[];
  reason: string;
}

/**
 * Pure: doc 05 section 15. Does this document contain the fields its
 * type requires, extracted with enough confidence to trust? Fails to
 * UNCERTAIN (never a silent VALID) when the document type has no
 * configured required-field set at all -- an unconfigured type is a
 * gap in this table, not permission to skip validation, same
 * fail-closed discipline as checkFeeCompliance()/
 * routeClassifiedCommunication().
 */
export function validateRequiredFields(
  documentType: DocumentType,
  extractedFields: readonly ExtractedField[]
): ValidationResult {
  const required = REQUIRED_FIELDS_BY_DOCUMENT_TYPE[documentType];

  if (!required) {
    return {
      status: "UNCERTAIN",
      missingFields: [],
      lowConfidenceFields: [],
      reason: `No configured required-field set for document type "${documentType}" -- cannot determine validity.`,
    };
  }

  const byField = new Map(extractedFields.map((f) => [f.field, f]));
  const missingFields = required.filter((field) => !byField.has(field));

  if (missingFields.length > 0) {
    return {
      status: "INCOMPLETE",
      missingFields,
      lowConfidenceFields: [],
      reason: `Missing required field(s): ${missingFields.join(", ")}.`,
    };
  }

  const lowConfidenceFields = required.filter((field) => {
    const f = byField.get(field);
    return f !== undefined && f.confidence < LOW_CONFIDENCE_THRESHOLD;
  });

  if (lowConfidenceFields.length > 0) {
    return {
      status: "UNCERTAIN",
      missingFields: [],
      lowConfidenceFields,
      reason: `Low-confidence extraction for required field(s): ${lowConfidenceFields.join(
        ", "
      )}. Manual verification required.`,
    };
  }

  return {
    status: "VALID",
    missingFields: [],
    lowConfidenceFields: [],
    reason: "All required fields present with sufficient confidence.",
  };
}

export type FieldComparisonResult = "MATCH" | "CONFLICT" | "NO_CASE_DATA";

/**
 * Pure: doc 05 section 16's case-specific validation -- does this one
 * extracted field agree with the case's own existing data for that
 * field? Comparison is a simple normalized-string equality; doc 05
 * gives no fuzzy-matching rule here (dates/names are expected to be
 * normalized upstream during extraction, section 10's "NORMALIZED"
 * value), so this stays a strict, auditable equality check rather than
 * inventing a similarity heuristic.
 */
export function compareFieldToCaseData(
  documentValue: string | null,
  caseValue: string | null
): FieldComparisonResult {
  if (caseValue === null || caseValue === undefined || caseValue === "") {
    return "NO_CASE_DATA";
  }
  if (documentValue === null || documentValue === undefined || documentValue === "") {
    return "NO_CASE_DATA";
  }
  return documentValue.trim().toLowerCase() === caseValue.trim().toLowerCase()
    ? "MATCH"
    : "CONFLICT";
}

export interface CrossDocumentFieldValue {
  documentId: string;
  value: string;
}

export interface CrossDocumentComparisonResult {
  status: "CONSISTENT" | "CONFLICT";
  // Grouped by distinct normalized value -- doc 05 section 17: "Create
  // exception. Do not automatically choose one," so every conflicting
  // value + its source document must survive into the exception, not
  // just a boolean.
  distinctValues: { value: string; documentIds: string[] }[];
}

/**
 * Pure: doc 05 section 17's cross-document validation for a single
 * field (e.g. "date of birth") across every document that reports it.
 * More than one distinct normalized value among non-empty entries is a
 * conflict; this function does not attempt to guess which document is
 * right.
 */
export function compareFieldAcrossDocuments(
  values: readonly CrossDocumentFieldValue[]
): CrossDocumentComparisonResult {
  const groups = new Map<string, string[]>();

  for (const entry of values) {
    if (!entry.value) continue;
    const normalized = entry.value.trim().toLowerCase();
    const existing = groups.get(normalized) ?? [];
    existing.push(entry.documentId);
    groups.set(normalized, existing);
  }

  const distinctValues = Array.from(groups.entries()).map(([value, documentIds]) => ({
    value,
    documentIds,
  }));

  return {
    status: distinctValues.length > 1 ? "CONFLICT" : "CONSISTENT",
    distinctValues,
  };
}
