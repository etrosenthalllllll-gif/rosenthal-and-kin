// Source comparison + case profitability + economic status +
// negative-economics detection -- doc 13 sections 62-65. PLAN.md
// P12-23.
//
// "Rank sources against each other on a single comparison table --
// conversion rate, recovery rate, ROI, cost per lead." / "Show a
// per-case profitability view -- revenue, cost, profit, margin." /
// "Classify each case's economic status: highly profitable,
// profitable, marginal, break-even, negative. Make the thresholds
// configurable." / "Flag cases with negative expected economics --
// surface them for operator/manager review. Never auto-terminate a
// case based on this flag alone; a human decides."

// --- Ranked per-source comparison (doc 13 §62) ------------------------------

export interface SourceComparisonInput {
  source: string;
  conversionRatePercent: number | null;
  recoveryRatePercent: number | null;
  roiPercent: number | null;
  costPerLeadCents: number | null;
}

export interface RankedSourceComparisonRow extends SourceComparisonInput {
  rank: number;
}

/**
 * Pure: doc 13 §62 -- "rank sources against each other." Ranked by
 * ROI descending (the doc's own headline comparison metric); a null
 * ROI (no cost data yet) sorts last rather than being treated as
 * either best or worst.
 */
export function rankSourceComparison(sources: readonly SourceComparisonInput[]): RankedSourceComparisonRow[] {
  const sorted = [...sources].sort((a, b) => (b.roiPercent ?? -Infinity) - (a.roiPercent ?? -Infinity));
  return sorted.map((s, index) => ({ ...s, rank: index + 1 }));
}

// --- Per-case profitability view (doc 13 §63) -------------------------------

export interface CaseProfitabilityView {
  caseId: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPercent: number | null;
}

export function buildCaseProfitabilityView(caseId: string, revenueCents: number, costCents: number): CaseProfitabilityView {
  const profitCents = revenueCents - costCents;
  return {
    caseId,
    revenueCents,
    costCents,
    profitCents,
    marginPercent: revenueCents !== 0 ? Math.round((profitCents / revenueCents) * 1000) / 10 : null,
  };
}

// --- Economic status classification, configurable thresholds (doc 13 §64) --

export type EconomicStatus = "HIGHLY_PROFITABLE" | "PROFITABLE" | "MARGINAL" | "BREAK_EVEN" | "NEGATIVE";

export interface EconomicStatusThresholds {
  highlyProfitableMarginPercent: number;
  profitableMarginPercent: number;
  marginalMarginPercent: number;
}

export const DEFAULT_ECONOMIC_STATUS_THRESHOLDS: EconomicStatusThresholds = {
  highlyProfitableMarginPercent: 50,
  profitableMarginPercent: 20,
  marginalMarginPercent: 0,
};

/**
 * Pure: doc 13 §64 -- "make the thresholds configurable." Never a
 * hardcoded switch; the caller's threshold table decides every
 * boundary.
 */
export function classifyEconomicStatus(marginPercent: number | null, thresholds: EconomicStatusThresholds = DEFAULT_ECONOMIC_STATUS_THRESHOLDS): EconomicStatus {
  if (marginPercent === null) return "NEGATIVE";
  if (marginPercent >= thresholds.highlyProfitableMarginPercent) return "HIGHLY_PROFITABLE";
  if (marginPercent >= thresholds.profitableMarginPercent) return "PROFITABLE";
  if (marginPercent > thresholds.marginalMarginPercent) return "MARGINAL";
  if (marginPercent === thresholds.marginalMarginPercent) return "BREAK_EVEN";
  return "NEGATIVE";
}

// --- Negative-economics flag, surfaced not auto-terminated (doc 13 §65) ----

export interface NegativeEconomicsFlag {
  caseId: string;
  flagged: boolean;
  reason: string | null;
  requiresHumanReview: boolean;
}

/**
 * Pure: doc 13 §65 -- "never auto-terminate a case based on this flag
 * alone; a human decides." `requiresHumanReview` is always true
 * alongside a true flag -- there is no "auto-terminate" branch in
 * this module at all.
 */
export function evaluateNegativeEconomicsFlag(caseId: string, expectedProfitCents: number): NegativeEconomicsFlag {
  const flagged = expectedProfitCents < 0;
  return {
    caseId,
    flagged,
    reason: flagged ? `expected profit is negative (${expectedProfitCents} cents)` : null,
    requiresHumanReview: flagged,
  };
}
