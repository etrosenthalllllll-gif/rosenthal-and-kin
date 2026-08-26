// Form catalog + form selection engine -- doc 07 sections 11-13.
// PLAN.md P6-7.
//
// "Maintain a configurable form catalog, versioned and scoped by
// jurisdiction/claim type. Build pure selection logic: jurisdiction +
// claim type + claimant type + applicable rules -> the specific
// form(s) to use, with the rule that caused each selection recorded.
// If more than one form could plausibly apply, do not guess -- create
// a decision."
//
// The catalog holds metadata only -- real fillable-PDF templates are a
// separate, later concern needing actual official state forms; this
// module is the selection logic and the metadata shape those
// templates will eventually attach to. Same versioned/supersedes
// discipline as claimRules.ts (P6-4); selection is sourced from
// evaluateClaimRequirements() (P6-4) rather than re-deciding which
// forms apply from scratch, so a form's required-ness always traces
// back to the rule that required it.

import { evaluateClaimRequirements, latestVersionsOnly, type ClaimRule, type ClaimantType } from "./claimRules";
import type { ClaimTypeKey } from "./claimTypes";

export interface FormMetadata {
  // Unique catalog-entry identifier -- distinct from `formId` so a
  // later version of the same form can `supersede` an earlier entry
  // without the two becoming indistinguishable (they'd otherwise share
  // the same formId).
  id: string;
  formId: string;
  version: number;
  displayName: string;
  jurisdiction: string;
  claimType: ClaimTypeKey;
  claimantType?: ClaimantType; // omitted = applies to every claimant type
  description: string;
  sourceUrl?: string; // the official form source, once sourced
  supersedes?: string; // another entry's `id`
  // Real fillable templates don't exist yet for any of these -- see
  // module header. Nothing here should be treated as an
  // official/attorney-reviewed form.
  status: "EXAMPLE_PENDING_LEGAL_SOURCING" | "OFFICIAL_TEMPLATE_SOURCED";
}

// Seed table. Every entry needs a real official-form source before
// being relied on for an actual filing.
export const FORM_CATALOG: readonly FormMetadata[] = [
  {
    id: "ca-unclaimed-property-claim-form-v1",
    formId: "UNCLAIMED_PROPERTY_CLAIM_FORM",
    version: 1,
    displayName: "Unclaimed Property Claim Form",
    jurisdiction: "CA",
    claimType: "UNCLAIMED_PROPERTY",
    description: "The state controller's claim form for property reported as unclaimed.",
    status: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "ca-estate-claim-form-v1",
    formId: "ESTATE_CLAIM_FORM",
    version: 1,
    displayName: "Estate Claim Form",
    jurisdiction: "CA",
    claimType: "ESTATE_CLAIM",
    description: "Claim form filed directly against an estate.",
    status: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "ca-probate-claim-form-v1",
    formId: "PROBATE_CLAIM_FORM",
    version: 1,
    displayName: "Probate Claim Form",
    jurisdiction: "CA",
    claimType: "PROBATE_RELATED",
    description: "Claim form tied to an active or closed probate proceeding.",
    status: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "ca-agency-claim-form-v1",
    formId: "AGENCY_CLAIM_FORM",
    version: 1,
    displayName: "Agency Claim Form",
    jurisdiction: "CA",
    claimType: "GOVERNMENT_HELD_PROPERTY",
    description: "Claim form for property held by a government agency.",
    status: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
] as const;

export type FormSelectionOutcome = "SELECTED" | "MISSING_CATALOG_ENTRY" | "AMBIGUOUS_SELECTION";

export interface SelectedForm {
  formId: string;
  outcome: FormSelectionOutcome;
  // Only populated for SELECTED, or every plausible candidate for
  // AMBIGUOUS_SELECTION so a human reviewer sees the full picture
  // rather than a silent pick.
  candidates: FormMetadata[];
  // The rule(s) that required this form id in the first place -- doc
  // 07 section 13's "record the rule that caused each selection."
  sourceRuleIds: string[];
  requiresHumanReview: boolean;
}

/**
 * Pure: doc 07 sections 11-13. For every form id claimRules.ts (P6-4)
 * says is required for this jurisdiction/claimType/claimantType,
 * resolves it against the form catalog. Never silently picks between
 * multiple plausible catalog entries for the same form id -- that's
 * AMBIGUOUS_SELECTION, requiring human review, same discipline as
 * claimRuleConflict.ts (P6-5).
 */
export function selectFormsForClaim(
  jurisdiction: string,
  claimType: ClaimTypeKey,
  claimantType: ClaimantType | undefined,
  rules?: readonly ClaimRule[],
  catalog: readonly FormMetadata[] = FORM_CATALOG
): SelectedForm[] {
  const requirements = evaluateClaimRequirements(jurisdiction, claimType, claimantType, rules);
  const currentCatalog = latestFormVersionsOnly(catalog);

  return requirements.requiredFormIds.map((formId) => {
    const sourceRuleIds = requirements.appliedRules
      .filter((r) => r.outcome.requiredFormIds.includes(formId))
      .map((r) => r.id);

    const candidates = currentCatalog.filter(
      (f) =>
        f.formId === formId &&
        f.jurisdiction === jurisdiction &&
        f.claimType === claimType &&
        (f.claimantType == null || f.claimantType === claimantType)
    );

    if (candidates.length === 0) {
      return {
        formId,
        outcome: "MISSING_CATALOG_ENTRY",
        candidates: [],
        sourceRuleIds,
        requiresHumanReview: true,
      };
    }

    if (candidates.length > 1) {
      return {
        formId,
        outcome: "AMBIGUOUS_SELECTION",
        candidates,
        sourceRuleIds,
        requiresHumanReview: true,
      };
    }

    return {
      formId,
      outcome: "SELECTED",
      candidates,
      sourceRuleIds,
      requiresHumanReview: false,
    };
  });
}

function latestFormVersionsOnly(catalog: readonly FormMetadata[]): FormMetadata[] {
  const supersededIds = new Set(catalog.map((f) => f.supersedes).filter((id): id is string => Boolean(id)));
  return catalog.filter((f) => !supersededIds.has(f.id));
}
