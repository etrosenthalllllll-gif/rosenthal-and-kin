// Jurisdiction/claim rules engine -- doc 07 sections 4, 6. PLAN.md P6-4.
//
// "Create a rules engine that maps: Jurisdiction + Claim type +
// Claimant type -> Required documents, Required forms, Required
// signatures, Required declarations, Required exhibits. Rules must be
// versioned and structured (not hardcoded prose). Do not silently
// overwrite an old rule version when requirements change."
//
// Same versioned-and-sourced config-table discipline as
// complianceRules.ts (P2-1): rules are data, not switch statements, and
// a new version never replaces an old one in place -- it supersedes it
// via an explicit `supersedes` pointer, so a claim package prepared
// under an old rule set stays reproducible/auditable. Claim-type
// requirement content here is illustrative starting content pending
// real jurisdiction-specific legal sourcing, same status as
// claimTypes.ts (P6-2) and complianceRules.ts's own fee rules.

import type { ClaimTypeKey } from "./claimTypes";

// doc 07's own third dimension alongside jurisdiction/claim type.
// null/omitted on a rule means "applies regardless of claimant type."
export type ClaimantType = "INDIVIDUAL_HEIR" | "ESTATE_REPRESENTATIVE" | "ATTORNEY_IN_FACT" | "TRUSTEE";

export interface ClaimRuleOutcome {
  requiredDocumentTypes: readonly string[];
  requiredFormIds: readonly string[];
  requiredSignatures: readonly string[];
  requiredDeclarations: readonly string[];
  requiredExhibits: readonly string[];
}

export interface ClaimRule {
  id: string;
  version: number;
  jurisdiction: string;
  claimType: ClaimTypeKey;
  claimantType?: ClaimantType; // omitted = applies to every claimant type
  outcome: ClaimRuleOutcome;
  citation?: string;
  sourceUrl?: string;
  effectiveDate: string; // ISO date
  // The id of the rule this version replaces, so history is traceable
  // rather than lost -- never mutate an existing entry's outcome in
  // place once a claim package may have relied on it.
  supersedes?: string;
  reviewStatus: "VERIFIED_CITATION" | "NEEDS_ATTORNEY_REVIEW" | "EXAMPLE_PENDING_LEGAL_SOURCING";
  notes?: string;
}

// Seed table. Every EXAMPLE_PENDING_LEGAL_SOURCING entry needs real
// jurisdiction-specific legal sourcing before being relied on for an
// actual filing -- see claimTypes.ts's own header note.
export const CLAIM_RULES: readonly ClaimRule[] = [
  {
    id: "ca-unclaimed-property-individual-heir-v1",
    version: 1,
    jurisdiction: "CA",
    claimType: "UNCLAIMED_PROPERTY",
    claimantType: "INDIVIDUAL_HEIR",
    outcome: {
      requiredDocumentTypes: ["IDENTIFICATION", "BIRTH_CERTIFICATE", "DEATH_CERTIFICATE"],
      requiredFormIds: ["UNCLAIMED_PROPERTY_CLAIM_FORM"],
      requiredSignatures: ["CLAIMANT"],
      requiredDeclarations: ["CLAIMANT_DECLARATION"],
      requiredExhibits: ["DEATH_CERTIFICATE", "PROOF_OF_RELATIONSHIP", "IDENTIFICATION"],
    },
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
    notes: "Mirrors claimTypes.ts's UNCLAIMED_PROPERTY config for the individual-heir claimant type; see that file's header note on legal sourcing.",
  },
  {
    id: "ca-estate-claim-representative-v1",
    version: 1,
    jurisdiction: "CA",
    claimType: "ESTATE_CLAIM",
    claimantType: "ESTATE_REPRESENTATIVE",
    outcome: {
      requiredDocumentTypes: ["IDENTIFICATION", "DEATH_CERTIFICATE", "PROBATE_DOCUMENT", "LETTERS_OF_ADMINISTRATION"],
      requiredFormIds: ["ESTATE_CLAIM_FORM"],
      requiredSignatures: ["CLAIMANT", "ESTATE_REPRESENTATIVE"],
      requiredDeclarations: ["CLAIMANT_DECLARATION", "REPRESENTATIVE_AUTHORITY_DECLARATION"],
      requiredExhibits: ["DEATH_CERTIFICATE", "PROBATE_DOCUMENT", "LETTERS_OF_ADMINISTRATION", "IDENTIFICATION"],
    },
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
    notes: "An estate-representative claimant (doc 07 §6's own conditional example) needs proof of authority beyond what an individual heir needs -- letters of administration plus a distinct declaration.",
  },
] as const;

/**
 * Every rule id has at most one *current* version in the table at any
 * time in practice, but this resolves it defensively: for a given rule
 * lineage (an id chain linked by `supersedes`), returns only the
 * highest-version entry actually present, never a superseded one.
 */
export function latestVersionsOnly(rules: readonly ClaimRule[]): ClaimRule[] {
  const supersededIds = new Set(rules.map((r) => r.supersedes).filter((id): id is string => Boolean(id)));
  return rules.filter((r) => !supersededIds.has(r.id));
}

/**
 * doc 07 sections 4/6: rules matching jurisdiction + claim type, and
 * either matching the given claimant type exactly or applying to every
 * claimant type (no claimantType on the rule). Superseded versions are
 * excluded.
 */
export function getApplicableRules(
  jurisdiction: string,
  claimType: ClaimTypeKey,
  claimantType: ClaimantType | undefined,
  rules: readonly ClaimRule[] = CLAIM_RULES
): ClaimRule[] {
  return latestVersionsOnly(rules).filter(
    (r) =>
      r.jurisdiction === jurisdiction &&
      r.claimType === claimType &&
      (r.claimantType == null || r.claimantType === claimantType)
  );
}

export interface ClaimRequirementsResult {
  requiredDocumentTypes: string[];
  requiredFormIds: string[];
  requiredSignatures: string[];
  requiredDeclarations: string[];
  requiredExhibits: string[];
  // Every rule that contributed, so a requirement can always be traced
  // back to the rule that created it -- doc 07 §6's own requirement,
  // reused again by documentRequirementRules.ts (P6-6).
  appliedRules: ClaimRule[];
  // True when no rule matched at all -- the caller must not silently
  // treat "no rule" as "no requirements."
  noRuleFound: boolean;
}

/**
 * Unions every applicable rule's outcome (deduplicated) into one
 * requirements result, and reports if nothing matched at all.
 */
export function evaluateClaimRequirements(
  jurisdiction: string,
  claimType: ClaimTypeKey,
  claimantType: ClaimantType | undefined,
  rules: readonly ClaimRule[] = CLAIM_RULES
): ClaimRequirementsResult {
  const appliedRules = getApplicableRules(jurisdiction, claimType, claimantType, rules);

  const union = (key: keyof ClaimRuleOutcome): string[] =>
    Array.from(new Set(appliedRules.flatMap((r) => r.outcome[key])));

  return {
    requiredDocumentTypes: union("requiredDocumentTypes"),
    requiredFormIds: union("requiredFormIds"),
    requiredSignatures: union("requiredSignatures"),
    requiredDeclarations: union("requiredDeclarations"),
    requiredExhibits: union("requiredExhibits"),
    appliedRules,
    noRuleFound: appliedRules.length === 0,
  };
}
