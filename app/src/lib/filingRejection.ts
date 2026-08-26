// Rejection handling + classification + severity -- doc 08 sections
// 39-42. PLAN.md P7-16.
//
// "Build a dedicated rejection workflow. Classify: MISSING_DOCUMENT,
// INVALID_FORM, INVALID_DATA, SIGNATURE_PROBLEM, PAYMENT_PROBLEM,
// JURISDICTION_PROBLEM, DUPLICATE_SUBMISSION, TECHNICAL_FAILURE,
// PROVIDER_ERROR, CLAIMANT_INFORMATION_ERROR, OTHER. Classify severity:
// LOW/MEDIUM/HIGH/CRITICAL. High/critical rejection should always
// require human review. AI may optionally interpret provider rejection
// messages, but must NOT independently decide to resubmit."
//
// Same config-table + fail-closed-to-CRITICAL discipline as
// conflictDetection.ts's (P5-6) classifyConflictSeverity(): an
// unconfigured category is never under-flagged as harmless. AI
// rejection-message interpretation itself needs an AIProvider
// (blocked, no vendor account exists); the classification/severity
// logic here doesn't depend on it -- it works over a category a caller
// has already determined (whether by a human, a config-mapped
// provider error code, or eventually an AI classifier).

export type RejectionCategory =
  | "MISSING_DOCUMENT"
  | "INVALID_FORM"
  | "INVALID_DATA"
  | "SIGNATURE_PROBLEM"
  | "PAYMENT_PROBLEM"
  | "JURISDICTION_PROBLEM"
  | "DUPLICATE_SUBMISSION"
  | "TECHNICAL_FAILURE"
  | "PROVIDER_ERROR"
  | "CLAIMANT_INFORMATION_ERROR"
  | "OTHER";

export type RejectionSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// doc 08 section 41's own worked examples map directly onto categories
// -- config table, not an inline if/else chain. A category not listed
// here (including OTHER) fails closed to CRITICAL via
// classifyRejectionSeverity(), never silently treated as low-risk.
export const DEFAULT_REJECTION_SEVERITY: Partial<Record<RejectionCategory, RejectionSeverity>> = {
  TECHNICAL_FAILURE: "LOW", // "Formatting issue" -- doc's own LOW example
  INVALID_FORM: "MEDIUM",
  INVALID_DATA: "MEDIUM",
  DUPLICATE_SUBMISSION: "MEDIUM",
  PROVIDER_ERROR: "MEDIUM",
  CLAIMANT_INFORMATION_ERROR: "MEDIUM", // "Missing optional information" -- doc's own MEDIUM example
  MISSING_DOCUMENT: "HIGH", // "Required document missing" -- doc's own HIGH example
  SIGNATURE_PROBLEM: "HIGH",
  PAYMENT_PROBLEM: "HIGH",
  JURISDICTION_PROBLEM: "CRITICAL", // "submitted to wrong authority" -- doc's own CRITICAL example
};

/**
 * Pure: doc 08 section 41. Fails closed to CRITICAL for a category
 * this table hasn't been configured for -- same discipline as
 * classifyConflictSeverity()/checkFeeCompliance(): an unrecognized
 * category is a configuration gap, not a reason to under-flag it.
 */
export function classifyRejectionSeverity(category: RejectionCategory): RejectionSeverity {
  return DEFAULT_REJECTION_SEVERITY[category] ?? "CRITICAL";
}

export interface RejectionRecord {
  category: RejectionCategory;
  severity: RejectionSeverity;
  rawProviderMessage: string;
  affectedComponent?: string;
  // doc 08 section 41: "High/critical rejection should always require
  // human review."
  requiresHumanReview: boolean;
}

/**
 * Pure: doc 08 sections 39-41. Turns a categorized rejection into a
 * fully-classified record. Does not decide anything about
 * resubmission -- doc 08 section 42's explicit "the AI must NOT
 * independently decide to resubmit" applies to this logic layer too,
 * not just an AI assistant; that decision belongs to the correction/
 * resubmission workflow (P7-17) and an operator.
 */
export function classifyRejection(
  category: RejectionCategory,
  rawProviderMessage: string,
  affectedComponent?: string
): RejectionRecord {
  const severity = classifyRejectionSeverity(category);
  return {
    category,
    severity,
    rawProviderMessage,
    affectedComponent,
    requiresHumanReview: severity === "HIGH" || severity === "CRITICAL",
  };
}
