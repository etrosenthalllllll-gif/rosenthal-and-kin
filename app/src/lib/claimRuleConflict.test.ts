import { describe, it, expect } from "vitest";
import { detectRuleConflicts, hasScopeConflict } from "./claimRuleConflict";
import type { ClaimRule } from "./claimRules";

const baseOutcome = {
  requiredDocumentTypes: [],
  requiredFormIds: [],
  requiredSignatures: [],
  requiredDeclarations: [],
  requiredExhibits: [],
};

describe("claim rule conflict detection", () => {
  it("does not flag a single rule for a scope", () => {
    const rules: ClaimRule[] = [
      {
        id: "a",
        version: 1,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        outcome: baseOutcome,
        effectiveDate: "2026-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
    ];
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it("does not flag a general rule plus a claimant-type-specific rule as conflicting (additive, not disagreeing)", () => {
    const rules: ClaimRule[] = [
      {
        id: "general",
        version: 1,
        jurisdiction: "CA",
        claimType: "ESTATE_CLAIM",
        outcome: baseOutcome,
        effectiveDate: "2026-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
      {
        id: "rep-specific",
        version: 1,
        jurisdiction: "CA",
        claimType: "ESTATE_CLAIM",
        claimantType: "ESTATE_REPRESENTATIVE",
        outcome: baseOutcome,
        effectiveDate: "2026-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
    ];
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it("flags two current rules sharing the exact same scope as a conflict", () => {
    const rules: ClaimRule[] = [
      {
        id: "rule-x",
        version: 1,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        outcome: { ...baseOutcome, requiredFormIds: ["FORM_X"] },
        effectiveDate: "2026-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
      {
        id: "rule-y",
        version: 1,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        outcome: { ...baseOutcome, requiredFormIds: ["FORM_Y"] },
        effectiveDate: "2026-02-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
    ];
    const conflicts = detectRuleConflicts(rules);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].rules.map((r) => r.id).sort()).toEqual(["rule-x", "rule-y"]);
    expect(conflicts[0].requiresHumanReview).toBe(true);
  });

  it("does not flag a superseded rule and its replacement as conflicting", () => {
    const rules: ClaimRule[] = [
      {
        id: "old",
        version: 1,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        outcome: baseOutcome,
        effectiveDate: "2025-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
      {
        id: "new",
        version: 2,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        supersedes: "old",
        outcome: baseOutcome,
        effectiveDate: "2026-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
    ];
    expect(detectRuleConflicts(rules)).toEqual([]);
  });

  it("hasScopeConflict reports true only for the conflicting scope", () => {
    const rules: ClaimRule[] = [
      {
        id: "rule-x",
        version: 1,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        outcome: baseOutcome,
        effectiveDate: "2026-01-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
      {
        id: "rule-y",
        version: 1,
        jurisdiction: "CA",
        claimType: "UNCLAIMED_PROPERTY",
        outcome: baseOutcome,
        effectiveDate: "2026-02-01",
        reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
      },
    ];
    expect(hasScopeConflict("CA", "UNCLAIMED_PROPERTY", undefined, rules)).toBe(true);
    expect(hasScopeConflict("NV", "UNCLAIMED_PROPERTY", undefined, rules)).toBe(false);
  });
});
