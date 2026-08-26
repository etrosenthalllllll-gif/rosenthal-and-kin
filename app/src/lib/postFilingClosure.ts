// Case closure + reopening -- doc 09 sections 59-60. PLAN.md P8-17.
//
// "Before closure, verify: no outstanding deadline, no unresolved
// document request, no unresolved escalation, no active hearing, final
// status captured, final documents stored. Closed cases may need
// reopening -- support REOPEN_CASE, reason required, preserve the
// previous closure."
//
// Same "list every blocker, never a bare boolean" discipline as
// filingReadiness.ts (P7-2)/postFilingDocumentRequest.ts's family; a
// reopen preserves the prior ClosureRecord rather than deleting it,
// same never-erase-history discipline as every other *Version/*Snapshot
// model in this codebase.

// doc 09 section 59's own closure-reason list, verbatim.
export type PostFilingClosureReason =
  | "CLAIM_ACCEPTED"
  | "CLAIM_DENIED"
  | "CLAIMANT_WITHDREW"
  | "DUPLICATE_CLAIM"
  | "NO_FURTHER_ACTION"
  | "AUTHORITY_CLOSED_CASE"
  | "OTHER";

export interface ClosureReadinessInput {
  hasOutstandingDeadline: boolean;
  hasUnresolvedDocumentRequest: boolean;
  hasUnresolvedEscalation: boolean;
  hasActiveHearing: boolean;
  finalStatusCaptured: boolean;
  finalDocumentsStored: boolean;
}

export interface ClosureBlocker {
  key: string;
  detail: string;
}

export interface ClosureReadinessResult {
  canClose: boolean;
  blockers: ClosureBlocker[];
}

// doc 09 section 59's own checklist, as a config table.
const CLOSURE_CHECKS: ReadonlyArray<{ key: keyof ClosureReadinessInput; blockedWhen: boolean; detail: string }> = [
  { key: "hasOutstandingDeadline", blockedWhen: true, detail: "There is an outstanding deadline." },
  { key: "hasUnresolvedDocumentRequest", blockedWhen: true, detail: "There is an unresolved document request." },
  { key: "hasUnresolvedEscalation", blockedWhen: true, detail: "There is an unresolved escalation." },
  { key: "hasActiveHearing", blockedWhen: true, detail: "There is an active hearing." },
  { key: "finalStatusCaptured", blockedWhen: false, detail: "The final status has not been captured." },
  { key: "finalDocumentsStored", blockedWhen: false, detail: "Final documents have not been stored." },
];

/**
 * Pure: doc 09 section 59. A case never auto-closes with any one
 * blocker present -- every failing check is named, same discipline as
 * filingReadiness.ts (P7-2).
 */
export function evaluateClosureReadiness(input: ClosureReadinessInput): ClosureReadinessResult {
  const blockers: ClosureBlocker[] = [];
  for (const check of CLOSURE_CHECKS) {
    if (input[check.key] === check.blockedWhen) {
      blockers.push({ key: check.key, detail: check.detail });
    }
  }
  return { canClose: blockers.length === 0, blockers };
}

export interface ClosureRecord {
  reason: PostFilingClosureReason;
  closedAt: string;
  closedBy: string;
}

export interface ReopenResult {
  status: "REOPENED" | "REJECTED_MISSING_REASON";
  // The prior closure, always preserved on a successful reopen --
  // never erased or overwritten.
  preservedClosure?: ClosureRecord;
  reopenReason?: string;
  reopenedBy?: string;
  reopenedAt?: string;
}

/**
 * Pure: doc 09 section 60. "Reason required" -- an empty/blank reason
 * is rejected outright rather than silently reopening with no
 * explanation. On success, the prior closure record is returned
 * unchanged alongside the new reopen details -- a caller writes both
 * as separate rows, never overwriting the original closure.
 */
export function reopenCase(
  priorClosure: ClosureRecord,
  reason: string,
  actor: string,
  timestamp: string
): ReopenResult {
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
