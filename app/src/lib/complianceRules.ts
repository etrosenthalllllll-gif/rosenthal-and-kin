// Jurisdiction & Legal Compliance Rules Engine -- doc 03 section 1, PLAN.md
// P2-1. "Do not hardcode legal conclusions into application logic. Every
// rule must be data -- versioned, sourced, dated, and reviewable."
//
// **BLOCKED FOR ATTORNEY REVIEW -- see PLAN.md P2-1.** This module is
// implemented and tested per the ground rules ("implement + test, leave
// blocked for human review" for anything touching the compliance rules
// engine), but nothing here should be treated as legal advice or relied
// on to actually gate a real claim until a CA-licensed probate attorney
// has reviewed the rule table below. Doc 03 itself recommends exactly
// this: "Have a probate/estate attorney review Sections 1, 2, and 4
// specifically before they are built."
//
// Every rule below was checked directly against
// leginfo.legislature.ca.gov (the only source treated as authoritative
// here) rather than trusted from secondary summaries -- several
// secondary/SEO sources researched while building this table cited
// Cal. Prob. Code § 11004 as "the heir-finder fee-cap statute" with a
// specific "10% cap, void within 2 years" claim; that section's actual
// text (verified directly) is about personal-representative expense
// reimbursement and has nothing to do with heir-finder fees. That claim
// is NOT included below -- rather than encode a plausible-sounding but
// unverified legal fact, this file leaves CA's fee-cap question
// explicitly unresolved (see the FEE_CAP entry's reviewStatus and
// notes) and the fee-check function below fails closed accordingly.

export type RuleType =
  | "UPL_BOUNDARY"
  | "FEE_CAP"
  | "DISCLOSURE_REQUIRED"
  | "SOLICITATION_TIMING";

export type ReviewStatus =
  // The citation's text was confirmed verbatim against the official
  // legislative source, but its applicability/interpretation for this
  // business has not been signed off by an attorney.
  | "VERIFIED_CITATION"
  // A real citation exists but a specific factual claim about it
  // (a cap percentage, a waiting period, etc.) could not be confirmed
  // and needs attorney research, not just a source check.
  | "NEEDS_ATTORNEY_REVIEW";

export interface ComplianceRule {
  id: string;
  jurisdiction: string; // e.g. "CA"
  ruleType: RuleType;
  summary: string;
  citation: string;
  sourceUrl: string;
  effectiveDate: string; // ISO date; when this rule (as currently understood) took effect
  lastReviewedDate: string; // ISO date this entry was last checked against its source
  reviewedBy: string;
  reviewStatus: ReviewStatus;
  notes?: string;
}

export const STALE_REVIEW_THRESHOLD_MONTHS = 12;

// Seed table. Every entry needs a real re-review (reviewedBy currently
// says "claude-code-session", not an attorney) before any of this gates
// a real workflow -- see the module-level warning above.
export const COMPLIANCE_RULES: readonly ComplianceRule[] = [
  {
    id: "ca-upl-6125",
    jurisdiction: "CA",
    ruleType: "UPL_BOUNDARY",
    summary:
      "No person may practice law in California unless an active licensee of the State Bar. Drafting legal opinions, giving advice on a claimant's entitlement, or making representations about legal rights crosses from administrative/clerical work into practicing law.",
    citation: "Cal. Bus. & Prof. Code § 6125",
    sourceUrl:
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=6125.&lawCode=BPC",
    effectiveDate: "2019-01-01",
    lastReviewedDate: "2026-08-25",
    reviewedBy: "claude-code-session",
    reviewStatus: "VERIFIED_CITATION",
    notes:
      "Verbatim text confirmed directly against leginfo.legislature.ca.gov. Defines the boundary this UPL scanner (scanForLegalAdviceLanguage) exists to help enforce -- it does not by itself say which specific phrasings cross the line, which is a judgment call still needing attorney sign-off on the allow/deny language list.",
  },
  {
    id: "ca-upl-6126",
    jurisdiction: "CA",
    ruleType: "UPL_BOUNDARY",
    summary:
      "Practicing law (or holding oneself out as entitled to) without being an active State Bar licensee is a misdemeanor, punishable by up to a year in county jail and/or a $1,000 fine, with a mandatory minimum for repeat offenses.",
    citation: "Cal. Bus. & Prof. Code § 6126",
    sourceUrl:
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=6126.&lawCode=BPC",
    effectiveDate: "2019-01-01",
    lastReviewedDate: "2026-08-25",
    reviewedBy: "claude-code-session",
    reviewStatus: "VERIFIED_CITATION",
    notes: "Verbatim text confirmed directly against leginfo.legislature.ca.gov.",
  },
  {
    id: "ca-fee-locator-agreement-court-review",
    jurisdiction: "CA",
    ruleType: "FEE_CAP",
    summary:
      "On distribution to a transferee of a beneficiary (which covers an heir-locator's assignment/fee agreement), the probate court may inquire into the circumstances and consideration paid, and may refuse or reshape the distribution if the fee charged is 'grossly unreasonable' or the agreement was obtained by duress, fraud, or undue influence. This is a court-review standard, not a fixed statutory percentage cap.",
    citation: "Cal. Prob. Code § 11604",
    sourceUrl:
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=11604.&lawCode=PROB",
    effectiveDate: "1990-07-01",
    lastReviewedDate: "2026-08-25",
    reviewedBy: "claude-code-session",
    reviewStatus: "NEEDS_ATTORNEY_REVIEW",
    notes:
      "Verbatim text confirmed directly against leginfo.legislature.ca.gov -- it does NOT contain a specific percentage cap or a 'void within 2 years if heir already known' rule. Multiple secondary sources (law-firm blog posts) repeated a claim of a codified '10% cap, void within 2 years' rule citing Cal. Prob. Code § 11004; that section's real text (also verified directly) is about personal-representative expense reimbursement and is unrelated. Whether CA has ANY codified heir-finder fee percentage cap (as opposed to this case-by-case 'grossly unreasonable' court-review standard) is an open question this session could not resolve and should not guess at. Needs real attorney research, not another web search. checkFeeCompliance() below fails closed (BLOCK_AND_ESCALATE) for CA until this is resolved, per doc 03 §1.5: 'Where a jurisdiction has no rule on file, the default behavior must be to block automated progression and escalate.'",
  },
] as const;

export function getRulesForJurisdiction(
  jurisdiction: string,
  rules: readonly ComplianceRule[] = COMPLIANCE_RULES
): ComplianceRule[] {
  return rules.filter((r) => r.jurisdiction === jurisdiction);
}

export function getRulesByType(
  jurisdiction: string,
  ruleType: RuleType,
  rules: readonly ComplianceRule[] = COMPLIANCE_RULES
): ComplianceRule[] {
  return rules.filter((r) => r.jurisdiction === jurisdiction && r.ruleType === ruleType);
}

/**
 * A rule whose text hasn't been re-checked against its source in over
 * STALE_REVIEW_THRESHOLD_MONTHS months is flagged for re-review -- doc 03
 * §1.5's staleness requirement ("so outdated legal assumptions do not
 * silently keep running").
 */
export function isRuleStale(
  rule: ComplianceRule,
  now: Date,
  staleThresholdMonths: number = STALE_REVIEW_THRESHOLD_MONTHS
): boolean {
  const lastReviewed = new Date(rule.lastReviewedDate);
  const staleAt = new Date(lastReviewed);
  staleAt.setMonth(staleAt.getMonth() + staleThresholdMonths);
  return now.getTime() >= staleAt.getTime();
}

export interface FeeComplianceInput {
  jurisdiction: string;
  estimatedRecoveryCents: number;
  proposedFeeCents: number;
}

export type FeeComplianceAction = "PROCEED" | "BLOCK_AND_ESCALATE";

export interface FeeComplianceResult {
  action: FeeComplianceAction;
  reason: string;
  applicableRule?: ComplianceRule;
}

/**
 * Checks a proposed fee against the jurisdiction's fee-cap rule table.
 * Fails closed by design: if no VERIFIED_CITATION FEE_CAP rule with an
 * actual enforceable numeric cap exists for the jurisdiction, this
 * blocks and escalates rather than assuming the fee is permitted --
 * doc 03 §1.5's explicit default. Every CA fee-cap rule currently on
 * file is NEEDS_ATTORNEY_REVIEW (see COMPLIANCE_RULES above), so this
 * always blocks for CA today; that is correct, not a bug, until a real
 * cap rule is reviewed and added.
 */
export function checkFeeCompliance(
  input: FeeComplianceInput,
  rules: readonly ComplianceRule[] = COMPLIANCE_RULES
): FeeComplianceResult {
  const feeCapRules = getRulesByType(input.jurisdiction, "FEE_CAP", rules).filter(
    (r) => r.reviewStatus === "VERIFIED_CITATION"
  );

  if (feeCapRules.length === 0) {
    return {
      action: "BLOCK_AND_ESCALATE",
      reason: `No attorney-verified fee-cap rule on file for jurisdiction "${input.jurisdiction}". Per doc 03 §1.5, absence of a rule blocks automated progression rather than assuming the fee is permitted.`,
    };
  }

  // No cap-bearing rule type/shape defined yet (deliberately -- see
  // NEEDS_ATTORNEY_REVIEW note above). Once an attorney confirms a real
  // numeric cap, extend ComplianceRule with a structured cap field and
  // implement the actual percentage/dollar comparison here instead of
  // this placeholder branch.
  return {
    action: "BLOCK_AND_ESCALATE",
    reason: "Fee-cap rule found but has no verified enforceable cap value yet.",
    applicableRule: feeCapRules[0],
  };
}

// --- UPL boundary scanner (doc 03 §1.1) ------------------------------
//
// "The compliance engine should scan outbound claimant-facing text for
// language patterns that cross that line before send." This is a
// pattern-based first pass, not a legal-correctness guarantee -- it
// exists to catch obvious, common phrasings, and its allow/deny list
// still needs attorney sign-off (see the ca-upl-6125 rule's notes).

const LEGAL_ADVICE_PATTERNS: readonly RegExp[] = [
  /\byou (?:are|'re) (?:legally )?entitled to\b/i,
  /\byou will (?:definitely |certainly )?(?:win|receive|get|recover)\b/i,
  /\bguarantee(?:d|s)? (?:your |the |a )?(?:recovery|payment|inheritance|win)\b/i,
  /\bin (?:my|our) legal opinion\b/i,
  /\blegal advice\b/i,
  /\byour legal rights (?:are|include)\b/i,
  /\bwe (?:can|will) (?:legally )?guarantee\b/i,
];

export interface LanguageScanResult {
  flagged: boolean;
  matchedPatterns: string[];
}

export function scanForLegalAdviceLanguage(text: string): LanguageScanResult {
  const matchedPatterns = LEGAL_ADVICE_PATTERNS.filter((pattern) => pattern.test(text)).map(
    (pattern) => pattern.source
  );
  return { flagged: matchedPatterns.length > 0, matchedPatterns };
}
