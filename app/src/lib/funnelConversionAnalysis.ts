// Funnel conversion rates + drop-off analysis -- doc 13 sections 8-9.
// PLAN.md P12-5.
//
// "Calculate every stage-to-stage conversion. Examples: Qualification
// rate, Outreach rate, Response rate, Verification rate, Case
// conversion rate, Filing rate, Recovery rate, Overall lead-to-
// recovery rate." / "Identify where the largest losses occur... The
// dashboard should identify: 'Largest funnel drop-off: qualified ->
// response.'"

import { buildFunnelReport, FUNNEL_STAGES, type FunnelStageCounts, type FunnelStageReport } from "./leadFunnelAnalytics";

export interface NamedFunnelConversionRates {
  qualificationRatePercent: number | null; // QUALIFIED / SCORED
  outreachRatePercent: number | null; // OUTREACH / QUALIFIED
  responseRatePercent: number | null; // RESPONDED / DELIVERED
  verificationRatePercent: number | null; // VERIFIED / ENGAGED
  caseConversionRatePercent: number | null; // CASE_CREATED / VERIFIED
  filingRatePercent: number | null; // CLAIM_FILED / CLAIM_PREPARED
  recoveryRatePercent: number | null; // RECOVERY / CLAIM_FILED
  overallLeadToRecoveryRatePercent: number | null; // RECOVERY / SOURCED
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Pure: doc 13 §8's own named-rate list, each mapped onto the exact
 * stage pair it describes.
 */
export function computeNamedFunnelConversionRates(counts: FunnelStageCounts): NamedFunnelConversionRates {
  return {
    qualificationRatePercent: ratePercent(counts.QUALIFIED, counts.SCORED),
    outreachRatePercent: ratePercent(counts.OUTREACH, counts.QUALIFIED),
    responseRatePercent: ratePercent(counts.RESPONDED, counts.DELIVERED),
    verificationRatePercent: ratePercent(counts.VERIFIED, counts.ENGAGED),
    caseConversionRatePercent: ratePercent(counts.CASE_CREATED, counts.VERIFIED),
    filingRatePercent: ratePercent(counts.CLAIM_FILED, counts.CLAIM_PREPARED),
    recoveryRatePercent: ratePercent(counts.RECOVERY, counts.CLAIM_FILED),
    overallLeadToRecoveryRatePercent: ratePercent(counts.RECOVERY, counts.SOURCED),
  };
}

// --- Largest drop-off identification (doc 13 §9) ----------------------------

export interface FunnelDropOff {
  fromStage: string;
  toStage: string;
  dropOffRatePercent: number;
}

/**
 * Pure: doc 13 §9's own worked example -- identifies the single
 * stage-to-stage transition with the highest drop-off rate among
 * transitions that actually have a computable rate (the funnel's
 * first stage has none, and is skipped). Returns null only when no
 * transition has a computable rate at all.
 */
export function findLargestFunnelDropOff(report: readonly FunnelStageReport[]): FunnelDropOff | null {
  let largest: FunnelDropOff | null = null;
  for (let i = 1; i < report.length; i++) {
    const rate = report[i].dropOffRatePercent;
    if (rate === null) continue;
    if (largest === null || rate > largest.dropOffRatePercent) {
      largest = { fromStage: report[i - 1].stage, toStage: report[i].stage, dropOffRatePercent: rate };
    }
  }
  return largest;
}

export function buildFunnelDropOffReport(counts: FunnelStageCounts): { report: FunnelStageReport[]; largestDropOff: FunnelDropOff | null } {
  const report = buildFunnelReport(counts);
  return { report, largestDropOff: findLargestFunnelDropOff(report) };
}

export { FUNNEL_STAGES };
