// Outreach sequence + lead source analytics + source quality score --
// doc 13 sections 14-16. PLAN.md P12-7.
//
// "For every outreach sequence measure: contacts, responses, positive
// responses, conversions, cases, claims, recoveries, revenue, cost,
// ROI. Compare different sequences." / "Track performance by source...
// leads, qualified leads, response rate, case conversion, filing rate,
// recovery rate, revenue, cost, profit, ROI." / "Calculate source
// quality based on downstream outcomes, not simply lead volume. A
// source generating 10,000 low-quality leads should not automatically
// rank above a source generating 1,000 highly convertible leads. Allow
// configurable weighting."

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// --- Outreach sequence performance (doc 13 §14) -----------------------------

export interface SequencePerformanceCounts {
  contacts: number;
  responses: number;
  positiveResponses: number;
  conversions: number;
  cases: number;
  claims: number;
  recoveries: number;
  revenueCents: number;
  costCents: number;
}

export interface SequencePerformanceMetrics extends SequencePerformanceCounts {
  responseRatePercent: number | null;
  profitCents: number;
  roiPercent: number | null;
}

export function computeSequencePerformance(counts: SequencePerformanceCounts): SequencePerformanceMetrics {
  const profitCents = counts.revenueCents - counts.costCents;
  return {
    ...counts,
    responseRatePercent: ratePercent(counts.responses, counts.contacts),
    profitCents,
    roiPercent: counts.costCents > 0 ? Math.round((profitCents / counts.costCents) * 1000) / 10 : null,
  };
}

/**
 * Pure: ranks sequences by ROI (falling back to raw profit when ROI
 * is null on a zero-cost sequence) -- "compare different sequences"
 * without inventing a synthetic score.
 */
export function rankSequencesByRoi<T extends SequencePerformanceMetrics>(sequences: readonly T[]): T[] {
  return [...sequences].sort((a, b) => (b.roiPercent ?? b.profitCents) - (a.roiPercent ?? a.profitCents));
}

// --- Lead source performance (doc 13 §15) -----------------------------------

export interface SourcePerformanceCounts {
  leads: number;
  qualifiedLeads: number;
  cases: number;
  claimsFiled: number;
  recoveries: number;
  revenueCents: number;
  costCents: number;
}

export interface SourcePerformanceMetrics extends SourcePerformanceCounts {
  qualificationRatePercent: number | null;
  caseConversionRatePercent: number | null;
  filingRatePercent: number | null;
  recoveryRatePercent: number | null;
  profitCents: number;
  roiPercent: number | null;
}

export function computeSourcePerformance(counts: SourcePerformanceCounts): SourcePerformanceMetrics {
  const profitCents = counts.revenueCents - counts.costCents;
  return {
    ...counts,
    qualificationRatePercent: ratePercent(counts.qualifiedLeads, counts.leads),
    caseConversionRatePercent: ratePercent(counts.cases, counts.qualifiedLeads),
    filingRatePercent: ratePercent(counts.claimsFiled, counts.cases),
    recoveryRatePercent: ratePercent(counts.recoveries, counts.claimsFiled),
    profitCents,
    roiPercent: counts.costCents > 0 ? Math.round((profitCents / counts.costCents) * 1000) / 10 : null,
  };
}

// --- Source quality score (doc 13 §16) --------------------------------------

export interface SourceQualityWeights {
  qualificationWeight: number;
  caseConversionWeight: number;
  recoveryWeight: number;
}

// Illustrative default -- equal weighting -- configurable per the
// doc's own "allow configurable weighting" instruction.
export const DEFAULT_SOURCE_QUALITY_WEIGHTS: SourceQualityWeights = {
  qualificationWeight: 1 / 3,
  caseConversionWeight: 1 / 3,
  recoveryWeight: 1 / 3,
};

/**
 * Pure: doc 13 §16's own worked example -- a source's quality score is
 * a weighted blend of its downstream conversion rates, never its raw
 * lead volume. A source with no computable rate for a given weight
 * (denominator zero) contributes 0 for that component rather than
 * inflating or deflating the score with a guess.
 */
export function computeSourceQualityScore(
  metrics: SourcePerformanceMetrics,
  weights: SourceQualityWeights = DEFAULT_SOURCE_QUALITY_WEIGHTS
): number {
  const qualification = metrics.qualificationRatePercent ?? 0;
  const caseConversion = metrics.caseConversionRatePercent ?? 0;
  const recovery = metrics.recoveryRatePercent ?? 0;
  return (
    Math.round(
      (qualification * weights.qualificationWeight + caseConversion * weights.caseConversionWeight + recovery * weights.recoveryWeight) * 10
    ) / 10
  );
}
