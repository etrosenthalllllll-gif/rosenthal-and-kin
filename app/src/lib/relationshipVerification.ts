// Relationship claim verification -- doc 06 sections 7-8. PLAN.md P5-3.
//
// "For every proposed relationship: 1. Gather supporting evidence. 2.
// Gather potentially contradictory evidence. 3. Compare evidence. 4.
// Determine whether sources independently support the relationship. 5.
// Calculate confidence. 6. Determine whether human review is
// necessary. Possible results: STRONGLY_SUPPORTED / SUPPORTED /
// PARTIALLY_SUPPORTED / UNSUPPORTED / CONFLICTED /
// INSUFFICIENT_EVIDENCE / REQUIRES_HUMAN_REVIEW."
//
// Pure logic only, same shape as documentValidation.ts (P4-5): takes
// already-known evidence entries (from wherever they came --
// documents, research, communications, case data) and classifies. Full
// confidence *scoring* (a 0.0-1.0 number, source-quality-weighted) is
// P5-7's job; this module only produces the doc 06 section 8 status
// enum plus whether human review is warranted -- exactly what section
// 8's steps 4-6 ask for, no more.
//
// "Independent" evidence is taken as a given boolean per entry rather
// than computed here -- detecting whether two sources are actually
// independent (doc 06 section 13, "3 republications of one obituary")
// is P5-5's job; this module just needs to know the answer per entry.

export type RelationshipVerificationStatus =
  | "STRONGLY_SUPPORTED"
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "UNSUPPORTED"
  | "CONFLICTED"
  | "INSUFFICIENT_EVIDENCE";

export interface RelationshipEvidenceEntry {
  sourceId: string;
  // true: this source corroborates the claim. false: this source
  // contradicts it (doc 06 section 8's "potentially contradictory
  // evidence").
  supports: boolean;
  // Whether this source is independent of every other entry -- per
  // doc 06 section 13, three copies of the same obituary do not count
  // as three independent confirmations.
  independent: boolean;
}

export interface RelationshipVerificationResult {
  status: RelationshipVerificationStatus;
  // doc 06 section 8 step 6 -- CONFLICTED and UNSUPPORTED both warrant
  // a human look before the claim is relied on either way; this is a
  // recommendation this module makes, not a decision it enforces (that
  // wiring is P5-10's job, same "plan vs. execute" split as every
  // other plan* module in this codebase).
  requiresHumanReview: boolean;
  independentSupportingCount: number;
  contradictingCount: number;
  reason: string;
}

const STRONGLY_SUPPORTED_THRESHOLD = 3;
const SUPPORTED_THRESHOLD = 2;

/**
 * Pure: doc 06 section 8's relationship-claim classifier. Never
 * silently picks a side when evidence conflicts -- CONFLICTED is a
 * first-class outcome, not folded into SUPPORTED or UNSUPPORTED.
 */
export function verifyRelationshipClaim(
  evidence: readonly RelationshipEvidenceEntry[]
): RelationshipVerificationResult {
  if (evidence.length === 0) {
    return {
      status: "INSUFFICIENT_EVIDENCE",
      requiresHumanReview: false,
      independentSupportingCount: 0,
      contradictingCount: 0,
      reason: "No evidence has been gathered for this claim yet.",
    };
  }

  const supporting = evidence.filter((e) => e.supports);
  const contradicting = evidence.filter((e) => !e.supports);
  const independentSupportingCount = supporting.filter((e) => e.independent).length;

  if (supporting.length > 0 && contradicting.length > 0) {
    return {
      status: "CONFLICTED",
      requiresHumanReview: true,
      independentSupportingCount,
      contradictingCount: contradicting.length,
      reason: `${supporting.length} source(s) support this claim while ${contradicting.length} contradict it. Do not automatically choose one.`,
    };
  }

  if (supporting.length === 0) {
    return {
      status: "UNSUPPORTED",
      requiresHumanReview: true,
      independentSupportingCount: 0,
      contradictingCount: contradicting.length,
      reason: `${contradicting.length} source(s) contradict this claim and none support it.`,
    };
  }

  // Only supporting evidence exists -- classify by independent count.
  // Non-independent duplicates (all copies of one source) don't
  // establish sufficiency on their own, per section 13.
  if (independentSupportingCount >= STRONGLY_SUPPORTED_THRESHOLD) {
    return {
      status: "STRONGLY_SUPPORTED",
      requiresHumanReview: false,
      independentSupportingCount,
      contradictingCount: 0,
      reason: `${independentSupportingCount} independent sources support this claim with no contradiction.`,
    };
  }

  if (independentSupportingCount >= SUPPORTED_THRESHOLD) {
    return {
      status: "SUPPORTED",
      requiresHumanReview: false,
      independentSupportingCount,
      contradictingCount: 0,
      reason: `${independentSupportingCount} independent sources support this claim with no contradiction.`,
    };
  }

  if (independentSupportingCount >= 1) {
    return {
      status: "PARTIALLY_SUPPORTED",
      requiresHumanReview: false,
      independentSupportingCount,
      contradictingCount: 0,
      reason: "Only one independent source supports this claim so far.",
    };
  }

  // Supporting evidence exists but none of it is independent -- e.g.
  // three republications of the same obituary. Not the same as no
  // evidence at all, but not sufficient either.
  return {
    status: "INSUFFICIENT_EVIDENCE",
    requiresHumanReview: false,
    independentSupportingCount: 0,
    contradictingCount: 0,
    reason: "Supporting evidence exists but no source is independent of the others.",
  };
}
