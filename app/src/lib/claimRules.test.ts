import { describe, it, expect } from "vitest";
import { getApplicableRules, evaluateClaimRequirements, type ClaimRule } from "./claimRules";

const RULES: readonly ClaimRule[] = [
  {
    id: "test-ca-unclaimed-v1",
    version: 1,
    jurisdiction: "CA",
    claimType: "UNCLAIMED_PROPERTY",
    outcome: {
      requiredDocumentTypes: ["IDENTIFICATION"],
      requiredFormIds: ["FORM_A"],
      requiredSignatures: ["CLAIMANT"],
      requiredDeclarations: ["CLAIMANT_DECLARATION"],
      requiredExhibits: ["IDENTIFICATION"],
    },
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "test-ca-unclaimed-v1-old",
    version: 1,
    jurisdiction: "CA",
    claimType: "UNCLAIMED_PROPERTY",
    outcome: {
      requiredDocumentTypes: ["OLD_DOC"],
      requiredFormIds: [],
      requiredSignatures: [],
      requiredDeclarations: [],
      requiredExhibits: [],
    },
    effectiveDate: "2025-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "test-ca-unclaimed-v2",
    version: 2,
    jurisdiction: "CA",
    claimType: "UNCLAIMED_PROPERTY",
    supersedes: "test-ca-unclaimed-v1-old",
    outcome: {
      requiredDocumentTypes: ["NEW_DOC"],
      requiredFormIds: [],
      requiredSignatures: [],
      requiredDeclarations: [],
      requiredExhibits: [],
    },
    effectiveDate: "2026-06-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "test-ca-estate-rep-only",
    version: 1,
    jurisdiction: "CA",
    claimType: "ESTATE_CLAIM",
    claimantType: "ESTATE_REPRESENTATIVE",
    outcome: {
      requiredDocumentTypes: ["LETTERS_OF_ADMINISTRATION"],
      requiredFormIds: [],
      requiredSignatures: [],
      requiredDeclarations: [],
      requiredExhibits: [],
    },
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
];

describe("claim rules engine", () => {
  it("matches rules by jurisdiction and claim type", () => {
    const rules = getApplicableRules("CA", "UNCLAIMED_PROPERTY", undefined, RULES);
    expect(rules.map((r) => r.id)).toContain("test-ca-unclaimed-v1");
  });

  it("excludes a superseded rule version", () => {
    const rules = getApplicableRules("CA", "UNCLAIMED_PROPERTY", undefined, RULES);
    expect(rules.some((r) => r.id === "test-ca-unclaimed-v1-old")).toBe(false);
    expect(rules.some((r) => r.id === "test-ca-unclaimed-v2")).toBe(true);
  });

  it("a claimant-type-scoped rule only applies to that claimant type", () => {
    const repRules = getApplicableRules("CA", "ESTATE_CLAIM", "ESTATE_REPRESENTATIVE", RULES);
    expect(repRules.some((r) => r.id === "test-ca-estate-rep-only")).toBe(true);

    const heirRules = getApplicableRules("CA", "ESTATE_CLAIM", "INDIVIDUAL_HEIR", RULES);
    expect(heirRules.some((r) => r.id === "test-ca-estate-rep-only")).toBe(false);
  });

  it("evaluateClaimRequirements unions outcomes from every applied rule", () => {
    const result = evaluateClaimRequirements("CA", "UNCLAIMED_PROPERTY", undefined, RULES);
    expect(result.requiredDocumentTypes).toEqual(expect.arrayContaining(["IDENTIFICATION", "NEW_DOC"]));
    expect(result.requiredDocumentTypes).not.toContain("OLD_DOC");
    expect(result.noRuleFound).toBe(false);
    expect(result.appliedRules.length).toBeGreaterThanOrEqual(2);
  });

  it("reports noRuleFound when nothing matches, rather than an empty-but-satisfied result", () => {
    const result = evaluateClaimRequirements("NV", "OTHER", undefined, RULES);
    expect(result.noRuleFound).toBe(true);
    expect(result.requiredDocumentTypes).toEqual([]);
  });

  it("every requirement traces back to the rule that created it via appliedRules", () => {
    const result = evaluateClaimRequirements("CA", "ESTATE_CLAIM", "ESTATE_REPRESENTATIVE", RULES);
    const rule = result.appliedRules.find((r) => r.id === "test-ca-estate-rep-only");
    expect(rule).toBeDefined();
    expect(result.requiredDocumentTypes).toContain("LETTERS_OF_ADMINISTRATION");
  });
});
