import { describe, it, expect } from "vitest";
import {
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

  it("finds both fee-cap rules (probate estate and unclaimed property are separate regimes)", () => {
    const rules = getRulesByType("CA", "FEE_CAP");
    expect(rules.length).toBe(2);
    expect(rules.map((r) => r.assetSource).sort()).toEqual(
      ["PROBATE_ESTATE", "STATE_CONTROLLER_UNCLAIMED_PROPERTY"].sort()
    );
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
  it("blocks and escalates when no rule exists for the jurisdiction at all", () => {
    const result = checkFeeCompliance({
      jurisdiction: "NY",
      assetSource: "PROBATE_ESTATE",
      estimatedRecoveryCents: 10_000_00,
      proposedFeeCents: 1_000_00,
    });
    expect(result.action).toBe("BLOCK_AND_ESCALATE");
    expect(result.reason).toMatch(/no verified fee-cap rule/i);
  });

  it("blocks and escalates for CA probate estates, since CA has no fixed cap there (a confirmed conclusion, not a gap)", () => {
    const result = checkFeeCompliance({
      jurisdiction: "CA",
      assetSource: "PROBATE_ESTATE",
      estimatedRecoveryCents: 10_000_00,
      proposedFeeCents: 1_000_00,
    });
    expect(result.action).toBe("BLOCK_AND_ESCALATE");
    expect(result.reason).toMatch(/grossly unreasonable|case-by-case|court-review/i);
  });

  it("proceeds for CA unclaimed-property cases when the fee is within the verified 10% cap", () => {
    const result = checkFeeCompliance({
      jurisdiction: "CA",
      assetSource: "STATE_CONTROLLER_UNCLAIMED_PROPERTY",
      estimatedRecoveryCents: 10_000_00,
      proposedFeeCents: 1_000_00, // exactly 10%
    });
    expect(result.action).toBe("PROCEED");
  });

  it("blocks and escalates for CA unclaimed-property cases when the fee exceeds the 10% cap", () => {
    const result = checkFeeCompliance({
      jurisdiction: "CA",
      assetSource: "STATE_CONTROLLER_UNCLAIMED_PROPERTY",
      estimatedRecoveryCents: 10_000_00,
      proposedFeeCents: 1_500_00, // 15%
    });
    expect(result.action).toBe("BLOCK_AND_ESCALATE");
    expect(result.reason).toMatch(/15\.0%/);
    expect(result.reason).toMatch(/Civ\. Proc\. § 1582/);
  });

  it("blocks and escalates rather than dividing by zero when there's no estimated recovery", () => {
    const result = checkFeeCompliance({
      jurisdiction: "CA",
      assetSource: "STATE_CONTROLLER_UNCLAIMED_PROPERTY",
      estimatedRecoveryCents: 0,
      proposedFeeCents: 0,
    });
    expect(result.action).toBe("BLOCK_AND_ESCALATE");
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
