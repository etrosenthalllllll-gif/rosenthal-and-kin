import { describe, it, expect } from "vitest";
import {
  getApplicableRecoveryFeeRule,
  calculateRecoveryFee,
  validateBeforeInvoice,
  type RecoveryFeeRule,
  type FeeValidationInput,
} from "./recoveryFeeRules";

const RULES: readonly RecoveryFeeRule[] = [
  {
    id: "general-ca",
    version: 1,
    jurisdiction: "CA",
    structureType: "PERCENTAGE",
    percent: 20,
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "flat-fee-ca",
    version: 1,
    jurisdiction: "CA",
    claimType: "GOVERNMENT_HELD_PROPERTY",
    structureType: "FLAT",
    flatFeeCents: 5_000_00,
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "tiered-ca",
    version: 1,
    jurisdiction: "CA",
    claimType: "ESTATE_CLAIM",
    structureType: "TIERED",
    tiers: [
      { upToCents: 10_000_00, percent: 25 },
      { upToCents: null, percent: 15 },
    ],
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "other-ca",
    version: 1,
    jurisdiction: "CA",
    claimType: "OTHER",
    structureType: "OTHER",
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
];

describe("fee rule resolution", () => {
  it("prefers a claim-type-specific rule over a general one", () => {
    const resolution = getApplicableRecoveryFeeRule("CA", "GOVERNMENT_HELD_PROPERTY", RULES);
    expect(resolution.rule?.id).toBe("flat-fee-ca");
  });

  it("falls back to the general rule when no claim-type-specific rule exists", () => {
    const resolution = getApplicableRecoveryFeeRule("CA", "UNCLAIMED_PROPERTY", RULES);
    expect(resolution.rule?.id).toBe("general-ca");
  });
});

describe("fee calculation by structure", () => {
  it("calculates a percentage fee", () => {
    const result = calculateRecoveryFee("CA", "UNCLAIMED_PROPERTY", 25_000_00, "t1", RULES);
    expect(result.status).toBe("CALCULATED");
    expect(result.feeCents).toBe(5_000_00); // 20% of $25,000
    expect(result.ruleId).toBe("general-ca");
  });

  it("calculates a flat fee", () => {
    const result = calculateRecoveryFee("CA", "GOVERNMENT_HELD_PROPERTY", 25_000_00, "t1", RULES);
    expect(result.feeCents).toBe(5_000_00);
  });

  it("calculates a tiered fee across tier boundaries", () => {
    const result = calculateRecoveryFee("CA", "ESTATE_CLAIM", 15_000_00, "t1", RULES);
    // first $10,000 at 25% = $2,500; remaining $5,000 at 15% = $750; total $3,250
    expect(result.feeCents).toBe(3_250_00);
  });

  it("fails to UNSUPPORTED_STRUCTURE for OTHER rather than guessing a calculation", () => {
    const result = calculateRecoveryFee("CA", "OTHER", 25_000_00, "t1", RULES);
    expect(result.status).toBe("UNSUPPORTED_STRUCTURE");
    expect(result.feeCents).toBe(0);
  });

  it("returns NO_RULE_FOUND for an unconfigured jurisdiction", () => {
    const result = calculateRecoveryFee("NV", "UNCLAIMED_PROPERTY", 25_000_00, "t1", RULES);
    expect(result.status).toBe("NO_RULE_FOUND");
  });
});

describe("pre-invoice validation", () => {
  function input(overrides: Partial<FeeValidationInput> = {}): FeeValidationInput {
    return {
      recoveryAmountKnown: true,
      applicableFeeRuleFound: true,
      priorPaymentsReconciled: true,
      priorInvoicesReconciled: true,
      creditsAndAdjustmentsReconciled: true,
      ...overrides,
    };
  }

  it("passes when every check clears", () => {
    expect(validateBeforeInvoice(input()).outcome).toBe("PASS");
  });

  it("requires review when the recovery amount isn't known yet", () => {
    const result = validateBeforeInvoice(input({ recoveryAmountKnown: false }));
    expect(result.outcome).toBe("REVIEW_REQUIRED");
    expect(result.unmetChecks.length).toBeGreaterThan(0);
  });
});
