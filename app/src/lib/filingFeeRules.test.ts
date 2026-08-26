import { describe, it, expect } from "vitest";
import { getApplicableFeeRule, calculateFilingFee, type FilingFeeRule } from "./filingFeeRules";

const RULES: readonly FilingFeeRule[] = [
  {
    id: "general-ca",
    version: 1,
    jurisdiction: "CA",
    baseFeeCents: 1000,
    additionalFeeCents: 0,
    providerFeeCents: 0,
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "portal-specific-ca",
    version: 1,
    jurisdiction: "CA",
    filingMethod: "ONLINE_PORTAL",
    baseFeeCents: 500,
    additionalFeeCents: 100,
    providerFeeCents: 50,
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "old-portal-ca",
    version: 1,
    jurisdiction: "CA",
    filingMethod: "SECURE_UPLOAD",
    baseFeeCents: 200,
    additionalFeeCents: 0,
    providerFeeCents: 0,
    effectiveDate: "2025-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
  {
    id: "new-portal-ca",
    version: 2,
    jurisdiction: "CA",
    filingMethod: "SECURE_UPLOAD",
    supersedes: "old-portal-ca",
    baseFeeCents: 300,
    additionalFeeCents: 0,
    providerFeeCents: 0,
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
];

describe("fee rule resolution", () => {
  it("prefers a method-specific rule over a general one", () => {
    const resolution = getApplicableFeeRule("CA", "ONLINE_PORTAL", RULES);
    expect(resolution.rule?.id).toBe("portal-specific-ca");
  });

  it("falls back to the general rule when no method-specific rule exists", () => {
    const resolution = getApplicableFeeRule("CA", "EMAIL_SUBMISSION", RULES);
    expect(resolution.rule?.id).toBe("general-ca");
  });

  it("excludes a superseded method-specific rule version", () => {
    const resolution = getApplicableFeeRule("CA", "SECURE_UPLOAD", RULES);
    expect(resolution.rule?.id).toBe("new-portal-ca");
  });

  it("returns null with no candidates when nothing matches at all", () => {
    const resolution = getApplicableFeeRule("NV", "ONLINE_PORTAL", RULES);
    expect(resolution.rule).toBeNull();
    expect(resolution.ambiguous).toBe(false);
  });
});

describe("fee calculation", () => {
  it("calculates base + additional + provider = total and names the exact rule used", () => {
    const result = calculateFilingFee("CA", "ONLINE_PORTAL", "2026-08-26T00:00:00.000Z", RULES);
    expect(result.status).toBe("CALCULATED");
    expect(result.totalFeeCents).toBe(650);
    expect(result.ruleId).toBe("portal-specific-ca");
    expect(result.ruleVersion).toBe(1);
    expect(result.timestamp).toBe("2026-08-26T00:00:00.000Z");
  });

  it("returns NO_RULE_FOUND with a zero total rather than guessing a fee", () => {
    const result = calculateFilingFee("NV", "ONLINE_PORTAL", "t1", RULES);
    expect(result.status).toBe("NO_RULE_FOUND");
    expect(result.totalFeeCents).toBe(0);
  });

  it("returns AMBIGUOUS_RULE with a zero total when two equally-specific rules match", () => {
    const ambiguousRules: FilingFeeRule[] = [
      { ...RULES[1], id: "dup-1" },
      { ...RULES[1], id: "dup-2" },
    ];
    const result = calculateFilingFee("CA", "ONLINE_PORTAL", "t1", ambiguousRules);
    expect(result.status).toBe("AMBIGUOUS_RULE");
    expect(result.totalFeeCents).toBe(0);
    expect(result.candidates).toHaveLength(2);
  });
});
