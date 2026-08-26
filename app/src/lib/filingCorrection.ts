// Correction + resubmission workflow + duplicate-filing protection --
// doc 08 sections 43-48. PLAN.md P7-17.
//
// "Create a CorrectionCase. If a correction changes the claim package,
// create a new package version -- never mutate the approved one --
// requiring fresh approval. Resubmission must be a new FilingAttempt,
// never overwriting a prior one. Before resubmission, verify
// correction/new package/approval/fee/payment/destination/no
// unresolved blocker/provider-accepts-resubmission. Before submitting,
// search for existing active filings for the same case/claim/property/
// claimant/authority; if a possible duplicate exists, PAUSE and require
// operator review."
//
// A package-changing correction reuses claimPackage.ts's (P6-14)
// assembleClaimPackage()/diffClaimPackages() rather than a second
// versioning mechanism -- this module's job is the correction-case
// lifecycle and the resubmission/duplicate checks around it, not
// re-deriving how a package version is built or diffed.

// doc 08 section 43's own status list, verbatim.
export type CorrectionStatus =
  | "OPEN"
  | "RESEARCHING"
  | "WAITING_FOR_DOCUMENT"
  | "READY_FOR_REVISION"
  | "REVISED"
  | "APPROVED"
  | "CLOSED";

export interface CorrectionCase {
  id: string;
  filingId: string;
  filingAttemptId: string;
  reason: string;
  affectedDocument?: string;
  affectedField?: string;
  requiredAction: string;
  status: CorrectionStatus;
  assignedOperator: string | null;
  resolution: string | null;
  createdAt: string;
}

export interface CreateCorrectionCaseInput {
  id: string;
  filingId: string;
  filingAttemptId: string;
  reason: string;
  affectedDocument?: string;
  affectedField?: string;
  requiredAction: string;
  createdAt: string;
}

/**
 * Pure: doc 08 section 43. Every correction starts OPEN, unassigned,
 * unresolved -- status/assignment/resolution only change through
 * later, explicit calls, never inferred at creation time.
 */
export function createCorrectionCase(input: CreateCorrectionCaseInput): CorrectionCase {
  return { ...input, status: "OPEN", assignedOperator: null, resolution: null };
}

// --- Resubmission readiness (doc 08 section 47) ------------------------

export interface ResubmissionReadinessInput {
  correctionResolved: boolean;
  newPackageApproved: boolean;
  feeRequirementsVerified: boolean;
  paymentRequirementsVerified: boolean;
  destinationVerified: boolean;
  noUnresolvedBlocker: boolean;
  providerAcceptsResubmission: boolean;
}

export interface ResubmissionBlocker {
  key: string;
  detail: string;
}

export interface ResubmissionReadinessResult {
  outcome: "READY" | "NOT_READY";
  blockers: ResubmissionBlocker[];
}

// doc 08 section 47's own checklist, verbatim, as a config table --
// same "every applicable check must pass, list every blocker"
// discipline as filingReadiness.ts (P7-2).
const RESUBMISSION_CHECKS: ReadonlyArray<{ key: keyof ResubmissionReadinessInput; detail: string }> = [
  { key: "correctionResolved", detail: "The correction has not been resolved." },
  { key: "newPackageApproved", detail: "The new (corrected) package has not been approved." },
  { key: "feeRequirementsVerified", detail: "Fee requirements have not been verified." },
  { key: "paymentRequirementsVerified", detail: "Payment requirements have not been verified." },
  { key: "destinationVerified", detail: "Filing destination has not been verified." },
  { key: "noUnresolvedBlocker", detail: "There are unresolved blockers." },
  { key: "providerAcceptsResubmission", detail: "The provider does not accept resubmission for this filing." },
];

/**
 * Pure: doc 08 section 47. Mirrors filingReadiness.ts's own shape --
 * READY only once every check passes, every failing check named
 * rather than a bare boolean.
 */
export function evaluateResubmissionReadiness(input: ResubmissionReadinessInput): ResubmissionReadinessResult {
  const blockers: ResubmissionBlocker[] = [];
  for (const check of RESUBMISSION_CHECKS) {
    if (!input[check.key]) blockers.push({ key: check.key, detail: check.detail });
  }
  return { outcome: blockers.length === 0 ? "READY" : "NOT_READY", blockers };
}

// --- Duplicate-filing protection (doc 08 section 48) --------------------

export interface ActiveFilingReference {
  filingId: string;
  status: string;
}

export type DuplicateFilingDecision = "PROCEED" | "PAUSE_REQUIRES_REVIEW";

export interface DuplicateFilingCheckResult {
  decision: DuplicateFilingDecision;
  existingFilings: readonly ActiveFilingReference[];
}

/**
 * Pure: doc 08 section 48. The caller is responsible for finding every
 * existing *active* filing matching the same case/claim/property/
 * claimant/filing authority combination -- this function's only job is
 * deciding what to do once it has that list: any match at all pauses
 * and requires operator review, never a silent block or silent allow.
 */
export function checkDuplicateFilingProtection(
  existingActiveFilings: readonly ActiveFilingReference[]
): DuplicateFilingCheckResult {
  return {
    decision: existingActiveFilings.length === 0 ? "PROCEED" : "PAUSE_REQUIRES_REVIEW",
    existingFilings: existingActiveFilings,
  };
}
