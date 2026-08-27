// Attribution + cost attribution + shared-cost allocation -- doc 13
// sections 72-75. PLAN.md P12-26.
//
// "Track the full attribution chain: lead -> case -> claim -> recovery
// -> revenue, back to its originating source. Where the chain can't
// be traced cleanly (merged leads, re-attributed cases), flag it
// ATTRIBUTION_UNCERTAIN rather than inventing a precise link." /
// "Assign every cost to the object it belongs to (a case, a source, a
// campaign)." / "Shared costs (e.g. a shared AI subscription, shared
// infrastructure) need an explicit, configurable allocation method:
// equal split, by case count, by usage, by revenue, or excluded
// entirely from per-case economics."

// --- Attribution chain (doc 13 §72) -----------------------------------------

export interface AttributionChain {
  leadId: string;
  caseId?: string;
  claimId?: string;
  recoveryId?: string;
  originatingSource: string | null;
  isAttributionUncertain: boolean;
  uncertaintyReason?: string;
}

/**
 * Pure: doc 13 §72 -- "flag it ATTRIBUTION_UNCERTAIN rather than
 * inventing a precise link." A chain with no traceable originating
 * source is marked uncertain rather than defaulting to some guessed
 * source.
 */
export function buildAttributionChain(params: {
  leadId: string;
  caseId?: string;
  claimId?: string;
  recoveryId?: string;
  originatingSource: string | null;
  uncertaintyReason?: string;
}): AttributionChain {
  return {
    leadId: params.leadId,
    caseId: params.caseId,
    claimId: params.claimId,
    recoveryId: params.recoveryId,
    originatingSource: params.originatingSource,
    isAttributionUncertain: params.originatingSource === null || params.uncertaintyReason !== undefined,
    uncertaintyReason: params.uncertaintyReason,
  };
}

// --- Cost-to-object assignment (doc 13 §73-74) ------------------------------

export type CostAttributionObjectType = "CASE" | "SOURCE" | "CAMPAIGN";

export interface CostAssignment {
  costCents: number;
  objectType: CostAttributionObjectType;
  objectId: string;
}

export function assignCostToObject(costCents: number, objectType: CostAttributionObjectType, objectId: string): CostAssignment {
  return { costCents, objectType, objectId };
}

// --- Shared-cost allocation, configurable method (doc 13 §75) ---------------

export type SharedCostAllocationMethod = "EQUAL_SPLIT" | "BY_CASE_COUNT" | "BY_USAGE" | "BY_REVENUE" | "EXCLUDED";

export interface SharedCostAllocationTarget {
  objectId: string;
  /** Case count, usage units, or revenue cents, depending on the
   * method -- ignored entirely for EQUAL_SPLIT and EXCLUDED. */
  weight: number;
}

export interface SharedCostAllocationRow {
  objectId: string;
  allocatedCostCents: number;
}

/**
 * Pure: doc 13 §75 -- "an explicit, configurable allocation method."
 * EXCLUDED always returns zero allocation to every target rather than
 * silently falling back to equal split.
 */
export function allocateSharedCost(
  totalCostCents: number,
  targets: readonly SharedCostAllocationTarget[],
  method: SharedCostAllocationMethod
): SharedCostAllocationRow[] {
  if (method === "EXCLUDED" || targets.length === 0) {
    return targets.map((t) => ({ objectId: t.objectId, allocatedCostCents: 0 }));
  }
  if (method === "EQUAL_SPLIT") {
    const share = Math.round(totalCostCents / targets.length);
    return targets.map((t) => ({ objectId: t.objectId, allocatedCostCents: share }));
  }
  // BY_CASE_COUNT, BY_USAGE, BY_REVENUE all reduce to weighted proportional
  // allocation -- only the meaning of `weight` differs by caller convention.
  const totalWeight = targets.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight === 0) {
    return targets.map((t) => ({ objectId: t.objectId, allocatedCostCents: 0 }));
  }
  return targets.map((t) => ({ objectId: t.objectId, allocatedCostCents: Math.round((t.weight / totalWeight) * totalCostCents) }));
}
