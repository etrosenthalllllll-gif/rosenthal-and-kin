// Filing eligibility/readiness check -- doc 08 sections 4-5. PLAN.md P7-2.
//
// "Before filing, run a deterministic filing-readiness check ...
// Output: READY or NOT_READY. If not ready, show every blocker."
//
// Pure composition, same shape as
// claimCompletenessEngine.ts's (P6-13) evaluateClaimCompleteness():
// every check is named and reported individually rather than
// collapsed into one opaque boolean, so an operator always sees
// exactly what's still missing. This module doesn't re-derive whether
// the package is complete/valid -- callers supply those booleans
// (typically sourced from claimCompletenessEngine.ts/P6-13 and
// claimPackageIntegrity.ts/P6-15 directly).

export interface FilingReadinessInput {
  packageApproved: boolean;
  packageIntegrityPassed: boolean;
  requiredSignaturesComplete: boolean;
  requiredDocumentsPresent: boolean;
  requiredFormsValid: boolean;
  jurisdictionDetermined: boolean;
  filingDestinationDetermined: boolean;
  filingMethodDetermined: boolean;
  filingCredentialsAvailable: boolean;
  requiredMetadataAvailable: boolean;
  feeKnown: boolean;
  // doc 08's own "if necessary" qualifier -- a $0 fee case has nothing
  // to pay, so this only gates readiness when a nonzero fee is known.
  paymentMethodAvailable: boolean;
  feeAmountCents: number;
  noUnresolvedHardBlockers: boolean;
  noConflictingActiveFiling: boolean;
}

export type FilingReadinessOutcome = "READY" | "NOT_READY";

export interface FilingReadinessBlocker {
  key: string;
  detail: string;
}

export interface FilingReadinessResult {
  outcome: FilingReadinessOutcome;
  blockers: FilingReadinessBlocker[];
}

// doc 08 section 4's own checklist, verbatim, as a config table rather
// than an inline if/else chain -- adding a future check means adding a
// row here, not touching the evaluator.
const READINESS_CHECKS: ReadonlyArray<{
  key: keyof Omit<FilingReadinessInput, "feeAmountCents">;
  detail: string;
  // Only evaluated when this returns true -- lets paymentMethodAvailable
  // be conditional on feeAmountCents > 0 without a special-cased branch
  // in the evaluator itself.
  appliesTo?: (input: FilingReadinessInput) => boolean;
}> = [
  { key: "packageApproved", detail: "Claim package is not approved." },
  { key: "packageIntegrityPassed", detail: "Package integrity check has not passed." },
  { key: "requiredSignaturesComplete", detail: "Required signatures are not complete." },
  { key: "requiredDocumentsPresent", detail: "Required documents are not present." },
  { key: "requiredFormsValid", detail: "Required forms are not valid." },
  { key: "jurisdictionDetermined", detail: "Jurisdiction has not been determined." },
  { key: "filingDestinationDetermined", detail: "Filing destination has not been determined." },
  { key: "filingMethodDetermined", detail: "Filing method has not been determined." },
  { key: "filingCredentialsAvailable", detail: "Filing credentials are not available." },
  { key: "requiredMetadataAvailable", detail: "Required filing metadata is not available." },
  { key: "feeKnown", detail: "Filing fee is not yet known." },
  {
    key: "paymentMethodAvailable",
    detail: "A payment method is required but not available.",
    appliesTo: (input) => input.feeAmountCents > 0,
  },
  { key: "noUnresolvedHardBlockers", detail: "There are unresolved hard blockers." },
  { key: "noConflictingActiveFiling", detail: "An active filing already exists in a conflicting state." },
];

/**
 * Pure: doc 08 sections 4-5. Runs every readiness check and returns
 * READY only when all applicable checks pass; otherwise NOT_READY with
 * every failing check listed -- never a bare boolean.
 */
export function evaluateFilingReadiness(input: FilingReadinessInput): FilingReadinessResult {
  const blockers: FilingReadinessBlocker[] = [];

  for (const check of READINESS_CHECKS) {
    if (check.appliesTo && !check.appliesTo(input)) continue;
    if (!input[check.key]) {
      blockers.push({ key: check.key, detail: check.detail });
    }
  }

  return { outcome: blockers.length === 0 ? "READY" : "NOT_READY", blockers };
}
