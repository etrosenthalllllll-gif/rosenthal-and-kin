import { describe, it, expect } from "vitest";
import {
  COMPLIANCE_RULES,
  getRulesForJurisdiction,
  getRulesByType,
  isRuleStale,
  checkFeeCompliance,
  scanForLegalAdviceLanguage,
  type ComplianceRule,
} from "./complianceRules";

describe("getRulesForJurisdiction", () => {
  it("returns only rules for the requested jurisdiction", () => {
    const rules = getRulesForJurisdiction("CA");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r.jurisdiction === "CA")).toBe(true);
  });

  it("returns an empty array for a jurisdiction with no rules on file", () => {
    expect(getRulesForJurisdiction("NY")).toEqual([]);
  });
});

describe("getRulesByType", () => {
  it("filters by jurisdiction and rule type together", () => {
    const rules = getRulesByType("CA", "UPL_BOUNDARY");
    expect(rules.length).toBe(2);
    expect(rules.every((r) => r.ruleType === "UPL_BOUNDARY")).toBe(true);
  });
});

describe("isRuleStale", () => {
  const baseRule: ComplianceRule = {
    id: "test-rule",
    jurisdiction: "CA",
    ruleType: "UPL_BOUNDARY",
    summary: "test",
    citation: "test",
    sourceUrl: "https://example.com",
    effectiveDate: "2020-01-01",
    lastReviewedDate: "2025-01-01",
    reviewedBy: "test",
    reviewStatus: "VERIFIED_CITATION",
  };

  it("is not stale just before the 12-month threshold", () => {
    expect(isRuleStale(baseRule, new Date("2025-12-31"))).toBe(false);
  });

  it("is stale at exactly the 12-month threshold", () => {
    expect(isRuleStale(baseRule, new Date("2026-01-01"))).toBe(true);
  });

  it("respects a custom staleness threshold", () => {
    expect(isRuleStale(baseRule, new Date("2025-04-01"), 3)).toBe(true);
  });
});

describe("checkFeeCompliance", () => {
  it("blocks and escalates when no verified fee-cap rule exists for the jurisdiction", () => {
    const result = checkFeeCompliance({
      jurisdiction: "NY",
      estimatedRecoveryCents: 10_000_00,
      proposedFeeCents: 1_000_00,
    });
    expect(result.action).toBe("BLOCK_AND_ESCALATE");
    expect(result.reason).toMatch(/no attorney-verified fee-cap rule/i);
  });

  it("blocks and escalates for CA too, since its fee-cap rule is not yet attorney-verified", () => {
    const result = checkFeeCompliance({
      jurisdiction: "CA",
      estimatedRecoveryCents: 10_000_00,
      proposedFeeCents: 1_000_00,
    });
    expect(result.action).toBe("BLOCK_AND_ESCALATE");
  });

  it("never returns PROCEED against the real seed table (documents the intended fail-closed default)", () => {
    for (const jurisdiction of new Set(COMPLIANCE_RULES.map((r) => r.jurisdiction))) {
      const result = checkFeeCompliance({
        jurisdiction,
        estimatedRecoveryCents: 100_00,
        proposedFeeCents: 10_00,
      });
      expect(result.action).toBe("BLOCK_AND_ESCALATE");
    }
  });
});

describe("scanForLegalAdviceLanguage", () => {
  it("flags a direct entitlement claim", () => {
    const result = scanForLegalAdviceLanguage("You are entitled to $50,000 from this estate.");
    expect(result.flagged).toBe(true);
  });

  it("flags a guarantee of recovery", () => {
    const result = scanForLegalAdviceLanguage("We guarantee your recovery within 90 days.");
    expect(result.flagged).toBe(true);
  });

  it("flags text labeled as legal advice", () => {
    const result = scanForLegalAdviceLanguage("Here is some legal advice about your case.");
    expect(result.flagged).toBe(true);
  });

  it("does not flag a plain status update", () => {
    const result = scanForLegalAdviceLanguage(
      "We received your birth certificate and are reviewing it as part of the verification step."
    );
    expect(result.flagged).toBe(false);
  });

  it("reports which patterns matched", () => {
    const result = scanForLegalAdviceLanguage("You will win this case, guaranteed.");
    expect(result.matchedPatterns.length).toBeGreaterThan(0);
  });
});
