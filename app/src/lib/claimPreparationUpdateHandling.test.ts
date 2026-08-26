import { describe, it, expect } from "vitest";
import {
  detectJurisdictionChange,
  detectRuleVersionDrift,
  detectFormVersionDrift,
  requiresNewPreparationVersion,
} from "./claimPreparationUpdateHandling";
import type { ClaimRule } from "./claimRules";
import type { FormMetadata } from "./formCatalog";

describe("jurisdiction change handling", () => {
  it("returns null when the jurisdiction is unchanged", () => {
    expect(detectJurisdictionChange("CA", "CA")).toBeNull();
  });

  it("flags a jurisdiction change with no KEEP_CURRENT option", () => {
    const alert = detectJurisdictionChange("CA", "NV");
    expect(alert?.triggerType).toBe("JURISDICTION_CHANGED");
    expect(alert?.availableChoices).not.toContain("KEEP_CURRENT");
    expect(alert?.availableChoices).toContain("REGENERATE");
  });
});

describe("rule version drift", () => {
  const rules: ClaimRule[] = [
    {
      id: "old-rule",
      version: 1,
      jurisdiction: "CA",
      claimType: "UNCLAIMED_PROPERTY",
      outcome: { requiredDocumentTypes: [], requiredFormIds: [], requiredSignatures: [], requiredDeclarations: [], requiredExhibits: [] },
      effectiveDate: "2025-01-01",
      reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
    },
    {
      id: "new-rule",
      version: 2,
      jurisdiction: "CA",
      claimType: "UNCLAIMED_PROPERTY",
      supersedes: "old-rule",
      outcome: { requiredDocumentTypes: [], requiredFormIds: [], requiredSignatures: [], requiredDeclarations: [], requiredExhibits: [] },
      effectiveDate: "2026-01-01",
      reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
    },
  ];

  it("returns null when every used rule is still current", () => {
    expect(detectRuleVersionDrift(["new-rule"], rules)).toBeNull();
  });

  it("flags a used rule that has since been superseded, never silently swapping in the new one", () => {
    const alert = detectRuleVersionDrift(["old-rule"], rules);
    expect(alert?.triggerType).toBe("RULE_VERSION_CHANGED");
    expect(alert?.affectedIds).toEqual(["old-rule"]);
    expect(alert?.availableChoices).toContain("KEEP_CURRENT");
    expect(alert?.availableChoices).toContain("REGENERATE");
    expect(alert?.availableChoices).toContain("REVIEW");
  });
});

describe("form version drift", () => {
  const catalog: FormMetadata[] = [
    {
      id: "old-form",
      formId: "FORM_A",
      version: 1,
      displayName: "Form A v1",
      jurisdiction: "CA",
      claimType: "UNCLAIMED_PROPERTY",
      description: "",
      status: "EXAMPLE_PENDING_LEGAL_SOURCING",
    },
    {
      id: "new-form",
      formId: "FORM_A",
      version: 2,
      supersedes: "old-form",
      displayName: "Form A v2",
      jurisdiction: "CA",
      claimType: "UNCLAIMED_PROPERTY",
      description: "",
      status: "EXAMPLE_PENDING_LEGAL_SOURCING",
    },
  ];

  it("returns null when every used form catalog entry is still current", () => {
    expect(detectFormVersionDrift(["new-form"], catalog)).toBeNull();
  });

  it("flags a used form catalog entry that has since been superseded", () => {
    const alert = detectFormVersionDrift(["old-form"], catalog);
    expect(alert?.triggerType).toBe("FORM_VERSION_CHANGED");
    expect(alert?.affectedIds).toEqual(["old-form"]);
  });
});

describe("requiresNewPreparationVersion", () => {
  it("is true when a jurisdiction-change alert is present", () => {
    const alert = detectJurisdictionChange("CA", "NV")!;
    expect(requiresNewPreparationVersion([alert])).toBe(true);
  });

  it("is false for rule/form drift alone -- those can be regenerated within the same preparation", () => {
    const ruleAlert = detectRuleVersionDrift(["old-rule"], [
      {
        id: "old-rule",
        version: 1,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        outcome: { requiredDocumentTypes: [], requiredFormIds: [], requiredSignatures: [], requiredDeclarations: [], requiredExhibits: [] },
        effectiveDate: "2025-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
      {
        id: "new-rule",
        version: 2,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        supersedes: "old-rule",
        outcome: { requiredDocumentTypes: [], requiredFormIds: [], requiredSignatures: [], requiredDeclarations: [], requiredExhibits: [] },
        effectiveDate: "2026-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
    ])!;
    expect(requiresNewPreparationVersion([ruleAlert])).toBe(false);
  });
});
