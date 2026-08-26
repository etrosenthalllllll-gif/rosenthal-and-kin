// Engagement/fee agreement generator -- doc 03 section 1.4, PLAN.md P2-2.
// "The engagement/fee agreement generator must pull the applicable
// disclosures, caps, and rescission terms for the claimant's
// jurisdiction at the time the agreement is generated, and must record
// which version of the rule set was used, since these statutes
// change... If a case's estimated recovery and computed fee would
// exceed the jurisdiction's cap, or a required disclosure is missing
// from the template on file, the case must be blocked from moving to
// 'Engaged' ... rather than proceeding with an out-of-compliance
// agreement."
//
// Reads exclusively from complianceRules.ts -- "a single source of
// truth, not separate hardcoded percentages in two modules." Same
// owner-approved-override status as P2-1 (see that file's header):
// implemented and tested, not attorney-reviewed.
//
// Design note on what "blocked" means here: the agreement TEXT can
// still be generated whenever the applicable disclosure content is
// known (so a human/operator has something concrete to review) -- what
// gets blocked is advancing the claimant to "Engaged" when the fee
// can't be automatically cleared. For CA probate estates that's every
// case today (Prob. Code § 11604's fee-reasonableness standard is a
// court's case-by-case call, not a number this code can check), which
// is the correct, permanent behavior, not a bug -- see checkFeeCompliance()'s
// own doc comment.

import {
  getRulesByType,
  checkFeeCompliance,
  type AssetSource,
  type ComplianceRule,
  type FeeComplianceResult,
} from "./complianceRules";

export interface EngagementAgreementInput {
  jurisdiction: string;
  assetSource: AssetSource;
  claimantName: string;
  decedentName: string;
  caseNumber: string;
  estimatedRecoveryCents: number;
  proposedFeeCents: number;
  agreementDate: string; // ISO date this agreement is being generated
}

// doc 03 §1.4: "must record which version of the rule set was used,
// since these statutes change" -- a snapshot of exactly which rule(s)
// backed this specific agreement, so a later statute change doesn't
// retroactively (and silently) change what an already-issued agreement
// claims to be based on.
export interface RuleVersionRecord {
  id: string;
  citation: string;
  lastReviewedDate: string;
}

export interface EngagementAgreementResult {
  // The drafted agreement text, present whenever at least one verified
  // disclosure/fee-cap rule exists for this jurisdiction/assetSource to
  // draft from -- null if nothing is on file at all (nothing to build
  // from, not even a court-review standard).
  agreementText: string | null;
  feeCompliance: FeeComplianceResult;
  // Only true when checkFeeCompliance() returned PROCEED -- i.e. a
  // fixed, verified cap exists and this fee is within it. A
  // case-by-case court-review standard (the CA probate-estate default)
  // never auto-clears this, by design.
  canAdvanceToEngaged: boolean;
  rulesUsed: RuleVersionRecord[];
}

function toRuleVersionRecord(rule: ComplianceRule): RuleVersionRecord {
  return { id: rule.id, citation: rule.citation, lastReviewedDate: rule.lastReviewedDate };
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function buildAgreementText(
  input: EngagementAgreementInput,
  disclosureRules: readonly ComplianceRule[],
  feeResult: FeeComplianceResult
): string {
  const lines: string[] = [];
  lines.push(`ENGAGEMENT AND FEE AGREEMENT -- DRAFT (generated ${input.agreementDate})`);
  lines.push("");
  lines.push(`Estate/Case: ${input.decedentName} (${input.caseNumber})`);
  lines.push(`Claimant: ${input.claimantName}`);
  lines.push(`Estimated recovery: ${formatMoney(input.estimatedRecoveryCents)}`);
  lines.push(`Proposed fee: ${formatMoney(input.proposedFeeCents)}`);
  lines.push("");
  lines.push("REQUIRED DISCLOSURES (per the rules below):");
  for (const rule of disclosureRules) {
    lines.push(`- [${rule.citation}] ${rule.summary}`);
  }
  lines.push("");
  lines.push("FEE COMPLIANCE STATUS:");
  lines.push(`- ${feeResult.reason}`);
  lines.push("");
  lines.push(
    "RESCISSION/CANCELLATION RIGHTS: none identified in the verified statutory sources on file for this jurisdiction/asset source. Do not represent a cooling-off or rescission period to the claimant unless a specific rule for it is added here with its own citation."
  );
  lines.push("");
  lines.push(
    "This draft was generated from unreviewed compliance data (owner-approved override, not attorney-reviewed -- see complianceRules.ts). It must not be sent to a claimant or filed with a court without human review."
  );
  return lines.join("\n");
}

export function generateEngagementAgreement(
  input: EngagementAgreementInput,
  rules?: readonly ComplianceRule[]
): EngagementAgreementResult {
  const disclosureRules = getRulesByType(input.jurisdiction, "DISCLOSURE_REQUIRED", rules).filter(
    (r) => r.assetSource === input.assetSource && r.reviewStatus === "VERIFIED_CITATION"
  );
  const feeCapRules = getRulesByType(input.jurisdiction, "FEE_CAP", rules).filter(
    (r) => r.assetSource === input.assetSource && r.reviewStatus === "VERIFIED_CITATION"
  );

  const feeCompliance = checkFeeCompliance(
    {
      jurisdiction: input.jurisdiction,
      assetSource: input.assetSource,
      estimatedRecoveryCents: input.estimatedRecoveryCents,
      proposedFeeCents: input.proposedFeeCents,
    },
    rules
  );

  // Anything that actually backed this draft, deduplicated -- the
  // fee-cap rule feeCompliance already resolved plus whatever
  // disclosure rules apply, so an operator can see exactly which
  // statute versions produced this specific document.
  const usedRuleIds = new Set<string>();
  const rulesUsed: RuleVersionRecord[] = [];
  for (const rule of [...disclosureRules, ...feeCapRules]) {
    if (!usedRuleIds.has(rule.id)) {
      usedRuleIds.add(rule.id);
      rulesUsed.push(toRuleVersionRecord(rule));
    }
  }

  const hasSomethingToDraftFrom = disclosureRules.length > 0 || feeCapRules.length > 0;

  return {
    agreementText: hasSomethingToDraftFrom
      ? buildAgreementText(input, disclosureRules, feeCompliance)
      : null,
    feeCompliance,
    canAdvanceToEngaged: feeCompliance.action === "PROCEED",
    rulesUsed,
  };
}
