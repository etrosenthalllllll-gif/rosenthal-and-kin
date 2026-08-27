// AI/communication/filing cost analytics -- doc 13 sections 30-32.
// PLAN.md P12-12.
//
// "Track: AI spend, spend by model, spend by workflow, spend by case,
// spend per lead, spend per case, spend per claim, spend per
// recovery, revenue generated per AI dollar." / "Track: email cost,
// SMS cost, voice cost, postage cost, cost per contact, cost per
// response, cost per case, cost per recovery." / "Track: filing fees,
// provider costs, resubmission costs, payment processing, cost per
// filing, cost per successful filing."
//
// Per-unit cost calculations reuse caseEconomics.ts's (P12-11)
// computeCostPerUnit() rather than three near-identical divisions.

import { computeCostPerUnit } from "./caseEconomics";

// --- AI cost analytics (doc 13 §30) -----------------------------------------

export interface AttributedAiSpendRecord {
  amountCents: number;
  model?: string;
  workflowId?: string;
  caseId?: string;
}

export type AiSpendGroupingDimension = keyof Omit<AttributedAiSpendRecord, "amountCents">;

export function groupAiSpendBy(records: readonly AttributedAiSpendRecord[], dimension: AiSpendGroupingDimension): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of records) {
    const key = record[dimension];
    if (key === undefined) continue;
    totals.set(key, (totals.get(key) ?? 0) + record.amountCents);
  }
  return totals;
}

/**
 * Pure: doc 13 §30's own "revenue generated per AI dollar" -- how much
 * revenue each cent of AI spend produced. Null when there was no AI
 * spend at all, never a divide-by-zero.
 */
export function computeRevenueGeneratedPerAiCent(revenueCents: number, aiCostCents: number): number | null {
  if (aiCostCents <= 0) return null;
  return Math.round((revenueCents / aiCostCents) * 100) / 100;
}

// --- Communication cost analytics (doc 13 §31) ------------------------------

export interface CommunicationCostBreakdown {
  emailCostCents: number;
  smsCostCents: number;
  voiceCostCents: number;
  postageCostCents: number;
}

export function computeTotalCommunicationCost(breakdown: CommunicationCostBreakdown): number {
  return Object.values(breakdown).reduce((sum, v) => sum + v, 0);
}

export function computeCommunicationCostPerContact(totalCostCents: number, contacts: number): number | null {
  return computeCostPerUnit(totalCostCents, contacts);
}

export function computeCommunicationCostPerResponse(totalCostCents: number, responses: number): number | null {
  return computeCostPerUnit(totalCostCents, responses);
}

// --- Filing cost analytics (doc 13 §32) -------------------------------------

export interface FilingCostBreakdown {
  filingFeesCents: number;
  providerCostsCents: number;
  resubmissionCostsCents: number;
  paymentProcessingCents: number;
}

export function computeTotalFilingCost(breakdown: FilingCostBreakdown): number {
  return Object.values(breakdown).reduce((sum, v) => sum + v, 0);
}

export function computeCostPerFiling(totalCostCents: number, filingsSubmitted: number): number | null {
  return computeCostPerUnit(totalCostCents, filingsSubmitted);
}

export function computeCostPerSuccessfulFiling(totalCostCents: number, successfulFilings: number): number | null {
  return computeCostPerUnit(totalCostCents, successfulFilings);
}
