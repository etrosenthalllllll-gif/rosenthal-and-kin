// Claim type configuration -- doc 07 section 2. PLAN.md P6-2.
//
// "Do not assume every case uses the same claim package. Create
// configurable ClaimType records... Each claim type should specify:
// Required information, Required documents, Potential forms, Required
// signatures, Required declarations, Required exhibits, Validation
// rules, Jurisdiction rules, Filing method, Review requirements. Do
// not hardcode these requirements into frontend code."
//
// Config-table pattern, same discipline as decisionTypes.ts/
// complianceRules.ts/communicationClassification.ts: the requirements
// live in one versioned table here, not scattered through UI
// components. The specific document/form/declaration lists below are
// illustrative starting content -- like complianceRules.ts's CA fee
// rule, the exact jurisdiction-specific requirements need real legal
// sourcing before being relied on for an actual filing (P6-4's rules
// engine is where that sourcing/versioning discipline lives); this
// table's job is the *shape* every claim type must specify, not a
// finished legal position.

export type ClaimTypeKey =
  | "UNCLAIMED_PROPERTY"
  | "ESTATE_CLAIM"
  | "PROBATE_RELATED"
  | "GOVERNMENT_HELD_PROPERTY"
  | "OTHER";

export type FilingMethod = "ONLINE_PORTAL" | "MAIL" | "IN_PERSON" | "ELECTRONIC_API" | "OTHER";

export interface ClaimTypeConfig {
  key: ClaimTypeKey;
  displayName: string;
  description: string;
  requiredInformation: readonly string[];
  requiredDocumentTypes: readonly string[];
  potentialFormIds: readonly string[];
  requiredSignatures: readonly string[];
  requiredDeclarations: readonly string[];
  requiredExhibits: readonly string[];
  filingMethod: FilingMethod;
  // doc 07 section 2's "Review requirements" -- whether this claim type
  // always needs a human look regardless of how clean the automated
  // checks come back, same shape as communicationClassification.ts's
  // alwaysRequiresHumanReview.
  alwaysRequiresReview: boolean;
}

// doc 07 section 2's own example list, verbatim, plus OTHER as an
// explicit fallback bucket -- never silently treated as
// UNCLAIMED_PROPERTY or any other configured type.
export const CLAIM_TYPES: Record<ClaimTypeKey, ClaimTypeConfig> = {
  UNCLAIMED_PROPERTY: {
    key: "UNCLAIMED_PROPERTY",
    displayName: "Unclaimed Property Claim",
    description: "A claim filed with a state controller/unclaimed-property agency for property held on behalf of the decedent.",
    requiredInformation: ["claimant_identity", "relationship_to_decedent", "decedent_identity"],
    requiredDocumentTypes: ["IDENTIFICATION", "BIRTH_CERTIFICATE", "DEATH_CERTIFICATE"],
    potentialFormIds: ["UNCLAIMED_PROPERTY_CLAIM_FORM"],
    requiredSignatures: ["CLAIMANT"],
    requiredDeclarations: ["CLAIMANT_DECLARATION"],
    requiredExhibits: ["DEATH_CERTIFICATE", "PROOF_OF_RELATIONSHIP", "IDENTIFICATION"],
    filingMethod: "ONLINE_PORTAL",
    alwaysRequiresReview: false,
  },
  ESTATE_CLAIM: {
    key: "ESTATE_CLAIM",
    displayName: "Estate Claim",
    description: "A claim made on behalf of, or against, an estate directly (not through an unclaimed-property agency).",
    requiredInformation: ["claimant_identity", "relationship_to_decedent", "estate_identity"],
    requiredDocumentTypes: ["IDENTIFICATION", "BIRTH_CERTIFICATE", "DEATH_CERTIFICATE", "PROBATE_DOCUMENT"],
    potentialFormIds: ["ESTATE_CLAIM_FORM"],
    requiredSignatures: ["CLAIMANT"],
    requiredDeclarations: ["CLAIMANT_DECLARATION"],
    requiredExhibits: ["DEATH_CERTIFICATE", "PROOF_OF_RELATIONSHIP", "PROBATE_DOCUMENT", "IDENTIFICATION"],
    filingMethod: "MAIL",
    alwaysRequiresReview: true, // estate claims interact with probate court -- always worth a human look
  },
  PROBATE_RELATED: {
    key: "PROBATE_RELATED",
    displayName: "Probate-Related Claim",
    description: "A claim tied to an active or closed probate proceeding.",
    requiredInformation: ["claimant_identity", "relationship_to_decedent", "probate_case_number"],
    requiredDocumentTypes: ["IDENTIFICATION", "BIRTH_CERTIFICATE", "DEATH_CERTIFICATE", "PROBATE_DOCUMENT", "COURT_DOCUMENT"],
    potentialFormIds: ["PROBATE_CLAIM_FORM"],
    requiredSignatures: ["CLAIMANT"],
    requiredDeclarations: ["CLAIMANT_DECLARATION"],
    requiredExhibits: ["DEATH_CERTIFICATE", "PROOF_OF_RELATIONSHIP", "PROBATE_DOCUMENT", "COURT_DOCUMENT"],
    filingMethod: "IN_PERSON",
    alwaysRequiresReview: true, // court filings always warrant review
  },
  GOVERNMENT_HELD_PROPERTY: {
    key: "GOVERNMENT_HELD_PROPERTY",
    displayName: "Government-Held Property Claim",
    description: "A claim against property held by a government agency other than a state's general unclaimed-property division.",
    requiredInformation: ["claimant_identity", "relationship_to_decedent", "holding_agency"],
    requiredDocumentTypes: ["IDENTIFICATION", "BIRTH_CERTIFICATE", "DEATH_CERTIFICATE"],
    potentialFormIds: ["AGENCY_CLAIM_FORM"],
    requiredSignatures: ["CLAIMANT"],
    requiredDeclarations: ["CLAIMANT_DECLARATION"],
    requiredExhibits: ["DEATH_CERTIFICATE", "PROOF_OF_RELATIONSHIP", "IDENTIFICATION"],
    filingMethod: "MAIL",
    alwaysRequiresReview: false,
  },
  OTHER: {
    key: "OTHER",
    displayName: "Other Configured Claim Type",
    description: "A claim type not yet fully configured -- always requires review rather than guessing requirements.",
    requiredInformation: [],
    requiredDocumentTypes: [],
    potentialFormIds: [],
    requiredSignatures: [],
    requiredDeclarations: [],
    requiredExhibits: [],
    filingMethod: "OTHER",
    alwaysRequiresReview: true,
  },
};

export function getClaimTypeConfig(key: string): ClaimTypeConfig | null {
  return (CLAIM_TYPES as Record<string, ClaimTypeConfig>)[key] ?? null;
}
