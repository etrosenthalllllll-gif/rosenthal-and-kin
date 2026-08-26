// Required-document rules / requirement engine -- doc 07 sections 8-10.
// PLAN.md P6-6.
//
// "Extend the requirements model with a richer status set: REQUIRED,
// RECEIVED, VALIDATED, VERIFIED, MISSING, CONFLICTED, EXPIRED,
// NOT_APPLICABLE, PENDING. Support conditional requirements (e.g. if
// the claimant acts on behalf of an estate, require estate
// documentation). Every requirement should trace back to the rule
// that created it."
//
// This extends documentRequirements.ts (P4-2) rather than replacing
// it: P4-2's per-workflow-stage checklist stays exactly as-is for the
// claimant-verification/document-intake side of the product (doc 05).
// This module is doc 07's claim-preparation-specific requirement
// engine, sourced from claimRules.ts's (P6-4) rule outcomes instead of
// a fixed per-stage table -- so "conditional" requirements (estate
// representative needing estate documentation) are just a
// claimantType-scoped rule, already handled by the rules engine, not
// special-cased here.
//
// REQUIRED and PENDING are intentionally NOT derived by this module:
// they describe workflow state (has a request even been sent yet?)
// that belongs to ClaimPreparation.status (P6-1), not to a pure
// function evaluating a snapshot of documents. This module derives the
// rest of the status set from the documents actually on hand.

import { evaluateClaimRequirements, type ClaimRule, type ClaimantType } from "./claimRules";
import type { ClaimTypeKey } from "./claimTypes";

export type ClaimRequirementCategory =
  | "DOCUMENT"
  | "FORM"
  | "SIGNATURE"
  | "DECLARATION"
  | "EXHIBIT";

// doc 07 section 8's own status list, verbatim, minus REQUIRED/PENDING
// (see header note) plus those two kept in the type for API
// completeness -- a caller layering in workflow state can still use
// this same vocabulary.
export type ClaimRequirementStatus =
  | "REQUIRED"
  | "PENDING"
  | "RECEIVED"
  | "VALIDATED"
  | "VERIFIED"
  | "MISSING"
  | "CONFLICTED"
  | "EXPIRED"
  | "NOT_APPLICABLE";

export interface ClaimRequirementCandidate {
  id: string;
  key: string; // matches one of the requirement's satisfying keys (a document type, form id, etc.)
  // Caller-supplied status for this specific candidate. Upstream
  // modules (documentValidation.ts/P4-5, identityResolution.ts/P5-2,
  // conflictDetection.ts/P5-6) already compute validation/conflict/
  // verification outcomes -- this module composes their conclusions
  // rather than re-deriving them.
  status: "RECEIVED" | "VALIDATED" | "VERIFIED" | "CONFLICTED" | "EXPIRED";
  // A confirmed duplicate never counts toward satisfying a
  // requirement -- same discipline as documentRequirements.ts.
  isConfirmedDuplicate?: boolean;
}

export interface ClaimRequirementItem {
  category: ClaimRequirementCategory;
  key: string;
  status: ClaimRequirementStatus;
  matchingCandidateIds: string[];
  // Every rule that required this item, so it always traces back to
  // its source -- doc 07 section 10's explicit requirement.
  sourceRuleIds: string[];
}

const STATUS_PRIORITY: Record<ClaimRequirementCandidate["status"], number> = {
  // Higher wins when multiple usable candidates exist for one
  // requirement key -- a verified document should never be shadowed by
  // a merely-received duplicate of the same type, but an unresolved
  // conflict always outranks a plain validated/received status since
  // it needs resolution before the requirement can be trusted.
  VERIFIED: 4,
  CONFLICTED: 3,
  EXPIRED: 2,
  VALIDATED: 1,
  RECEIVED: 0,
};

function resolveStatus(candidates: readonly ClaimRequirementCandidate[]): ClaimRequirementStatus {
  const usable = candidates.filter((c) => !c.isConfirmedDuplicate);
  if (usable.length === 0) return "MISSING";

  // CONFLICTED always wins regardless of what else is present -- an
  // unresolved conflict can't be masked by a differently-sourced
  // validated/verified candidate for the same requirement key.
  if (usable.some((c) => c.status === "CONFLICTED")) return "CONFLICTED";

  const best = usable.reduce((a, b) => (STATUS_PRIORITY[b.status] > STATUS_PRIORITY[a.status] ? b : a));
  return best.status;
}

function itemsForCategory(
  category: ClaimRequirementCategory,
  keys: readonly string[],
  appliedRules: readonly ClaimRule[],
  keyField: keyof ClaimRule["outcome"],
  candidates: readonly ClaimRequirementCandidate[]
): ClaimRequirementItem[] {
  return keys.map((key) => {
    const matches = candidates.filter((c) => c.key === key);
    const sourceRuleIds = appliedRules.filter((r) => (r.outcome[keyField] as readonly string[]).includes(key)).map((r) => r.id);
    return {
      category,
      key,
      status: resolveStatus(matches),
      matchingCandidateIds: matches.filter((c) => !c.isConfirmedDuplicate).map((c) => c.id),
      sourceRuleIds,
    };
  });
}

/**
 * Pure: doc 07 sections 8-10. Evaluates claimRules.ts's rule outcome
 * for this jurisdiction/claimType/claimantType against the candidate
 * evidence actually on hand, producing one checklist item per
 * required document type / form / signature / declaration / exhibit,
 * each traceable back to the rule(s) that required it.
 */
export function buildClaimRequirementChecklist(
  jurisdiction: string,
  claimType: ClaimTypeKey,
  claimantType: ClaimantType | undefined,
  candidatesByCategory: Partial<Record<ClaimRequirementCategory, readonly ClaimRequirementCandidate[]>>,
  rules?: readonly ClaimRule[]
): ClaimRequirementItem[] {
  const result = evaluateClaimRequirements(jurisdiction, claimType, claimantType, rules);

  return [
    ...itemsForCategory(
      "DOCUMENT",
      result.requiredDocumentTypes,
      result.appliedRules,
      "requiredDocumentTypes",
      candidatesByCategory.DOCUMENT ?? []
    ),
    ...itemsForCategory("FORM", result.requiredFormIds, result.appliedRules, "requiredFormIds", candidatesByCategory.FORM ?? []),
    ...itemsForCategory(
      "SIGNATURE",
      result.requiredSignatures,
      result.appliedRules,
      "requiredSignatures",
      candidatesByCategory.SIGNATURE ?? []
    ),
    ...itemsForCategory(
      "DECLARATION",
      result.requiredDeclarations,
      result.appliedRules,
      "requiredDeclarations",
      candidatesByCategory.DECLARATION ?? []
    ),
    ...itemsForCategory(
      "EXHIBIT",
      result.requiredExhibits,
      result.appliedRules,
      "requiredExhibits",
      candidatesByCategory.EXHIBIT ?? []
    ),
  ];
}

/**
 * Pure: true only when every checklist item has reached a
 * "requirement satisfied" status. CONFLICTED/MISSING/EXPIRED never
 * count, and NOT_APPLICABLE (a caller marking an item waived, e.g. a
 * conditional requirement whose trigger doesn't apply) is treated as
 * satisfied since nothing further is owed for it.
 */
export function isClaimChecklistComplete(items: readonly ClaimRequirementItem[]): boolean {
  return items.every((item) => item.status === "VALIDATED" || item.status === "VERIFIED" || item.status === "NOT_APPLICABLE");
}
