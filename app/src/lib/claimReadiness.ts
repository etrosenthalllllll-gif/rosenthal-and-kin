// Claim readiness calculation -- doc 05 section 39. PLAN.md P4-6.
//
// "Build a document-driven claim readiness calculation... Identity:
// Verified / Relationship: Verified / Required documents: Complete /
// Conflicts: None / Missing: None / Overall: READY FOR OPERATOR
// APPROVAL. If something is incomplete: NOT READY. Reason: Marriage
// certificate missing. This should feed into the existing decision
// system."
//
// Pure aggregation over this phase's own building blocks -- doesn't
// duplicate their logic:
// - documentRequirements.ts's checklist/detectMissingDocuments (P4-2)
//   for "Required documents: Complete."
// - documentValidation.ts's conflict detection (P4-5) for "Conflicts:
//   None," fed in by the caller as already-detected conflicts rather
//   than recomputed here.
//
// Feeding this into the actual Decision system (creating a real
// DOCUMENT_* decision row when NOT_READY) is wiring work for whichever
// task builds document-based decisions (P4-14) -- this module only
// computes the readiness *result*, same "compute vs. wire in" split as
// followUpScheduler.ts (P3-7) planning a send vs. something else
// actually sending it.

import {
  detectMissingDocuments,
  isChecklistComplete,
  type ChecklistItem,
} from "./documentRequirements";

export interface UnresolvedConflict {
  description: string;
}

export interface ClaimReadinessInput {
  // Identity/relationship requirement checklist -- e.g. from
  // buildDocumentChecklist("CLAIM_FILING", ...). Not restricted to
  // exactly those two keys: any required checklist item not SATISFIED
  // makes the claim NOT_READY, with its own reason line.
  checklist: readonly ChecklistItem[];
  // Any still-open DATA_CONFLICT / cross-document conflict (doc 05
  // sections 16-17) -- the caller resolves these via the decision
  // system; this module only checks whether any remain open.
  unresolvedConflicts: readonly UnresolvedConflict[];
}

export type ClaimReadinessStatus = "READY_FOR_OPERATOR_APPROVAL" | "NOT_READY";

export interface ClaimReadinessResult {
  status: ClaimReadinessStatus;
  requiredDocumentsComplete: boolean;
  missingDocumentNames: string[];
  conflictCount: number;
  // doc 05 section 39's own "Reason: Marriage certificate missing." --
  // one line per blocking issue, in a stable order (missing documents,
  // then conflicts) so the same input always produces the same reasons
  // in the same order.
  reasons: string[];
}

/**
 * Pure: doc 05 section 39. READY only when every required document is
 * SATISFIED and no conflict remains open -- both conditions checked
 * independently, since a case can have every document present yet
 * still be blocked by an unresolved conflict, or vice versa.
 */
export function calculateClaimReadiness(input: ClaimReadinessInput): ClaimReadinessResult {
  const requiredDocumentsComplete = isChecklistComplete(input.checklist);
  const missing = detectMissingDocuments(input.checklist);
  const missingDocumentNames = missing.map((item) => item.requirement.displayName);

  const reasons: string[] = [
    ...missingDocumentNames.map((name) => `${name} missing.`),
    ...input.unresolvedConflicts.map((c) => c.description),
  ];

  const status: ClaimReadinessStatus =
    requiredDocumentsComplete && input.unresolvedConflicts.length === 0
      ? "READY_FOR_OPERATOR_APPROVAL"
      : "NOT_READY";

  return {
    status,
    requiredDocumentsComplete,
    missingDocumentNames,
    conflictCount: input.unresolvedConflicts.length,
    reasons,
  };
}
