// Claim conversion + jurisdiction/case-type performance -- doc 13
// sections 17-19. PLAN.md P12-8.
//
// "Track: Lead -> Case, Case -> Verified, Verified -> Claim Prepared,
// Claim Prepared -> Filed, Filed -> Approved, Approved -> Recovery.
// Calculate conversion rates at each step." / "Show metrics by
// jurisdiction. Track: cases, claims, filing success, rejections,
// resubmissions, average processing time, recovery rate, average
// recovery, revenue, costs, ROI. Do not assume every jurisdiction
// follows the same workflow." / "Where applicable, allow segmentation
// by case type."

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// --- Claim conversion rates (doc 13 §17) ------------------------------------

export interface ClaimConversionCounts {
  leads: number;
  cases: number;
  verified: number;
  claimsPrepared: number;
  claimsFiled: number;
  claimsApproved: number;
  recoveries: number;
}

export interface ClaimConversionRates {
  leadToCaseRatePercent: number | null;
  caseToVerifiedRatePercent: number | null;
  verifiedToPreparedRatePercent: number | null;
  preparedToFiledRatePercent: number | null;
  filedToApprovedRatePercent: number | null;
  approvedToRecoveryRatePercent: number | null;
}

export function computeClaimConversionRates(counts: ClaimConversionCounts): ClaimConversionRates {
  return {
    leadToCaseRatePercent: ratePercent(counts.cases, counts.leads),
    caseToVerifiedRatePercent: ratePercent(counts.verified, counts.cases),
    verifiedToPreparedRatePercent: ratePercent(counts.claimsPrepared, counts.verified),
    preparedToFiledRatePercent: ratePercent(counts.claimsFiled, counts.claimsPrepared),
    filedToApprovedRatePercent: ratePercent(counts.claimsApproved, counts.claimsFiled),
    approvedToRecoveryRatePercent: ratePercent(counts.recoveries, counts.claimsApproved),
  };
}

// --- Jurisdiction / case-type performance (doc 13 §18-19) -------------------

export interface SegmentPerformanceCounts {
  cases: number;
  claims: number;
  filingSuccesses: number;
  rejections: number;
  resubmissions: number;
  avgProcessingTimeMs: number | null;
  recoveries: number;
  totalRecoveredCents: number;
  revenueCents: number;
  costCents: number;
}

export interface SegmentPerformanceMetrics extends SegmentPerformanceCounts {
  filingSuccessRatePercent: number | null;
  recoveryRatePercent: number | null;
  avgRecoveryCents: number | null;
  profitCents: number;
  roiPercent: number | null;
}

/**
 * Pure: doc 13 §18's own field list, computed per segment (the
 * caller passes one jurisdiction's or one case-type's counts at a
 * time -- "do not assume every jurisdiction follows the same
 * workflow" is honored by never merging segments together here).
 */
export function computeSegmentPerformance(counts: SegmentPerformanceCounts): SegmentPerformanceMetrics {
  const profitCents = counts.revenueCents - counts.costCents;
  return {
    ...counts,
    filingSuccessRatePercent: ratePercent(counts.filingSuccesses, counts.claims),
    recoveryRatePercent: ratePercent(counts.recoveries, counts.claims),
    avgRecoveryCents: counts.recoveries > 0 ? Math.round(counts.totalRecoveredCents / counts.recoveries) : null,
    profitCents,
    roiPercent: counts.costCents > 0 ? Math.round((profitCents / counts.costCents) * 1000) / 10 : null,
  };
}
