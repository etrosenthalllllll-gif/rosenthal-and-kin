// Jurisdiction determination -- doc 07 section 3. PLAN.md P6-3.
//
// "Build a jurisdiction determination workflow. Potential jurisdiction
// signals may include: Location of property/asset, Holder
// jurisdiction, Decedent domicile, Claimant location, Estate location,
// Court jurisdiction, Filing authority, Claim type, Applicable agency.
// Do not assume jurisdiction solely from claimant address. The system
// should evaluate all configured jurisdiction signals. Return:
// JURISDICTION / CONFIDENCE / REASONS. If multiple jurisdictions are
// plausible: CREATE HUMAN REVIEW."
//
// Same confidence-scored, never-guess shape as matchConversationToCase.ts
// (P3-2) / matchDocumentToCase.ts (P4-4) / identityResolution.ts
// (P5-2) -- multiple independent signals, each weighted, ambiguity
// routes to human review rather than picking a jurisdiction. Pure
// logic only, no DB access.

// doc 07 section 3's own signal list, verbatim.
export type JurisdictionSignalType =
  | "ASSET_LOCATION"
  | "HOLDER_JURISDICTION"
  | "DECEDENT_DOMICILE"
  | "CLAIMANT_LOCATION"
  | "ESTATE_LOCATION"
  | "COURT_JURISDICTION"
  | "FILING_AUTHORITY"
  | "APPLICABLE_AGENCY";

export interface JurisdictionSignal {
  type: JurisdictionSignalType;
  jurisdiction: string; // e.g. "CA"
}

export interface JurisdictionCandidateScore {
  jurisdiction: string;
  confidence: number; // 0.0-1.0
  reasons: string[];
}

export interface JurisdictionDeterminationResult {
  // Best-scoring candidate, or null when there was no signal at all to
  // even guess from -- never a default jurisdiction.
  jurisdiction: string | null;
  confidence: number; // 0 when jurisdiction is null
  reasons: string[];
  // doc 07 section 3: "If multiple jurisdictions are plausible: CREATE
  // HUMAN REVIEW." Also true when there's no signal, or the single
  // best candidate isn't confident enough to act on alone -- this
  // module never lets a caller silently proceed on a guess.
  requiresHumanReview: boolean;
  // Every scored candidate, not just the winner, so a human reviewer
  // sees the full picture rather than one opaque number.
  candidates: JurisdictionCandidateScore[];
}

// Not hardcoded inline -- same config-table discipline as every other
// signal-weight table in this codebase. Asset location and holder
// jurisdiction are doc 07's own strongest cited signals (most
// unclaimed-property regimes key off where the property is held);
// claimant location is deliberately the weakest signal, matching
// section 3's explicit warning not to assume jurisdiction solely from
// claimant address.
export const JURISDICTION_SIGNAL_WEIGHTS: Record<JurisdictionSignalType, number> = {
  ASSET_LOCATION: 0.3,
  HOLDER_JURISDICTION: 0.3,
  DECEDENT_DOMICILE: 0.25,
  COURT_JURISDICTION: 0.25,
  FILING_AUTHORITY: 0.2,
  APPLICABLE_AGENCY: 0.15,
  ESTATE_LOCATION: 0.15,
  CLAIMANT_LOCATION: 0.05,
};

export const DETERMINED_THRESHOLD = 0.5;
export const PLAUSIBLE_THRESHOLD = 0.05;

/**
 * Pure: doc 07 section 3. Scores every jurisdiction named by at least
 * one signal and returns the best candidate alongside a
 * `requiresHumanReview` flag -- true whenever more than one
 * jurisdiction is plausible, the best candidate isn't confident enough
 * on its own, or there was no signal at all.
 */
export function determineJurisdiction(
  signals: readonly JurisdictionSignal[]
): JurisdictionDeterminationResult {
  if (signals.length === 0) {
    return { jurisdiction: null, confidence: 0, reasons: [], requiresHumanReview: true, candidates: [] };
  }

  const scores = new Map<string, { confidence: number; reasons: string[] }>();

  for (const signal of signals) {
    const weight = JURISDICTION_SIGNAL_WEIGHTS[signal.type];
    const existing = scores.get(signal.jurisdiction) ?? { confidence: 0, reasons: [] };
    existing.confidence = Math.min(1, existing.confidence + weight);
    existing.reasons.push(`${signal.type} points to ${signal.jurisdiction}`);
    scores.set(signal.jurisdiction, existing);
  }

  const candidates: JurisdictionCandidateScore[] = Array.from(scores.entries())
    .map(([jurisdiction, { confidence, reasons }]) => ({ jurisdiction, confidence, reasons }))
    .sort((a, b) => b.confidence - a.confidence);

  const top = candidates[0];
  const plausibleCount = candidates.filter((c) => c.confidence >= PLAUSIBLE_THRESHOLD).length;
  const requiresHumanReview = plausibleCount > 1 || top.confidence < DETERMINED_THRESHOLD;

  return {
    jurisdiction: top.jurisdiction,
    confidence: top.confidence,
    reasons: top.reasons,
    requiresHumanReview,
    candidates,
  };
}
