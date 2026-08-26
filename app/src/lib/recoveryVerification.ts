// ActualRecovery tracking + receipt ingestion + verification -- doc 10
// sections 5-7. PLAN.md P9-2.
//
// "Support recovery information from: authority notifications, bank
// integration, uploaded checks/receipts, inbound email, provider
// notifications, manual entry, claimant notification, external
// payment system -- every actual recovery should have a source. Before
// marking recovery VERIFIED, check: amount, source, date, reference,
// supporting document, case association, claim association, expected-
// recovery comparison. If information conflicts, create
// RECOVERY_RECONCILIATION_EXCEPTION and route to the decision system."
//
// Governs the schema's ActualRecovery model (P9-2). Same "list every
// blocker, never a bare boolean" discipline as filingReadiness.ts
// (P7-2)/postFilingClosure.ts (P8-17) -- and a conflict with the
// expected recovery always forces REQUIRES_REVIEW regardless of how
// clean every other check is, never silently marked VERIFIED.

// doc 10 section 6's own detection-source list, verbatim.
export type RecoveryReceiptSource =
  | "AUTHORITY_NOTIFICATION"
  | "BANK_PAYMENT_INTEGRATION"
  | "UPLOADED_RECEIPT"
  | "INBOUND_EMAIL"
  | "PROVIDER_NOTIFICATION"
  | "MANUAL_OPERATOR_ENTRY"
  | "CLAIMANT_NOTIFICATION"
  | "EXTERNAL_PAYMENT_SYSTEM";

export interface RecoveryVerificationInput {
  amountPresent: boolean;
  sourcePresent: boolean;
  datePresent: boolean;
  referencePresent: boolean;
  supportingDocumentPresent: boolean;
  caseAssociationConfirmed: boolean;
  claimAssociationConfirmed: boolean;
  // doc 10 section 7's own comparison against the current expected
  // recovery (P9-3's variance check) -- a conflict here always wins,
  // regardless of how clean every other field is.
  conflictsWithExpectedRecovery: boolean;
}

export interface RecoveryVerificationCheck {
  key: string;
  detail: string;
}

export type RecoveryVerificationOutcome = "VERIFIED" | "REQUIRES_REVIEW";

export interface RecoveryVerificationResult {
  outcome: RecoveryVerificationOutcome;
  unmetChecks: RecoveryVerificationCheck[];
}

const VERIFICATION_CHECKS: ReadonlyArray<{ key: keyof Omit<RecoveryVerificationInput, "conflictsWithExpectedRecovery">; detail: string }> = [
  { key: "amountPresent", detail: "Amount is missing." },
  { key: "sourcePresent", detail: "Source is missing." },
  { key: "datePresent", detail: "Date is missing." },
  { key: "referencePresent", detail: "Reference is missing." },
  { key: "supportingDocumentPresent", detail: "Supporting document is missing." },
  { key: "caseAssociationConfirmed", detail: "Case association is not confirmed." },
  { key: "claimAssociationConfirmed", detail: "Claim association is not confirmed." },
];

/**
 * Pure: doc 10 section 7. VERIFIED only when every check passes AND
 * there's no conflict with the expected recovery -- a conflict alone
 * forces REQUIRES_REVIEW even if every other field is clean, since
 * that's exactly the RECOVERY_RECONCILIATION_EXCEPTION case the doc
 * calls for.
 */
export function evaluateRecoveryVerification(input: RecoveryVerificationInput): RecoveryVerificationResult {
  const unmetChecks: RecoveryVerificationCheck[] = VERIFICATION_CHECKS.filter((c) => !input[c.key]).map((c) => ({
    key: c.key,
    detail: c.detail,
  }));

  if (input.conflictsWithExpectedRecovery) {
    unmetChecks.push({ key: "conflictsWithExpectedRecovery", detail: "Conflicts with the expected recovery amount." });
  }

  return { outcome: unmetChecks.length === 0 ? "VERIFIED" : "REQUIRES_REVIEW", unmetChecks };
}
