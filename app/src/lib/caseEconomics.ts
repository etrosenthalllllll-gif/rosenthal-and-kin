// Case economics + cost-per-case + cost breakdown + fixed/variable
// split -- doc 13 sections 26-29. PLAN.md P12-11.
//
// "For each case calculate: acquisition cost, research cost, AI cost,
// communication cost, document cost, filing cost, payment processing
// cost, operator labor cost, other direct costs, total case cost,
// revenue, gross profit, net contribution, ROI." / "Calculate: total
// costs / number of cases. Also show cost per qualified lead/
// response/verified claimant/claim/filed claim/recovery." / "For every
// cost category show: AI, email, SMS, voice, postage, research,
// OCR, filing fees, payment processing, software, infrastructure,
// operator labor, other. Allow configurable categories." / "Separate
// FIXED COSTS from VARIABLE COSTS."

export interface CaseCostBreakdown {
  acquisitionCents: number;
  researchCents: number;
  aiCents: number;
  communicationCents: number;
  documentCents: number;
  filingCents: number;
  paymentProcessingCents: number;
  operatorLaborCents: number;
  otherCents: number;
}

export function computeTotalCaseCost(breakdown: CaseCostBreakdown): number {
  return Object.values(breakdown).reduce((sum, v) => sum + v, 0);
}

export interface CaseEconomics {
  breakdown: CaseCostBreakdown;
  totalCostCents: number;
  revenueCents: number;
  grossProfitCents: number;
  netContributionCents: number;
  roiPercent: number | null;
}

/**
 * Pure: doc 13 §26's own per-case field list. Gross profit and net
 * contribution are computed identically here (revenue minus total
 * cost) -- this codebase has no separate allocated-overhead concept
 * yet to distinguish them further, so both fields are populated with
 * the same honest number rather than one being faked.
 */
export function computeCaseEconomics(breakdown: CaseCostBreakdown, revenueCents: number): CaseEconomics {
  const totalCostCents = computeTotalCaseCost(breakdown);
  const grossProfitCents = revenueCents - totalCostCents;
  return {
    breakdown,
    totalCostCents,
    revenueCents,
    grossProfitCents,
    netContributionCents: grossProfitCents,
    roiPercent: totalCostCents > 0 ? Math.round((grossProfitCents / totalCostCents) * 1000) / 10 : null,
  };
}

// --- Cost-per-unit (doc 13 §27) ----------------------------------------------

/**
 * Pure: doc 13 §27's own "total costs / number of cases" generalized
 * to any unit (qualified lead, response, verified claimant, claim,
 * filed claim, recovery) -- one function, not six near-identical ones.
 */
export function computeCostPerUnit(totalCostCents: number, unitCount: number): number | null {
  if (unitCount <= 0) return null;
  return Math.round(totalCostCents / unitCount);
}

// --- Cost category breakdown + fixed/variable split (doc 13 §28-29) --------

export type CostCategory =
  | "AI"
  | "EMAIL"
  | "SMS"
  | "VOICE"
  | "POSTAGE"
  | "RESEARCH_DATA_PROVIDERS"
  | "OCR"
  | "FILING_FEES"
  | "PAYMENT_PROCESSING"
  | "SOFTWARE"
  | "INFRASTRUCTURE"
  | "OPERATOR_LABOR"
  | "OTHER";

export type CostNature = "FIXED" | "VARIABLE";

// doc 13 §29's own worked example split -- configurable, since the
// doc explicitly calls out "allow configurable categories."
export const DEFAULT_COST_NATURE_TABLE: Readonly<Record<CostCategory, CostNature>> = {
  AI: "VARIABLE",
  EMAIL: "VARIABLE",
  SMS: "VARIABLE",
  VOICE: "VARIABLE",
  POSTAGE: "VARIABLE",
  RESEARCH_DATA_PROVIDERS: "VARIABLE",
  OCR: "VARIABLE",
  FILING_FEES: "VARIABLE",
  PAYMENT_PROCESSING: "VARIABLE",
  OPERATOR_LABOR: "VARIABLE",
  SOFTWARE: "FIXED",
  INFRASTRUCTURE: "FIXED",
  OTHER: "VARIABLE",
};

export function classifyCostNature(category: CostCategory, table: Readonly<Record<CostCategory, CostNature>> = DEFAULT_COST_NATURE_TABLE): CostNature {
  return table[category];
}

export interface CategorizedCost {
  category: CostCategory;
  amountCents: number;
}

export interface FixedVariableSplit {
  fixedCents: number;
  variableCents: number;
}

/**
 * Pure: doc 13 §29's own separation, needed for "proper unit
 * economics" -- sums a batch of categorized costs into fixed vs.
 * variable totals using the configurable nature table.
 */
export function splitFixedVariableCosts(
  costs: readonly CategorizedCost[],
  table: Readonly<Record<CostCategory, CostNature>> = DEFAULT_COST_NATURE_TABLE
): FixedVariableSplit {
  return costs.reduce<FixedVariableSplit>(
    (acc, cost) => {
      const nature = classifyCostNature(cost.category, table);
      return nature === "FIXED"
        ? { ...acc, fixedCents: acc.fixedCents + cost.amountCents }
        : { ...acc, variableCents: acc.variableCents + cost.amountCents };
    },
    { fixedCents: 0, variableCents: 0 }
  );
}
