// Multiple beneficiaries + distribution approval + statement -- doc 10
// sections 14-16. PLAN.md P9-5.
//
// "Support multiple beneficiaries, each independently trackable.
// Before distributing funds, require configured approval -- do not
// automatically distribute funds based solely on AI output. Generate a
// clear distribution statement referencing the underlying recovery and
// calculation versions."
//
// Multi-beneficiary allocation itself is distributionEngine.ts's
// (P9-4) job -- this module adds the two things doc 10 sections 15-16
// ask for on top of that: routing an unapproved distribution into the
// existing Decision Dashboard (same wiring-layer role as every other
// *DecisionRouting.ts module) and building the human-readable
// statement.

import type { DecisionTypeKey } from "./decisionTypes";
import type { BeneficiaryDistributionResult } from "./distributionEngine";

export interface DecisionRecommendation {
  decisionTypeKey: DecisionTypeKey;
  reason: string;
  evidenceRefs: string[];
}

/**
 * Pure: doc 10 section 15. Every distribution requires explicit
 * approval before funds move -- there's no "auto-approve" path here at
 * all, since the doc's own instruction is unconditional ("do not
 * automatically distribute funds based solely on AI output").
 */
export function planDistributionApprovalDecision(
  distributionId: string,
  recoveryId: string
): DecisionRecommendation {
  return {
    decisionTypeKey: "APPROVE_DISTRIBUTION",
    reason: "Calculated distribution requires operator approval before funds move.",
    evidenceRefs: [distributionId, recoveryId],
  };
}

export interface DistributionStatementInput {
  recoveryId: string;
  recoveryVersion: number;
  distributionVersion: number;
  grossRecoveryCents: number;
  deductionsCents: number;
  feesCents: number;
  expensesCents: number;
  netDistributableCents: number;
  beneficiaries: readonly BeneficiaryDistributionResult[];
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Pure: doc 10 section 16. Always names the exact recovery/
 * distribution versions it was generated from, so the statement can be
 * traced back to a specific calculation rather than "the current
 * numbers, whatever those are."
 */
export function buildDistributionStatement(input: DistributionStatementInput): string {
  const lines: string[] = [];
  lines.push(`DISTRIBUTION STATEMENT (recovery ${input.recoveryId} v${input.recoveryVersion}, distribution v${input.distributionVersion})`);
  lines.push("");
  lines.push(`RECOVERY: ${formatCents(input.grossRecoveryCents)}`);
  lines.push(`AUTHORIZED DEDUCTIONS: ${formatCents(input.deductionsCents)}`);
  lines.push(`FEE: ${formatCents(input.feesCents)}`);
  lines.push(`EXPENSES: ${formatCents(input.expensesCents)}`);
  lines.push(`NET DISTRIBUTION: ${formatCents(input.netDistributableCents)}`);
  lines.push("");
  lines.push("BENEFICIARIES:");
  for (const b of input.beneficiaries) {
    lines.push(`- ${b.claimantId}: ${b.percent}% = ${formatCents(b.distributionAmountCents)}`);
  }
  return lines.join("\n");
}
