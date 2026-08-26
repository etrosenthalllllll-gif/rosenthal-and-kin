// Jurisdiction & Legal Compliance Rules Engine -- doc 03 section 1, PLAN.md
// P2-1. "Do not hardcode legal conclusions into application logic. Every
// rule must be data -- versioned, sourced, dated, and reviewable."
//
// **Owner-approved override of the attorney-review recommendation --
// see PLAN.md P2-1.** Doc 03 recommends "have a probate/estate attorney
// review Sections 1, 2, and 4 ... before they are built," and the
// ground rules say never mark this done on Claude's own judgment. Ethan
// (the business owner) explicitly overrode that and approved this
// module on 2026-08-25 rather than waiting for a licensed attorney's
// sign-off -- that is a real business/legal risk he is choosing to
// accept for his own venture, not a substitute for one. Nothing here
// should be represented to a claimant or court as attorney-reviewed
// legal advice.
//
// Every rule below was checked directly against
// leginfo.legislature.ca.gov (the only source treated as authoritative
// here) rather than trusted from secondary summaries. That discipline
// paid off twice in this file's research:
//
// 1. Several secondary/SEO sources cited Cal. Prob. Code § 11004 as
//    "the heir-finder fee-cap statute" with a specific "10% cap, void
//    within 2 years" claim; that section's actual text (verified
//    directly) is about personal-representative expense reimbursement
//    and has nothing to do with heir-finder fees. Not included below.
//
// 2. The same sources' "10%" figure turned out to be real, but
//    misattributed -- it's Cal. Code Civ. Proc. § 1582, and it applies
//    only to agreements to help recover property already reported to
//    the State Controller as UNCLAIMED PROPERTY (Unclaimed Property
//    Law, CCP § 1530), not to probate-estate heir-locator assignments.
//    For probate estates -- this business's actual model, per
//    Estate.probateCaseNumber in the schema -- the applicable rule is
//    Cal. Prob. Code §§ 11604/11604.5: mandatory written disclosure,
//    court filing, no agency/recourse clauses, and a case-by-case
//    "grossly unreasonable" court-review standard -- CA has never
//    codified a fixed percentage cap for that scenario. Both rules are
//    modeled below since either could apply depending on where a given
//    case's asset actually sits.

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
  // Only set when the rule is a real, verified, fixed numeric cap (as
  // opposed to a case-by-case court-review standard like Prob. Code
  // § 11604's "grossly unreasonable" test, which has no fixed number).
  capPercent?: number;
  // Which of this business's two possible asset postures the rule
  // applies to -- see AssetSource below. Only meaningful for FEE_CAP
  // rules; omitted for rules that apply regardless (UPL boundary).
  assetSource?: AssetSource;
}

// The two situations a claimant's recoverable asset can actually be in,
// per the real research below -- CA regulates heir-locator fees
// differently depending on which one applies, so the fee-compliance
// check needs to know which regime it's checking against rather than
// asking one undifferentiated "CA" question.
export type AssetSource =
  | "PROBATE_ESTATE" // asset is part of an active probate estate (this business's normal case -- see Estate.probateCaseNumber)
  | "STATE_CONTROLLER_UNCLAIMED_PROPERTY"; // asset has already escheated and sits with the CA State Controller's Unclaimed Property program

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
    assetSource: "PROBATE_ESTATE",
    summary:
      "On distribution to a transferee of a beneficiary (which covers an heir-locator's assignment/fee agreement), the probate court may inquire into the circumstances and consideration paid, and may refuse or reshape the distribution if the fee charged is 'grossly unreasonable' or the agreement was obtained by duress, fraud, or undue influence. This is a case-by-case court-review standard -- CA has never codified a fixed percentage cap for probate-estate heir-locator fees (confirmed by direct research, not merely unresolved).",
    citation: "Cal. Prob. Code § 11604",
    sourceUrl:
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=11604.&lawCode=PROB",
    effectiveDate: "1990-07-01",
    lastReviewedDate: "2026-08-25",
    reviewedBy: "claude-code-session",
    reviewStatus: "VERIFIED_CITATION",
    notes:
      "Verbatim text confirmed directly against leginfo.legislature.ca.gov -- it does NOT contain a specific percentage cap or a 'void within 2 years if heir already known' rule. Multiple secondary sources (law-firm blog posts) repeated a claim of a codified '10% cap, void within 2 years' rule citing Cal. Prob. Code § 11004; that section's real text (also verified directly) is about personal-representative expense reimbursement and is unrelated. A second research pass (2026-08-25, after Ethan overrode the attorney-review block and asked for the law to actually be checked) traced that same '10%' figure to a REAL but misattributed statute -- see ccp-1582-unclaimed-property-fee-cap below -- and confirmed via Cal. Prob. Code § 11604.5 (companion section, also verified directly) that the probate-estate regime is disclosure-and-court-review, not a fixed cap. Since this is now a confirmed conclusion rather than an open question, checkFeeCompliance() reports BLOCK_AND_ESCALATE for PROBATE_ESTATE cases as the *correct permanent behavior* (the law itself requires human/court judgment on 'grossly unreasonable'), not as a placeholder pending more research.",
  },
  {
    id: "ca-prob-11604-5-disclosure",
    jurisdiction: "CA",
    ruleType: "DISCLOSURE_REQUIRED",
    assetSource: "PROBATE_ESTATE",
    summary:
      "A written agreement assigning a probate beneficiary's interest to a transferee-for-value (i.e. an heir-locator fee/assignment agreement) must: be filed with the probate court within 30 days of execution and at least 15 days before the final-distribution hearing; disclose the total of all costs/fees in at least 10-point type; and must NOT grant the transferee agency/representation powers over the beneficiary's interest, or recourse against the beneficiary if the actual distribution is less than the assigned interest.",
    citation: "Cal. Prob. Code § 11604.5",
    sourceUrl:
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=11604.5.&lawCode=PROB",
    effectiveDate: "1990-07-01",
    lastReviewedDate: "2026-08-25",
    reviewedBy: "claude-code-session",
    reviewStatus: "VERIFIED_CITATION",
    notes:
      "Verbatim text confirmed directly against leginfo.legislature.ca.gov. This is the actual disclosure regime the doc 03 §1.4 engagement-agreement generator (P2-2) needs to read from for probate-estate cases -- the specific '10-point type,' '30-day filing,' and 'no agency/recourse clause' requirements are structural template requirements, not just prose to restate.",
  },
  {
    id: "ccp-1582-unclaimed-property-fee-cap",
    jurisdiction: "CA",
    ruleType: "FEE_CAP",
    assetSource: "STATE_CONTROLLER_UNCLAIMED_PROPERTY",
    capPercent: 10,
    summary:
      "An agreement to locate, recover, or assist in recovering property already reported to the CA State Controller as unclaimed property may not charge more than 10% of the recovered property's value, must be in writing with full disclosure, must be signed by the owner AFTER disclosure, and is void outright if it requires payment before the Controller approves the claim.",
    citation: "Cal. Code Civ. Proc. § 1582",
    sourceUrl:
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1582.&lawCode=CCP",
    effectiveDate: "1988-01-01",
    lastReviewedDate: "2026-08-25",
    reviewedBy: "claude-code-session",
    reviewStatus: "VERIFIED_CITATION",
    notes:
      "Verbatim text confirmed directly against leginfo.legislature.ca.gov. This IS a real, fixed 10% statutory cap -- but it only applies when the asset is already sitting with the State Controller's Unclaimed Property program (CCP § 1530), not to an active probate estate. Do not apply this cap to a PROBATE_ESTATE case; see ca-fee-locator-agreement-court-review above for that scenario instead.",
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
  // Which regime applies to this specific case's asset -- see
  // AssetSource above. Required, not defaulted: guessing wrong here is
  // exactly the kind of error this engine exists to prevent.
  assetSource: AssetSource;
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
 * Checks a proposed fee against the jurisdiction's fee-cap rule table,
 * scoped to the case's actual asset posture (see AssetSource).
 *
 * - STATE_CONTROLLER_UNCLAIMED_PROPERTY: CA has a real, verified fixed
 *   10% cap (CCP § 1582). Enforced numerically below.
 * - PROBATE_ESTATE: CA has no fixed cap -- fee reasonableness is a
 *   case-by-case court determination (Prob. Code § 11604). This isn't
 *   a gap pending more research; it's confirmed, permanent behavior.
 *   Fails closed (BLOCK_AND_ESCALATE) because an automated pass/fail
 *   can't stand in for the court's "grossly unreasonable" judgment call
 *   -- doc 03 §1.5's explicit default for exactly this situation.
 * - Any jurisdiction/assetSource combination with no rule on file at
 *   all also fails closed, same reasoning.
 */
export function checkFeeCompliance(
  input: FeeComplianceInput,
  rules: readonly ComplianceRule[] = COMPLIANCE_RULES
): FeeComplianceResult {
  const feeCapRules = getRulesByType(input.jurisdiction, "FEE_CAP", rules).filter(
    (r) => r.reviewStatus === "VERIFIED_CITATION" && r.assetSource === input.assetSource
  );

  if (feeCapRules.length === 0) {
    return {
      action: "BLOCK_AND_ESCALATE",
      reason: `No verified fee-cap rule on file for jurisdiction "${input.jurisdiction}" / asset source "${input.assetSource}". Per doc 03 §1.5, absence of a rule blocks automated progression rather than assuming the fee is permitted.`,
    };
  }

  const rule = feeCapRules[0];

  if (rule.capPercent == null) {
    // A verified rule exists for this posture but it's a court-review
    // standard, not a fixed number (e.g. Prob. Code § 11604's "grossly
    // unreasonable" test) -- no automated percentage check applies.
    return {
      action: "BLOCK_AND_ESCALATE",
      reason: `${rule.citation} governs this case but sets a case-by-case court-review standard, not a fixed cap -- requires human/legal judgment, not an automated check.`,
      applicableRule: rule,
    };
  }

  if (input.estimatedRecoveryCents <= 0) {
    return {
      action: "BLOCK_AND_ESCALATE",
      reason: "Cannot evaluate a fee cap against a zero or negative estimated recovery.",
      applicableRule: rule,
    };
  }

  const feePercent = (input.proposedFeeCents / input.estimatedRecoveryCents) * 100;
  if (feePercent > rule.capPercent) {
    return {
      action: "BLOCK_AND_ESCALATE",
      reason: `Proposed fee is ${feePercent.toFixed(1)}% of estimated recovery, exceeding the ${rule.capPercent}% cap under ${rule.citation}.`,
      applicableRule: rule,
    };
  }

  return {
    action: "PROCEED",
    reason: `Proposed fee is ${feePercent.toFixed(1)}% of estimated recovery, within the ${rule.capPercent}% cap under ${rule.citation}.`,
    applicableRule: rule,
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
