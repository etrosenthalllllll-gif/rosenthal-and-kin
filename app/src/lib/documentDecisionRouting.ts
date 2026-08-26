// Document-based decisions -- doc 05 section 35. PLAN.md P4-14.
//
// "Integrate with the existing Decision System. Create decisions when:
// Document classification is ambiguous, Case matching is ambiguous,
// ... Documents conflict, Required evidence is missing, ... Duplicate
// is suspected, Validation fails, ..." / "The decision dashboard should
// display: Case, Document, Issue, AI recommendation, Evidence,
// Confidence, Actions."
//
// This module is the WIRING layer: it takes the outputs P4-3
// (documentDuplicateDetection.ts), P4-4 (matchDocumentToCase.ts), P4-5
// (documentValidation.ts), and P4-6 (claimReadiness.ts) already
// produce and turns each one into a DecisionRecommendation against the
// decisionTypes.ts registry -- exactly the "wire into the existing
// decision system rather than build a new one" instruction, same
// pattern P3-2's RESOLVE_AMBIGUOUS_CASE_MATCH and P3-3's
// planInboundEmailIngestion.ts already established for communications.
// It does not create a real Decision row (needs a live Prisma call);
// callers turn a non-null recommendation into one the same way any
// other decision gets created.

import type { DecisionTypeKey } from "./decisionTypes";
import type { DocumentMatchDecision } from "./matchDocumentToCase";
import type { DuplicateCheckResult } from "./documentDuplicateDetection";
import type {
  FieldComparisonResult,
  CrossDocumentComparisonResult,
} from "./documentValidation";
import type { ClaimReadinessResult } from "./claimReadiness";

export interface DecisionRecommendation {
  decisionTypeKey: DecisionTypeKey;
  reason: string;
  evidenceRefs: string[]; // document IDs the operator should review
}

/**
 * Pure: doc 05 section 12 -- an ambiguous or unmatched document becomes
 * a RESOLVE_AMBIGUOUS_DOCUMENT_MATCH exception. A clean NO_MATCH is
 * routed the same way as AMBIGUOUS (empty evidence list) rather than
 * silently dropped, mirroring planInboundEmailIngestion.ts's identical
 * NO_MATCH handling for communications -- "never silently attach"
 * applies just as much to "never silently orphan."
 */
export function planDocumentMatchDecision(
  documentId: string,
  decision: DocumentMatchDecision
): DecisionRecommendation | null {
  if (decision.outcome === "AUTO_ATTACH") {
    return null;
  }

  if (decision.outcome === "AMBIGUOUS") {
    return {
      decisionTypeKey: "RESOLVE_AMBIGUOUS_DOCUMENT_MATCH",
      reason: `Document could belong to ${decision.candidates.length} candidate case(s): ${decision.candidates
        .map((c) => c.caseNumber)
        .join(", ")}.`,
      evidenceRefs: [documentId],
    };
  }

  return {
    decisionTypeKey: "RESOLVE_AMBIGUOUS_DOCUMENT_MATCH",
    reason: "Document did not match any known case.",
    evidenceRefs: [documentId],
  };
}

/**
 * Pure: doc 05 section 22 -- a confirmed exact duplicate becomes a
 * RESOLVE_SUSPECTED_DUPLICATE_DOCUMENT exception. "Never delete a
 * potential duplicate automatically" -- this only ever recommends a
 * decision, never resolves one itself.
 */
export function planDuplicateDocumentDecision(
  newDocumentId: string,
  result: DuplicateCheckResult
): DecisionRecommendation | null {
  if (result.outcome === "UNIQUE") {
    return null;
  }

  return {
    decisionTypeKey: "RESOLVE_SUSPECTED_DUPLICATE_DOCUMENT",
    reason: "This document appears to be an exact duplicate of one already on file.",
    evidenceRefs: [newDocumentId, result.matchingDocumentId],
  };
}

/**
 * Pure: doc 05 section 16 -- one extracted field conflicting with the
 * case's own data becomes a RESOLVE_DOCUMENT_CONFLICT exception.
 */
export function planCaseDataConflictDecision(
  documentId: string,
  fieldName: string,
  result: FieldComparisonResult
): DecisionRecommendation | null {
  if (result !== "CONFLICT") {
    return null;
  }

  return {
    decisionTypeKey: "RESOLVE_DOCUMENT_CONFLICT",
    reason: `Document's "${fieldName}" conflicts with the case's existing data.`,
    evidenceRefs: [documentId],
  };
}

/**
 * Pure: doc 05 section 17 -- two or more documents disagreeing on the
 * same field becomes a RESOLVE_DOCUMENT_CONFLICT exception, with every
 * conflicting document as evidence (never picks a winner itself).
 */
export function planCrossDocumentConflictDecision(
  fieldName: string,
  result: CrossDocumentComparisonResult
): DecisionRecommendation | null {
  if (result.status !== "CONFLICT") {
    return null;
  }

  return {
    decisionTypeKey: "RESOLVE_DOCUMENT_CONFLICT",
    reason: `Documents disagree on "${fieldName}": ${result.distinctValues
      .map((d) => `"${d.value}"`)
      .join(" vs. ")}.`,
    evidenceRefs: result.distinctValues.flatMap((d) => d.documentIds),
  };
}

/**
 * Pure: doc 05 sections 20/42 -- a claim that's NOT_READY because of
 * missing required documents becomes REQUEST_DOCUMENTS decisions (doc
 * 04's existing type; section 42 says the communications engine should
 * be able to generate "Please provide a copy of your..." from exactly
 * this). One recommendation per missing requirement, not one for the
 * whole case, since each is independently actionable.
 */
export function planMissingDocumentDecisions(
  readiness: ClaimReadinessResult
): DecisionRecommendation[] {
  return readiness.missingDocumentNames.map((name) => ({
    decisionTypeKey: "REQUEST_DOCUMENTS" as DecisionTypeKey,
    reason: `${name} is missing and required for this claim to proceed.`,
    evidenceRefs: [],
  }));
}
