// Confidence scoring engine -- doc 06 sections 17-19. PLAN.md P5-7.
//
// "Build a structured confidence engine. Confidence should consider:
// Number of supporting sources, Source quality, Source independence,
// Agreement between sources, Directness of evidence, Identity match
// confidence, Document confidence, Extraction confidence, Conflicting
// evidence, Evidence age where relevant, Completeness of evidence,
// Relationship path consistency. Do NOT simply calculate: confidence =
// number of documents. The confidence engine should be explainable...
// Store the components contributing to confidence." / "Make confidence
// appear more precise than the evidence warrants [is prohibited] --
// the system must preserve the underlying components."
//
// This module composes scores every earlier P5 module already
// produces (identityResolution.ts's matchScore, crossSourceComparison.ts's
// independent-source count, relationshipVerification.ts/conflictDetection.ts's
// conflict findings) into one explainable, weighted final score --
// never invents its own signal detection, only combines what already
// exists. Calibration (doc 06 section 19 -- comparing predicted
// confidence against eventual human/final outcomes) is intentionally
// NOT built here: there's no real decision-outcome history yet to
// calibrate against, and fabricating one would violate this project's
// "don't fake what doesn't exist upstream" discipline. Revisit once
// enough real Decision resolutions exist to compare against.

export type ConfidenceComponentKey =
  | "identityMatch"
  | "sourceQuality"
  | "sourceIndependence"
  | "crossSourceAgreement"
  | "documentConfidence"
  | "extractionConfidence"
  | "relationshipPathConsistency";

// Relative weights -- a config table, not inline arithmetic, same
// discipline as MATCH_SIGNAL_WEIGHTS/IDENTITY_SIGNAL_WEIGHTS elsewhere
// in this codebase. Only components the caller actually supplies
// contribute (see computeConfidenceScore); these weights are relative
// to each other, re-normalized over whichever subset is present.
export const CONFIDENCE_COMPONENT_WEIGHTS: Record<ConfidenceComponentKey, number> = {
  identityMatch: 0.25,
  crossSourceAgreement: 0.2,
  sourceQuality: 0.15,
  sourceIndependence: 0.15,
  documentConfidence: 0.1,
  extractionConfidence: 0.1,
  relationshipPathConsistency: 0.05,
};

export type ConfidenceInputs = Partial<Record<ConfidenceComponentKey, number>>;

export interface ConfidenceComponentBreakdown {
  key: ConfidenceComponentKey;
  value: number;
  weight: number;
}

export interface ConfidenceScoreResult {
  score: number; // 0.0-1.0, final system confidence
  // doc 06 section 18: every component that went into the score, kept
  // alongside it -- never collapse to a bare number and discard how it
  // was reached.
  components: ConfidenceComponentBreakdown[];
  conflictPenalty: number;
}

/**
 * Pure: doc 06 sections 17-18. Combines whichever named confidence
 * components the caller actually has (never requires all of them --
 * e.g. a claim with no document evidence simply omits
 * documentConfidence/extractionConfidence) into one explainable score.
 * `conflictPenalty` (0.0-1.0) is subtracted after the weighted average,
 * not folded into a component weight, so it's always visible as its
 * own line in the result -- doc 06's own worked example lists
 * "Conflict penalty: 0.00" separately from the other components.
 */
export function computeConfidenceScore(
  inputs: ConfidenceInputs,
  conflictPenalty = 0
): ConfidenceScoreResult {
  const components: ConfidenceComponentBreakdown[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of Object.keys(CONFIDENCE_COMPONENT_WEIGHTS) as ConfidenceComponentKey[]) {
    const value = inputs[key];
    if (value === undefined) continue;

    const weight = CONFIDENCE_COMPONENT_WEIGHTS[key];
    components.push({ key, value, weight });
    weightedSum += value * weight;
    totalWeight += weight;
  }

  const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const score = Math.max(0, Math.min(1, baseScore - conflictPenalty));

  return { score, components, conflictPenalty };
}
