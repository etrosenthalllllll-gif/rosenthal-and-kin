// Revenue dashboard + revenue recognition -- doc 13 sections 24-25.
// PLAN.md P12-10.
//
// "Build a revenue dashboard. Track: gross revenue, collected revenue,
// outstanding revenue, expected revenue, revenue by month/source/
// jurisdiction/case/operator/acquisition channel." / "Clearly
// distinguish: expected revenue, earned revenue, invoiced revenue,
// collected revenue, outstanding revenue. Do not treat expected
// recovery or unpaid invoices as collected cash."

export interface RevenueRecognitionBreakdown {
  expectedCents: number;
  earnedCents: number;
  invoicedCents: number;
  collectedCents: number;
  outstandingCents: number;
}

/**
 * Pure: doc 13 §25's own five-concept distinction, kept as five
 * genuinely separate fields rather than one blended "revenue" number
 * -- "do not treat expected recovery or unpaid invoices as collected
 * cash" is enforced structurally by never summing these together in
 * this function.
 */
export function buildRevenueRecognitionBreakdown(input: RevenueRecognitionBreakdown): RevenueRecognitionBreakdown {
  return { ...input };
}

// --- Revenue-by-dimension grouping (doc 13 §24) -----------------------------

export interface AttributedRevenueRecord {
  amountCents: number;
  month?: string;
  source?: string;
  jurisdiction?: string;
  caseId?: string;
  operator?: string;
  acquisitionChannel?: string;
}

export type RevenueGroupingDimension = keyof Omit<AttributedRevenueRecord, "amountCents">;

/**
 * Pure: sums revenue records by any one of the doc's own dimensions
 * (month/source/jurisdiction/case/operator/channel) -- one shared
 * grouping primitive, same discipline as apiMonitoring.ts's (P11-3)
 * groupApiMetricsBy() rather than a bespoke reducer per dimension.
 */
export function groupRevenueBy(
  records: readonly AttributedRevenueRecord[],
  dimension: RevenueGroupingDimension
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of records) {
    const key = record[dimension];
    if (key === undefined) continue;
    totals.set(key, (totals.get(key) ?? 0) + record.amountCents);
  }
  return totals;
}
