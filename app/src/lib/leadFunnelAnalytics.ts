// Lead funnel analytics + visualization -- doc 13 sections 6-7.
// PLAN.md P12-4.
//
// "Build a complete lead funnel. SOURCED -> SCORED -> QUALIFIED ->
// OUTREACH -> DELIVERED -> RESPONDED -> ENGAGED -> VERIFIED -> CASE
// CREATED -> CLAIM PREPARED -> CLAIM FILED -> RECOVERY. Show: count,
// conversion rate, drop-off rate, average time between stages." /
// "Create a funnel visualization... The exact numbers must come from
// the database."

// doc 13 §6's own 12-stage funnel, verbatim order.
export const FUNNEL_STAGES = [
  "SOURCED",
  "SCORED",
  "QUALIFIED",
  "OUTREACH",
  "DELIVERED",
  "RESPONDED",
  "ENGAGED",
  "VERIFIED",
  "CASE_CREATED",
  "CLAIM_PREPARED",
  "CLAIM_FILED",
  "RECOVERY",
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type FunnelStageCounts = Record<FunnelStage, number>;

export interface FunnelStageReport {
  stage: FunnelStage;
  count: number;
  conversionRatePercent: number | null;
  dropOffRatePercent: number | null;
  avgTimeToStageMs: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Pure: doc 13 §6-7's own funnel report -- every stage's conversion
 * rate is relative to the immediately-preceding stage (never the top
 * of the funnel), so a mid-funnel bottleneck is visible on its own
 * terms. The exact counts always come from the caller (the doc's own
 * "must come from the database" instruction) -- this function never
 * invents or estimates a count.
 */
export function buildFunnelReport(
  counts: FunnelStageCounts,
  avgTimeToStageMs: Partial<Record<FunnelStage, number>> = {}
): FunnelStageReport[] {
  return FUNNEL_STAGES.map((stage, index) => {
    const previousStage = index > 0 ? FUNNEL_STAGES[index - 1] : undefined;
    const previousCount = previousStage ? counts[previousStage] : undefined;
    const conversionRatePercent = previousCount !== undefined ? ratePercent(counts[stage], previousCount) : null;
    const dropOffRatePercent =
      previousCount !== undefined && conversionRatePercent !== null ? Math.round((100 - conversionRatePercent) * 10) / 10 : null;
    return {
      stage,
      count: counts[stage],
      conversionRatePercent,
      dropOffRatePercent,
      avgTimeToStageMs: avgTimeToStageMs[stage] ?? null,
    };
  });
}
