// Contribution margin + profit analytics -- doc 13 sections 47-48.
// PLAN.md P12-17.
//
// "Contribution margin = revenue − variable costs (per case and as a
// percentage of revenue). This tells you the true incremental economics
// of taking on one more case, separate from fixed overhead." / "Never
// label a number 'profit' without stating exactly which costs were
// subtracted. Distinguish: gross profit (revenue − direct/variable
// costs), net contribution (gross profit − allocated fixed costs),
// net profit (net contribution − overhead/other)."

// --- Contribution margin (doc 13 §47) ---------------------------------------

export interface ContributionMarginInputs {
  revenueCents: number;
  variableCostsCents: number;
}

export interface ContributionMarginReport {
  contributionMarginCents: number;
  contributionMarginPercent: number | null;
}

export function computeContributionMargin(inputs: ContributionMarginInputs): ContributionMarginReport {
  const contributionMarginCents = inputs.revenueCents - inputs.variableCostsCents;
  return {
    contributionMarginCents,
    contributionMarginPercent: inputs.revenueCents !== 0 ? Math.round((contributionMarginCents / inputs.revenueCents) * 1000) / 10 : null,
  };
}

// --- Profit rollup, every figure explicitly labeled (doc 13 §48) -----------

export interface ProfitRollupInputs {
  revenueCents: number;
  directVariableCostsCents: number;
  allocatedFixedCostsCents: number;
  overheadCents: number;
}

export interface ProfitRollup {
  /** revenue - direct/variable costs */
  grossProfitCents: number;
  /** grossProfit - allocated fixed costs */
  netContributionCents: number;
  /** netContribution - overhead/other */
  netProfitCents: number;
  costsSubtracted: {
    grossProfit: string;
    netContribution: string;
    netProfit: string;
  };
}

/**
 * Pure: doc 13 §48 -- "never label a number 'profit' without stating
 * exactly which costs were subtracted." Every level of the rollup
 * carries a `costsSubtracted` label alongside it so a caller can never
 * present, say, gross profit as if it were net profit.
 */
export function computeProfitRollup(inputs: ProfitRollupInputs): ProfitRollup {
  const grossProfitCents = inputs.revenueCents - inputs.directVariableCostsCents;
  const netContributionCents = grossProfitCents - inputs.allocatedFixedCostsCents;
  const netProfitCents = netContributionCents - inputs.overheadCents;
  return {
    grossProfitCents,
    netContributionCents,
    netProfitCents,
    costsSubtracted: {
      grossProfit: "direct/variable costs",
      netContribution: "direct/variable costs + allocated fixed costs",
      netProfit: "direct/variable costs + allocated fixed costs + overhead/other",
    },
  };
}
