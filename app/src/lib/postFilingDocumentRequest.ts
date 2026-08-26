// Document request model + detection + validation -- doc 09 sections
// 26-30. PLAN.md P8-9.
//
// "Create DocumentRequest with the given status list. Detect requests
// from: official API, provider status, court/authority event, official
// correspondence, inbound email, uploaded documents, manual operator
// entry. When a claimant uploads a document: match to case, classify,
// OCR if necessary, extract information, validate, compare against
// request, determine whether it appears to satisfy the request; if
// ambiguous, route to review. Do not automatically mark a consequential
// request satisfied solely because a document was uploaded."
//
// Governs the schema's DocumentRequest/DocumentRequestStatus (P8-9).
// AI classification of incoming correspondence (§28) itself needs an
// AIProvider (blocked, no vendor account exists); the
// detection-source vocabulary and the satisfaction-evaluation logic
// below work over whatever category a caller already determined
// (human, config-mapped, or eventually AI), same split as
// filingRejection.ts's (P7-16) classification logic.

// doc 09 section 27's own detection-source list, verbatim.
export type DocumentRequestDetectionSource =
  | "OFFICIAL_API"
  | "PROVIDER_STATUS"
  | "COURT_AUTHORITY_EVENT"
  | "OFFICIAL_CORRESPONDENCE"
  | "INBOUND_EMAIL"
  | "UPLOADED_DOCUMENTS"
  | "MANUAL_OPERATOR_ENTRY";

export type DocumentRequestSatisfactionOutcome = "ACCEPTED" | "REJECTED" | "REQUIRES_REVIEW";

export interface DocumentRequestValidationInput {
  requestedDocumentType: string;
  uploadedDocumentType: string;
  validationStatus: "VALID" | "INVALID" | "INCOMPLETE" | "UNCERTAIN";
  // Whether the uploaded document was matched to this specific request
  // with high confidence, or ambiguously (e.g. could plausibly satisfy
  // more than one open request, or the match itself is uncertain).
  matchConfidence: "HIGH" | "AMBIGUOUS";
}

/**
 * Pure: doc 09 sections 29-30. ACCEPTED only when the document type
 * matches the request, validation is clean (VALID), and the match
 * itself was unambiguous -- anything short of all three is
 * REQUIRES_REVIEW (or REJECTED for a document the validation pipeline
 * already flagged INVALID outright), never a silent auto-accept
 * "because a document was uploaded."
 */
export function evaluateDocumentRequestSatisfaction(
  input: DocumentRequestValidationInput
): DocumentRequestSatisfactionOutcome {
  if (input.validationStatus === "INVALID") return "REJECTED";
  if (input.uploadedDocumentType !== input.requestedDocumentType) return "REQUIRES_REVIEW";
  if (input.matchConfidence === "AMBIGUOUS") return "REQUIRES_REVIEW";
  if (input.validationStatus !== "VALID") return "REQUIRES_REVIEW"; // INCOMPLETE / UNCERTAIN

  return "ACCEPTED";
}
