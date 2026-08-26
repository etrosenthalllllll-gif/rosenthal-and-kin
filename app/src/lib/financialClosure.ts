// Case closing rules + closure checker + reopening -- doc 10 sections
// 51-55. PLAN.md P9-16.
//
// "A case should not automatically close unless all configured
// requirements are satisfied: final recovery verified, distribution
// completed, required fees calculated, invoice issued/paid where
// applicable, no outstanding balance, no open payment dispute, no
// unresolved reconciliation exception, no active post-filing task, no
// outstanding document request, no active escalation, final documents
// stored, final notifications completed where required. Closed cases
// may need reopening -- require reason/actor/timestamp, preserve the
// previous closure."
//
// Same "list every blocker, never a bare boolean" + never-erase-
// history discipline as postFilingClosure.ts (P8-17) -- this is the
// financial-completion half of case closure, distinct from (and
// additional to) that post-filing-monitoring closure checklist.

export interface FinancialClosureReadinessInput {
  recoveryVerified: boolean;
  distributionComplete: boolean;
  feesCalculated: boolean;
  invoicePaidWhereApplicable: boolean;
  noOutstandingBalance: boolean;
  noOpenDispute: boolean;
  noUnresolvedReconciliationException: boolean;
}

export interface ClosureBlocker {
  key: string;
  detail: string;
}

export interface FinancialClosureReadinessResult {
  canClose: boolean;
  blockers: ClosureBlocker[];
}

// doc 10 section 51's own checklist (the financial subset -- post-
// filing task/document-request/escalation checks are P8-17's job, not
// duplicated here), as a config table.
const CLOSURE_CHECKS: ReadonlyArray<{ key: keyof FinancialClosureReadinessInput; detail: string }> = [
  { key: "recoveryVerified", detail: "Final recovery has not been verified." },
  { key: "distributionComplete", detail: "Distribution is not complete." },
  { key: "feesCalculated", detail: "Required fees have not been calculated." },
  { key: "invoicePaidWhereApplicable", detail: "Invoice has not been paid where applicable." },
  { key: "noOutstandingBalance", detail: "There is an outstanding balance." },
  { key: "noOpenDispute", detail: "There is an open payment dispute." },
  { key: "noUnresolvedReconciliationException", detail: "There is an unresolved reconciliation exception." },
];

/**
 * Pure: doc 10 section 51. A case never auto-closes financially with
 * any one blocker present -- every failing check is named.
 */
export function evaluateFinancialClosureReadiness(
  input: FinancialClosureReadinessInput
): FinancialClosureReadinessResult {
  const blockers = CLOSURE_CHECKS.filter((c) => !input[c.key]).map((c) => ({ key: c.key, detail: c.detail }));
  return { canClose: blockers.length === 0, blockers };
}

export interface FinancialClosureRecord {
  reason: string;
  finalRecoveryCents: number;
  finalFeesCents: number;
  finalDistributionCents: number;
  finalOutstandingBalanceCents: number;
  closedAt: string;
  closedBy: string;
}

export interface FinancialReopenResult {
  status: "REOPENED" | "REJECTED_MISSING_REASON";
  preservedClosure?: FinancialClosureRecord;
  reopenReason?: string;
  reopenedBy?: string;
  reopenedAt?: string;
}

/**
 * Pure: doc 10 sections 54-55. Same shape as postFilingClosure.ts's
 * (P8-17) reopenCase() -- reason required, prior closure record always
 * preserved unchanged rather than erased.
 */
export function reopenFinancialCase(
  priorClosure: FinancialClosureRecord,
  reason: string,
  actor: string,
  timestamp: string
): FinancialReopenResult {
  if (!reason.trim()) {
    return { status: "REJECTED_MISSING_REASON" };
  }

  return {
    status: "REOPENED",
    preservedClosure: priorClosure,
    reopenReason: reason,
    reopenedBy: actor,
    reopenedAt: timestamp,
  };
}
