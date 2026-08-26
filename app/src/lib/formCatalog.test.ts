import { describe, it, expect } from "vitest";
import { selectFormsForClaim, type FormMetadata } from "./formCatalog";
import type { ClaimRule } from "./claimRules";

const RULES: readonly ClaimRule[] = [
  {
    id: "rule-1",
    version: 1,
    jurisdiction: "CA",
    claimType: "UNCLAIMED_PROPERTY",
    outcome: {
      requiredDocumentTypes: [],
      requiredFormIds: ["FORM_A"],
      requiredSignatures: [],
      requiredDeclarations: [],
      requiredExhibits: [],
    },
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
];

const baseForm: Omit<FormMetadata, "id" | "supersedes"> = {
  formId: "FORM_A",
  version: 1,
  displayName: "Form A",
  jurisdiction: "CA",
  claimType: "UNCLAIMED_PROPERTY",
  description: "test",
  status: "EXAMPLE_PENDING_LEGAL_SOURCING",
};

describe("form catalog + selection", () => {
  it("selects the single matching catalog entry for a required form", () => {
    const catalog: FormMetadata[] = [{ ...baseForm, id: "form-a-v1" }];
    const result = selectFormsForClaim("CA", "UNCLAIMED_PROPERTY", undefined, RULES, catalog);
    expect(result).toHaveLength(1);
    expect(result[0].outcome).toBe("SELECTED");
    expect(result[0].candidates[0].id).toBe("form-a-v1");
  });

  it("records the rule that caused the selection", () => {
    const catalog: FormMetadata[] = [{ ...baseForm, id: "form-a-v1" }];
    const result = selectFormsForClaim("CA", "UNCLAIMED_PROPERTY", undefined, RULES, catalog);
    expect(result[0].sourceRuleIds).toContain("rule-1");
  });

  it("flags MISSING_CATALOG_ENTRY when no catalog entry exists for a required form id", () => {
    const result = selectFormsForClaim("CA", "UNCLAIMED_PROPERTY", undefined, RULES, []);
    expect(result[0].outcome).toBe("MISSING_CATALOG_ENTRY");
    expect(result[0].requiresHumanReview).toBe(true);
  });

  it("flags AMBIGUOUS_SELECTION rather than guessing when two current catalog entries match", () => {
    const catalog: FormMetadata[] = [
      { ...baseForm, id: "form-a-v1" },
      { ...baseForm, id: "form-a-v1-alt", displayName: "Form A (alternate)" },
    ];
    const result = selectFormsForClaim("CA", "UNCLAIMED_PROPERTY", undefined, RULES, catalog);
    expect(result[0].outcome).toBe("AMBIGUOUS_SELECTION");
    expect(result[0].candidates).toHaveLength(2);
    expect(result[0].requiresHumanReview).toBe(true);
  });

  it("excludes a superseded catalog entry from selection", () => {
    const catalog: FormMetadata[] = [
      { ...baseForm, id: "form-a-v1" },
      { ...baseForm, id: "form-a-v2", supersedes: "form-a-v1", version: 2 },
    ];
    const result = selectFormsForClaim("CA", "UNCLAIMED_PROPERTY", undefined, RULES, catalog);
    expect(result[0].outcome).toBe("SELECTED");
    expect(result[0].candidates[0].id).toBe("form-a-v2");
  });
});
