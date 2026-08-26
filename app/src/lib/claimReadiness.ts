// Claim readiness calculation -- doc 05 section 39, extended by doc 06
// section 39. PLAN.md P4-6, extended by P5-12.
//
// doc 05: "Build a document-driven claim readiness calculation...
// Identity: Verified / Relationship: Verified / Required documents:
// Complete / Conflicts: None / Missing: None / Overall: READY FOR
// OPERATOR APPROVAL. If something is incomplete: NOT READY. Reason:
// Marriage certificate missing."
//
// doc 06: "The claim system should be able to request: 'Is the
// claimant sufficiently verified for this workflow?' The verification
// layer should return structured information: Identity: SUPPORTED /
// Relationship: SUPPORTED / Evidence completeness: 92% / Conflicts: 1
// / Potential competing heirs: 1 / Human review: REQUIRED / Claim
// readiness: NOT_READY."
//
// One readiness calculation, not two competing ones -- P5-12 folds
// doc 06's identity/relationship/competing-heir/review-required
// signals into the same function P4-6 already built for documents,
// rather than every caller having to combine two separate results
// itself. The new inputs are all optional so P4-6's original
// document-only callers keep working unchanged when they don't supply
// verification data yet.
//
// Pure aggregation over this phase's own building blocks -- doesn't
// duplicate their logic:
// - documentRequirements.ts's checklist/detectMissingDocuments (P4-2)
//   for "Required documents: Complete."
// - documentValidation.ts's conflict detection (P4-5) for "Conflicts:
//   None," fed in by the caller as already-detected conflicts rather
//   than recomputed here.
// - identityResolution.ts (P5-2) / relationshipVerification.ts (P5-3)
//   / competingHeirDetection.ts (P5-8) / humanReviewTriggers.ts (P5-9)
//   -- the caller reduces each of those to the simple booleans/counts
//   below; this module doesn't re-derive verification status itself.
//
// Feeding this into the actual Decision system (creating a real
// decision row when NOT_READY) is wiring work for whichever task
// builds those decisions (P4-14/P5-10) -- this module only computes
// the readiness *result*, same "compute vs. wire in" split as
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
  // doc 06 section 39's additions. `undefined` means "not evaluated
  // yet" and never blocks readiness on its own -- only an explicit
  // `false`/positive count does. This keeps P4-6's original
  // document-only callers working unchanged.
  identityVerified?: boolean;
  relationshipVerified?: boolean;
  competingHeirsCount?: number;
  // From humanReviewTriggers.ts's evaluateReviewTriggers().requiresReview
  // -- any fired verification review trigger blocks readiness
  // regardless of how the other fields above look.
  verificationReviewRequired?: boolean;
}

export type ClaimReadinessStatus = "READY_FOR_OPERATOR_APPROVAL" | "NOT_READY";

export interface ClaimReadinessResult {
  status: ClaimReadinessStatus;
  requiredDocumentsComplete: boolean;
  missingDocumentNames: string[];
  conflictCount: number;
  identityVerified: boolean | null;
  relationshipVerified: boolean | null;
  competingHeirsCount: number;
  // doc 05 section 39's own "Reason: Marriage certificate missing." --
  // one line per blocking issue, in a stable order (missing documents,
  // conflicts, then verification issues) so the same input always
  // produces the same reasons in the same order.
  reasons: string[];
}

/**
 * Pure: doc 05 section 39 + doc 06 section 39. READY only when every
 * required document is SATISFIED, no conflict remains open, identity
 * and relationship are verified (when that's been evaluated at all),
 * no competing heir is outstanding, and no verification review is
 * pending -- every condition checked independently, since any one of
 * them can block a claim that's otherwise complete.
 */
export function calculateClaimReadiness(input: ClaimReadinessInput): ClaimReadinessResult {
  const requiredDocumentsComplete = isChecklistComplete(input.checklist);
  const missing = detectMissingDocuments(input.checklist);
  const missingDocumentNames = missing.map((item) => item.requirement.displayName);
  const competingHeirsCount = input.competingHeirsCount ?? 0;

  const reasons: string[] = [
    ...missingDocumentNames.map((name) => `${name} missing.`),
    ...input.unresolvedConflicts.map((c) => c.description),
  ];

  if (input.identityVerified === false) {
    reasons.push("Identity is not yet verified.");
  }
  if (input.relationshipVerified === false) {
    reasons.push("Relationship is not yet verified.");
  }
  if (competingHeirsCount > 0) {
    reasons.push(
      competingHeirsCount === 1
        ? "1 potential competing heir requires resolution."
        : `${competingHeirsCount} potential competing heirs require resolution.`
    );
  }
  if (input.verificationReviewRequired) {
    reasons.push("Verification requires human review.");
  }

  const status: ClaimReadinessStatus =
    requiredDocumentsComplete &&
    input.unresolvedConflicts.length === 0 &&
    input.identityVerified !== false &&
    input.relationshipVerified !== false &&
    competingHeirsCount === 0 &&
    !input.verificationReviewRequired
      ? "READY_FOR_OPERATOR_APPROVAL"
      : "NOT_READY";

  return {
    status,
    requiredDocumentsComplete,
    missingDocumentNames,
    conflictCount: input.unresolvedConflicts.length,
    identityVerified: input.identityVerified ?? null,
    relationshipVerified: input.relationshipVerified ?? null,
    competingHeirsCount,
    reasons,
  };
}
