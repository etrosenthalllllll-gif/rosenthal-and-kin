// Distribution model + deterministic engine + rules + versioning --
// doc 10 sections 10-13. PLAN.md P9-4.
//
// "GROSS RECOVERY - AUTHORIZED DEDUCTIONS - AUTHORIZED FEES -
// AUTHORIZED EXPENSES = NET DISTRIBUTABLE AMOUNT. Then allocate
// according to configured distribution rules. Every calculation must
// preserve: inputs, rules, rule version, calculation, output,
// timestamp. Distribution rules must be configurable -- do not
// hardcode individual case arrangements into application logic. Never
// overwrite an approved distribution calculation -- a correction
// creates a new DistributionVersion."
//
// Governs the schema's Distribution model (P9-4), where each row IS a
// version (same shape as RecoveryEstimateVersion/P9-1): a correction is
// always a new row at `version + 1` for the same (recoveryId,
// claimantId), never an edit to the prior one.

export interface DistributionCalculationInput {
  grossRecoveryCents: number;
  deductionsCents: number;
  feesCents: number;
  expensesCents: number;
}

/**
 * Pure: doc 10 section 11's own formula, verbatim.
 */
export function calculateNetDistributable(input: DistributionCalculationInput): number {
  return input.grossRecoveryCents - input.deductionsCents - input.feesCents - input.expensesCents;
}

export interface BeneficiaryShare {
  claimantId: string;
  percent: number;
}

export interface DistributionRuleValidation {
  valid: boolean;
  totalPercent: number;
}

/**
 * Pure: doc 10 section 12's own constraint -- shares must sum to
 * exactly 100%, allowing a small floating-point tolerance rather than
 * an exact-equality check that would reject a legitimate 33.33/33.33/
 * 33.34 split.
 */
export function validateDistributionRule(shares: readonly BeneficiaryShare[]): DistributionRuleValidation {
  const totalPercent = shares.reduce((sum, s) => sum + s.percent, 0);
  return { valid: Math.abs(totalPercent - 100) < 0.01, totalPercent };
}

export interface BeneficiaryDistributionResult {
  claimantId: string;
  percent: number;
  distributionAmountCents: number;
}

/**
 * Pure: doc 10 sections 12, 14. Allocates the net distributable amount
 * per the configured (never hardcoded) share table. Each beneficiary's
 * amount is independently computed and roundable/traceable back to its
 * own percent -- doc 10 section 14's "each distribution must be
 * independently trackable."
 */
export function allocateDistribution(
  netDistributableCents: number,
  shares: readonly BeneficiaryShare[]
): BeneficiaryDistributionResult[] {
  return shares.map((s) => ({
    claimantId: s.claimantId,
    percent: s.percent,
    distributionAmountCents: Math.round(netDistributableCents * (s.percent / 100)),
  }));
}

// --- Distribution versioning (doc 10 section 13) ------------------------

export interface DistributionVersionRecord {
  claimantId: string;
  version: number;
  distributionAmountCents: number;
}

/**
 * Pure: the current distribution for one beneficiary is the highest
 * version number recorded for that (recoveryId, claimantId) pair --
 * scoped per beneficiary since each has independently-versioned
 * history.
 */
export function getCurrentDistributionVersion(
  versions: readonly DistributionVersionRecord[],
  claimantId: string
): DistributionVersionRecord | null {
  const forClaimant = versions.filter((v) => v.claimantId === claimantId);
  if (forClaimant.length === 0) return null;
  return forClaimant.reduce((latest, v) => (v.version > latest.version ? v : latest));
}

/**
 * Pure: doc 10 section 13. Never overwrites an approved calculation --
 * always the next version number past whatever this beneficiary's
 * current highest is.
 */
export function nextDistributionVersionNumber(
  versions: readonly DistributionVersionRecord[],
  claimantId: string
): number {
  return (getCurrentDistributionVersion(versions, claimantId)?.version ?? 0) + 1;
}
