// ROI analytics + acquisition/campaign ROI -- doc 13 sections 49-51.
// PLAN.md P12-18.
//
// "Make the ROI formula configurable, not hardcoded -- different
// stakeholders define ROI differently (some want (revenue - cost) /
// cost, some want net profit / cost). Break ROI out by source,
// campaign, workflow, jurisdiction, case type, and month." / "Build a
// per-source ROI table" / "Build a per-campaign ROI table."

export type RoiFormula = "REVENUE_MINUS_COST_OVER_COST" | "NET_PROFIT_OVER_COST";

export interface RoiInputs {
  revenueCents: number;
  netProfitCents: number;
  costCents: number;
}

/**
 * Pure: doc 13 §49 -- "make the ROI formula configurable, not
 * hardcoded." The caller picks which numerator definition applies;
 * this never silently assumes one. Returns null with zero cost rather
 * than dividing by zero.
 */
export function computeRoiPercent(inputs: RoiInputs, formula: RoiFormula): number | null {
  if (inputs.costCents === 0) return null;
  const numerator = formula === "REVENUE_MINUS_COST_OVER_COST" ? inputs.revenueCents - inputs.costCents : inputs.netProfitCents;
  return Math.round((numerator / inputs.costCents) * 1000) / 10;
}

// --- Breakout dimensions (doc 13 §49) ---------------------------------------

export type RoiBreakoutDimension = "SOURCE" | "CAMPAIGN" | "WORKFLOW" | "JURISDICTION" | "CASE_TYPE" | "MONTH";

export interface RoiBreakoutGroup {
  dimension: RoiBreakoutDimension;
  key: string;
  roi: RoiInputs;
}

export interface RoiBreakoutRow {
  dimension: RoiBreakoutDimension;
  key: string;
  roiPercent: number | null;
}

export function computeRoiBreakout(groups: readonly RoiBreakoutGroup[], formula: RoiFormula): RoiBreakoutRow[] {
  return groups.map((g) => ({ dimension: g.dimension, key: g.key, roiPercent: computeRoiPercent(g.roi, formula) }));
}

// --- Per-source and per-campaign ROI tables (doc 13 §50-51) -----------------

export interface SourceRoiRow {
  source: string;
  leadsAcquired: number;
  acquisitionCostCents: number;
  revenueCents: number;
  netProfitCents: number;
}

export interface SourceRoiTableRow extends SourceRoiRow {
  roiPercent: number | null;
  costPerLeadCents: number | null;
}

export function buildSourceRoiTable(rows: readonly SourceRoiRow[], formula: RoiFormula): SourceRoiTableRow[] {
  return rows.map((r) => ({
    ...r,
    roiPercent: computeRoiPercent({ revenueCents: r.revenueCents, netProfitCents: r.netProfitCents, costCents: r.acquisitionCostCents }, formula),
    costPerLeadCents: r.leadsAcquired > 0 ? Math.round(r.acquisitionCostCents / r.leadsAcquired) : null,
  }));
}

export interface CampaignRoiRow {
  campaign: string;
  spendCents: number;
  revenueCents: number;
  netProfitCents: number;
}

export interface CampaignRoiTableRow extends CampaignRoiRow {
  roiPercent: number | null;
}

export function buildCampaignRoiTable(rows: readonly CampaignRoiRow[], formula: RoiFormula): CampaignRoiTableRow[] {
  return rows.map((r) => ({
    ...r,
    roiPercent: computeRoiPercent({ revenueCents: r.revenueCents, netProfitCents: r.netProfitCents, costCents: r.spendCents }, formula),
  }));
}
