// Fee engine (recovery-side) + fee rule versioning + validation -- doc
// 10 sections 17-20. PLAN.md P9-6.
//
// "Build a fee calculation engine. Support configured fee structures:
// percentage-based, flat fee, tiered fee, fixed administrative fee,
// other configured structures. The system must not assume a
// particular fee structure. Each fee calculation must preserve: fee
// rule, rule version, rate, base amount, calculation, result, effective
// date, source. Fee rules must be versioned; historical cases must
// preserve the rule version used. Before invoice generation, validate:
// recovery amount, applicable fee rule, fee percentage/rate, flat
// fees, authorized deductions, prior payments/invoices/credits/
// adjustments -- output PASS or REVIEW_REQUIRED."
//
// Same versioned-rule-table + supersedes-chain discipline as
// claimRules.ts (P6-4)/filingFeeRules.ts (P7-9) -- distinct from that
// filing-fee engine (a different fee, charged at a different trigger
// point: filing submission vs. recovery distribution), but reusing the
// identical versioned-rule-table shape rather than inventing a new
// one.

export type FeeStructureType = "PERCENTAGE" | "FLAT" | "TIERED" | "FIXED_ADMIN" | "OTHER";

export interface FeeTier {
  // This tier applies to the portion of the recovery up to (and
  // including) this amount; null means "no upper bound" (the final
  // tier).
  upToCents: number | null;
  percent: number;
}

export interface RecoveryFeeRule {
  id: string;
  version: number;
  jurisdiction: string;
  claimType?: string;
  structureType: FeeStructureType;
  percent?: number; // PERCENTAGE
  flatFeeCents?: number; // FLAT / FIXED_ADMIN
  tiers?: readonly FeeTier[]; // TIERED, ascending by upToCents
  effectiveDate: string;
  supersedes?: string;
  citation?: string;
  reviewStatus: "VERIFIED_CITATION" | "NEEDS_ATTORNEY_REVIEW" | "EXAMPLE_PENDING_LEGAL_SOURCING";
}

// Seed table. Every EXAMPLE_PENDING_LEGAL_SOURCING entry needs real
// jurisdiction-specific fee-schedule sourcing before being relied on
// for an actual case, same status as filingFeeRules.ts's own table.
export const RECOVERY_FEE_RULES: readonly RecoveryFeeRule[] = [
  {
    id: "ca-standard-percentage-v1",
    version: 1,
    jurisdiction: "CA",
    structureType: "PERCENTAGE",
    percent: 20,
    effectiveDate: "2026-01-01",
    reviewStatus: "EXAMPLE_PENDING_LEGAL_SOURCING",
  },
] as const;

export function latestRecoveryFeeRuleVersionsOnly(rules: readonly RecoveryFeeRule[]): RecoveryFeeRule[] {
  const supersededIds = new Set(rules.map((r) => r.supersedes).filter((id): id is string => Boolean(id)));
  return rules.filter((r) => !supersededIds.has(r.id));
}

export interface RecoveryFeeRuleResolution {
  rule: RecoveryFeeRule | null;
  ambiguous: boolean;
  candidates: RecoveryFeeRule[];
}

/**
 * Pure: a claim-type-specific current rule wins over a general one for
 * the same jurisdiction; two equally-specific current rules matching
 * is AMBIGUOUS, never auto-picked -- same shape as
 * filingFeeRules.ts's getApplicableFeeRule().
 */
export function getApplicableRecoveryFeeRule(
  jurisdiction: string,
  claimType: string | undefined,
  rules: readonly RecoveryFeeRule[] = RECOVERY_FEE_RULES
): RecoveryFeeRuleResolution {
  const current = latestRecoveryFeeRuleVersionsOnly(rules).filter((r) => r.jurisdiction === jurisdiction);

  const specific = current.filter((r) => r.claimType === claimType);
  if (specific.length === 1) return { rule: specific[0], ambiguous: false, candidates: [] };
  if (specific.length > 1) return { rule: null, ambiguous: true, candidates: specific };

  const general = current.filter((r) => r.claimType == null);
  if (general.length === 1) return { rule: general[0], ambiguous: false, candidates: [] };
  if (general.length > 1) return { rule: null, ambiguous: true, candidates: general };

  return { rule: null, ambiguous: false, candidates: [] };
}

export type FeeCalculationStatus = "CALCULATED" | "NO_RULE_FOUND" | "AMBIGUOUS_RULE" | "UNSUPPORTED_STRUCTURE";

export interface RecoveryFeeCalculationResult {
  status: FeeCalculationStatus;
  feeCents: number;
  ruleId: string | null;
  ruleVersion: number | null;
  structureType: FeeStructureType | null;
  baseAmountCents: number;
  candidates: RecoveryFeeRule[];
  timestamp: string;
}

function calculateTieredFee(grossCents: number, tiers: readonly FeeTier[]): number {
  let remaining = grossCents;
  let lowerBound = 0;
  let feeCents = 0;

  for (const tier of tiers) {
    const tierCeiling = tier.upToCents ?? Infinity;
    const tierWidth = Math.max(0, Math.min(remaining, tierCeiling - lowerBound));
    feeCents += tierWidth * (tier.percent / 100);
    remaining -= tierWidth;
    lowerBound = tierCeiling;
    if (remaining <= 0) break;
  }

  return Math.round(feeCents);
}

/**
 * Pure: doc 10 sections 17-19. Resolves the applicable rule and
 * computes the fee per its structure type -- OTHER always fails to
 * UNSUPPORTED_STRUCTURE rather than guessing a calculation for a
 * structure this engine doesn't know how to compute, since "the system
 * must not assume a particular fee structure" cuts both ways: it must
 * support the configured ones, and it must not invent behavior for an
 * unconfigured one. Every result names the exact rule/version/
 * structure/base used.
 */
export function calculateRecoveryFee(
  jurisdiction: string,
  claimType: string | undefined,
  grossRecoveryCents: number,
  timestamp: string,
  rules: readonly RecoveryFeeRule[] = RECOVERY_FEE_RULES
): RecoveryFeeCalculationResult {
  const resolution = getApplicableRecoveryFeeRule(jurisdiction, claimType, rules);

  const base = {
    feeCents: 0,
    ruleId: null,
    ruleVersion: null,
    structureType: null,
    baseAmountCents: grossRecoveryCents,
    candidates: [] as RecoveryFeeRule[],
    timestamp,
  };

  if (resolution.ambiguous) {
    return { ...base, status: "AMBIGUOUS_RULE", candidates: resolution.candidates };
  }
  if (!resolution.rule) {
    return { ...base, status: "NO_RULE_FOUND" };
  }

  const rule = resolution.rule;
  let feeCents: number;

  switch (rule.structureType) {
    case "PERCENTAGE":
      feeCents = Math.round(grossRecoveryCents * ((rule.percent ?? 0) / 100));
      break;
    case "FLAT":
    case "FIXED_ADMIN":
      feeCents = rule.flatFeeCents ?? 0;
      break;
    case "TIERED":
      feeCents = calculateTieredFee(grossRecoveryCents, rule.tiers ?? []);
      break;
    default:
      return { ...base, status: "UNSUPPORTED_STRUCTURE", ruleId: rule.id, ruleVersion: rule.version, structureType: rule.structureType };
  }

  return {
    status: "CALCULATED",
    feeCents,
    ruleId: rule.id,
    ruleVersion: rule.version,
    structureType: rule.structureType,
    baseAmountCents: grossRecoveryCents,
    candidates: [],
    timestamp,
  };
}

// --- Pre-invoice validation (doc 10 section 20) -------------------------

export interface FeeValidationInput {
  recoveryAmountKnown: boolean;
  applicableFeeRuleFound: boolean;
  priorPaymentsReconciled: boolean;
  priorInvoicesReconciled: boolean;
  creditsAndAdjustmentsReconciled: boolean;
}

export type FeeValidationOutcome = "PASS" | "REVIEW_REQUIRED";

export interface FeeValidationResult {
  outcome: FeeValidationOutcome;
  unmetChecks: string[];
}

const FEE_VALIDATION_CHECKS: ReadonlyArray<{ key: keyof FeeValidationInput; detail: string }> = [
  { key: "recoveryAmountKnown", detail: "Recovery amount is not yet known." },
  { key: "applicableFeeRuleFound", detail: "No applicable fee rule was found." },
  { key: "priorPaymentsReconciled", detail: "Prior payments are not reconciled." },
  { key: "priorInvoicesReconciled", detail: "Prior invoices are not reconciled." },
  { key: "creditsAndAdjustmentsReconciled", detail: "Credits/adjustments are not reconciled." },
];

/**
 * Pure: doc 10 section 20. PASS only once every pre-invoice check
 * clears -- never before, per "do not issue an invoice before the
 * underlying financial data is sufficiently verified."
 */
export function validateBeforeInvoice(input: FeeValidationInput): FeeValidationResult {
  const unmetChecks = FEE_VALIDATION_CHECKS.filter((c) => !input[c.key]).map((c) => c.detail);
  return { outcome: unmetChecks.length === 0 ? "PASS" : "REVIEW_REQUIRED", unmetChecks };
}
