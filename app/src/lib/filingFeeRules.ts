// Fee calculation engine + fee rule versioning -- doc 08 sections 21-23.
// PLAN.md P7-9.
//
// "Build a configurable fee engine. Fees may depend on jurisdiction,
// claim type, claim amount, filing method, number of submissions, other
// configured conditions. Return base fee + additional fees + provider
// fee = total. Every fee calculation must include rule/version,
// timestamp, inputs, calculation result. Fee rules must be versioned;
// never overwrite historical fee calculations."
//
// Same versioned-rule-table + supersedes-chain discipline as
// claimRules.ts (P6-4)/complianceRules.ts (P2-1); a fee calculation
// result always names the exact rule/version that produced it, so a
// later rule change never retroactively (or silently) changes what an
// already-calculated fee claims to be based on -- same reasoning as
// engagementAgreement.ts's rulesUsed field.

export interface FilingFeeRule {
  id: string;
  version: number;
  jurisdiction: string;
  // Omitted = applies regardless of filing method; a method-specific
  // rule always takes precedence over a general one for the same
  // jurisdiction (see getApplicableFeeRule).
  filingMethod?: string;
  baseFeeCents: number;
  additionalFeeCents: number;
  providerFeeCents: number;
  effectiveDate: string; // ISO date
  supersedes?: string; // another rule's id
  citation?: string;
  sourceUrl?: string;
  reviewStatus: "VERIFIED_CITATION" | "NEEDS_ATTORNEY_REVIEW" | "EXAMPLE_PENDING_LEGAL_SOURCING";
}

// Seed table. Every EXAMPLE_PENDING_LEGAL_SOURCING entry needs real
// jurisdiction-specific fee-schedule sourcing before being relied on
// for an actual filing, same status as claimRules.ts's own seed table.
export const FILING_FEE_RULES: readonly FilingFeeRule[] = [
  {
    id: "ca-unclaimed-property-online-portal-v1",
    version: 1,
    jurisdiction: "CA",
    filingMethod: "ONLINE_PORTAL",
    baseFeeCents: 0,
    additionalFeeCents: 0,
    providerFeeCents: 0,
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
] as const;

export function latestFeeRuleVersionsOnly(rules: readonly FilingFeeRule[]): FilingFeeRule[] {
  const supersededIds = new Set(rules.map((r) => r.supersedes).filter((id): id is string => Boolean(id)));
  return rules.filter((r) => !supersededIds.has(r.id));
}

export interface FeeRuleResolution {
  rule: FilingFeeRule | null;
  ambiguous: boolean;
  candidates: FilingFeeRule[];
}

/**
 * Pure: doc 08 sections 21-22. A method-specific current rule always
 * wins over a general (no-filingMethod) rule for the same
 * jurisdiction; two equally-specific current rules matching is
 * AMBIGUOUS -- never auto-picked, same never-guess discipline as
 * claimRuleConflict.ts (P6-5).
 */
export function getApplicableFeeRule(
  jurisdiction: string,
  filingMethod: string,
  rules: readonly FilingFeeRule[] = FILING_FEE_RULES
): FeeRuleResolution {
  const current = latestFeeRuleVersionsOnly(rules).filter((r) => r.jurisdiction === jurisdiction);

  const specific = current.filter((r) => r.filingMethod === filingMethod);
  if (specific.length === 1) return { rule: specific[0], ambiguous: false, candidates: [] };
  if (specific.length > 1) return { rule: null, ambiguous: true, candidates: specific };

  const general = current.filter((r) => r.filingMethod == null);
  if (general.length === 1) return { rule: general[0], ambiguous: false, candidates: [] };
  if (general.length > 1) return { rule: null, ambiguous: true, candidates: general };

  return { rule: null, ambiguous: false, candidates: [] };
}

export type FeeCalculationStatus = "CALCULATED" | "NO_RULE_FOUND" | "AMBIGUOUS_RULE";

export interface FeeCalculationResult {
  status: FeeCalculationStatus;
  baseFeeCents: number;
  additionalFeeCents: number;
  providerFeeCents: number;
  totalFeeCents: number;
  ruleId: string | null;
  ruleVersion: number | null;
  candidates: FilingFeeRule[];
  timestamp: string;
}

/**
 * Pure: doc 08 sections 21-23. Resolves the applicable rule and
 * returns base + additional + provider fee = total, always naming the
 * exact rule/version used and the caller-supplied timestamp -- never
 * just a bare number. NO_RULE_FOUND/AMBIGUOUS_RULE both return a zero
 * total rather than guessing a fee, since neither case has a safe
 * number to fall back to.
 */
export function calculateFilingFee(
  jurisdiction: string,
  filingMethod: string,
  timestamp: string,
  rules: readonly FilingFeeRule[] = FILING_FEE_RULES
): FeeCalculationResult {
  const resolution = getApplicableFeeRule(jurisdiction, filingMethod, rules);

  if (resolution.ambiguous) {
    return {
      status: "AMBIGUOUS_RULE",
      baseFeeCents: 0,
      additionalFeeCents: 0,
      providerFeeCents: 0,
      totalFeeCents: 0,
      ruleId: null,
      ruleVersion: null,
      candidates: resolution.candidates,
      timestamp,
    };
  }

  if (!resolution.rule) {
    return {
      status: "NO_RULE_FOUND",
      baseFeeCents: 0,
      additionalFeeCents: 0,
      providerFeeCents: 0,
      totalFeeCents: 0,
      ruleId: null,
      ruleVersion: null,
      candidates: [],
      timestamp,
    };
  }

  const rule = resolution.rule;
  return {
    status: "CALCULATED",
    baseFeeCents: rule.baseFeeCents,
    additionalFeeCents: rule.additionalFeeCents,
    providerFeeCents: rule.providerFeeCents,
    totalFeeCents: rule.baseFeeCents + rule.additionalFeeCents + rule.providerFeeCents,
    ruleId: rule.id,
    ruleVersion: rule.version,
    candidates: [],
    timestamp,
  };
}
