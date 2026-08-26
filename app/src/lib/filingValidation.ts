// Filing validation engine -- doc 08 sections 16-17. PLAN.md P7-7.
//
// "Before submission validate: required fields, data types, field
// formats, dates, addresses, IDs, claim amount, document references,
// signature status, jurisdiction, claim type, filing destination.
// Return PASS or FAIL with actionable errors. The filing connector
// should be able to declare requirements such as: required form,
// required document, required attachment, required signature,
// required metadata, required payment, maximum file size, allowed
// file type, page limits, naming requirements. The filing readiness
// engine should validate these before submission."
//
// Field-level validation reuses formValidation.ts's (P6-9)
// validateFormField()/validateFormFields() directly -- required/
// format/date checks are the identical problem regardless of whether
// the field belongs to a generated form or a filing. This module adds
// the piece formValidation.ts doesn't cover: connector-declared
// document-level requirements (file size/type/page limits/naming).

import { validateFormFields, type FieldValidationResult, type FieldValidationRule } from "./formValidation";
import type { PopulatedFilingDataField } from "./filingData";

export function validateFilingFields(
  fields: readonly PopulatedFilingDataField[],
  rules: readonly FieldValidationRule[] = []
): FieldValidationResult[] {
  return validateFormFields(fields, rules);
}

export interface FilingConnectorDocumentRequirements {
  maxFileSizeBytes?: number;
  allowedFileTypes?: readonly string[];
  maxPages?: number;
  // Applied against the document's fileName.
  namingPattern?: RegExp;
}

export interface FilingDocumentAttachment {
  documentId: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: string;
  pageCount?: number;
}

export type DocumentRequirementViolation =
  | "FILE_TOO_LARGE"
  | "DISALLOWED_FILE_TYPE"
  | "TOO_MANY_PAGES"
  | "INVALID_NAMING";

export interface DocumentRequirementCheckResult {
  documentId: string;
  violations: DocumentRequirementViolation[];
}

/**
 * Pure: doc 08 section 17. Checks one attachment against a connector's
 * declared document requirements -- a requirement the connector didn't
 * declare (e.g. no maxFileSizeBytes at all) is simply not checked,
 * never assumed to be unlimited or assumed to fail.
 */
export function checkDocumentRequirements(
  doc: FilingDocumentAttachment,
  requirements: FilingConnectorDocumentRequirements
): DocumentRequirementCheckResult {
  const violations: DocumentRequirementViolation[] = [];

  if (requirements.maxFileSizeBytes != null && doc.fileSizeBytes > requirements.maxFileSizeBytes) {
    violations.push("FILE_TOO_LARGE");
  }
  if (requirements.allowedFileTypes != null && !requirements.allowedFileTypes.includes(doc.fileType)) {
    violations.push("DISALLOWED_FILE_TYPE");
  }
  if (requirements.maxPages != null && doc.pageCount != null && doc.pageCount > requirements.maxPages) {
    violations.push("TOO_MANY_PAGES");
  }
  if (requirements.namingPattern != null && !requirements.namingPattern.test(doc.fileName)) {
    violations.push("INVALID_NAMING");
  }

  return { documentId: doc.documentId, violations };
}

export function validateFilingDocuments(
  docs: readonly FilingDocumentAttachment[],
  requirements: FilingConnectorDocumentRequirements
): DocumentRequirementCheckResult[] {
  return docs.map((doc) => checkDocumentRequirements(doc, requirements));
}

export function hasAnyDocumentViolations(results: readonly DocumentRequirementCheckResult[]): boolean {
  return results.some((r) => r.violations.length > 0);
}
