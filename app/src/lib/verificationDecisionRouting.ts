// Verification decision integration -- doc 06 section 30. PLAN.md P5-10.
//
// "Integrate with the existing Decision Dashboard. When review is
// required, create a decision containing: CASE, PERSON, CLAIM,
// QUESTION, EVIDENCE, SUPPORTING SOURCES, CONFLICTING SOURCES,
// CONFIDENCE, AI RECOMMENDATION, POSSIBLE ALTERNATIVES, RECOMMENDED
// NEXT STEP."
//
// Same wiring-layer role as documentDecisionRouting.ts (P4-14): takes
// the outputs identityResolution.ts (P5-2), relationshipVerification.ts
// (P5-3), and competingHeirDetection.ts (P5-8) already produce and
// turns each into a DecisionRecommendation against decisionTypes.ts's
// registry. Pure -- no live Decision row created here, same
// "plan now, a caller wires the real DB write later" split as every
// other plan* module in this codebase.

import type { DecisionTypeKey } from "./decisionTypes";
import type { IdentityMatchResult } from "./identityResolution";
import type { RelationshipVerificationResult } from "./relationshipVerification";
import type { CompetingHeirAssessment } from "./competingHeirDetection";

export interface DecisionRecommendation {
  decisionTypeKey: DecisionTypeKey;
  reason: string;
  evidenceRefs: string[];
}

/**
 * Pure: doc 06 section 3 -- a POSSIBLE_MATCH identity result is
 * exactly "two people could plausibly match" and needs a human
 * decision; LIKELY_SAME_PERSON/LIKELY_DIFFERENT_PERSON are clear
 * enough not to, and INSUFFICIENT_EVIDENCE simply isn't a match claim
 * yet (nothing to resolve until more evidence exists).
 */
export function planIdentityVerificationDecision(
  personAId: string,
  personBId: string,
  result: IdentityMatchResult
): DecisionRecommendation | null {
  if (result.outcome !== "POSSIBLE_MATCH") {
    return null;
  }

  return {
    decisionTypeKey: "RESOLVE_IDENTITY_VERIFICATION",
    reason: `Identity match between these two records is ambiguous (score ${result.matchScore.toFixed(
      2
    )}) -- doc 06: never merge automatically when evidence is ambiguous.`,
    evidenceRefs: [personAId, personBId],
  };
}

/**
 * Pure: doc 06 section 8 -- a relationship claim result that
 * requiresHumanReview (CONFLICTED or UNSUPPORTED) becomes a decision;
 * STRONGLY_SUPPORTED/SUPPORTED/PARTIALLY_SUPPORTED don't need one.
 */
export function planRelationshipVerificationDecision(
  claimId: string,
  result: RelationshipVerificationResult
): DecisionRecommendation | null {
  if (!result.requiresHumanReview) {
    return null;
  }

  return {
    decisionTypeKey: "RESOLVE_RELATIONSHIP_VERIFICATION",
    reason: result.reason,
    evidenceRefs: [claimId],
  };
}

/**
 * Pure: doc 06 sections 20-23 -- a competing-heir candidate assessed
 * as REQUIRES_REVIEW becomes a decision; POTENTIAL (too weak to act on
 * yet, per the false-positive control) does not.
 */
export function planCompetingHeirDecision(
  assessment: CompetingHeirAssessment
): DecisionRecommendation | null {
  if (assessment.status !== "REQUIRES_REVIEW") {
    return null;
  }

  return {
    decisionTypeKey: "REVIEW_COMPETING_HEIR_CANDIDATE",
    reason: assessment.reason,
    evidenceRefs: [assessment.personId],
  };
}
