// Competing-heir detection -- doc 06 sections 20-24. PLAN.md P5-8.
//
// "Build a competing-heir discovery and analysis system... Create:
// POTENTIAL_COMPETING_HEIR. Do not automatically conclude that the
// person is legally entitled." / "Competing-heir detection should be
// conservative. Do not flag someone simply because: They share a
// surname. They live in the same city. They have a similar name...
// Require multiple corroborating signals... Same name only: LOW
// CONFIDENCE. Same name + DOB + address: HIGHER CONFIDENCE. Document
// explicitly identifying relationship: MUCH STRONGER EVIDENCE." /
// "Support negative evidence carefully... Represent: NO_EVIDENCE_FOUND
// separately from: EVIDENCE_OF_ABSENCE."
//
// Pure classification only -- no DB access. Deliberately does NOT
// itself search public/genealogical records for candidates (that's a
// research-source integration, not this module's job); it takes
// whatever candidate signals already exist and decides how much
// confidence they warrant, per section 23's explicit anti-false-
// positive rule.

export type CompetingHeirSignal =
  | "SHARED_SURNAME"
  | "SHARED_ADDRESS"
  | "MATCHING_DOB"
  | "DOCUMENT_NAMES_RELATIONSHIP" // e.g. probate record or obituary explicitly identifies the relationship
  | "OTHER_CORROBORATING_EVIDENCE";

export interface CompetingHeirCandidateSignals {
  personId: string;
  signals: readonly CompetingHeirSignal[];
}

export type CompetingHeirConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface CompetingHeirAssessment {
  personId: string;
  // doc 06 section 21's own status list -- POTENTIAL is the only status
  // this pure classifier ever assigns; DISPUTED/RULED_OUT/
  // CONFIRMED_BY_OPERATOR are all human/workflow-driven transitions
  // this module doesn't perform.
  status: "POTENTIAL" | "REQUIRES_REVIEW";
  confidence: CompetingHeirConfidenceLevel;
  signals: readonly CompetingHeirSignal[];
  reason: string;
}

// doc 06 section 23's own escalation ladder, verbatim: a document that
// explicitly identifies the relationship is immediately strong
// evidence on its own; a shared surname alone is never enough by
// itself, no matter how many "weak" signals accumulate alongside it.
const STRONG_SIGNALS: ReadonlySet<CompetingHeirSignal> = new Set([
  "DOCUMENT_NAMES_RELATIONSHIP",
]);

/**
 * Pure: doc 06 section 23's false-positive control. A shared surname
 * (or any single weak signal) alone is never sufficient -- multiple
 * corroborating signals are required, or one signal doc 06 itself
 * calls "much stronger evidence" (an explicit document).
 */
export function assessCompetingHeirCandidate(
  candidate: CompetingHeirCandidateSignals
): CompetingHeirAssessment {
  const { personId, signals } = candidate;

  if (signals.length === 0) {
    return {
      personId,
      status: "POTENTIAL",
      confidence: "LOW",
      signals,
      reason: "No corroborating signals found -- insufficient to treat as a competing heir candidate.",
    };
  }

  const hasStrongSignal = signals.some((s) => STRONG_SIGNALS.has(s));
  if (hasStrongSignal) {
    return {
      personId,
      status: "REQUIRES_REVIEW",
      confidence: "HIGH",
      signals,
      reason: "A document explicitly identifies this relationship -- doc 06's own 'much stronger evidence' case.",
    };
  }

  // Only weak, corroborating (non-document) signals -- doc 06 section
  // 23's escalation: one alone (e.g. shared surname) is LOW; two or
  // more distinct corroborating signals together raise it to MEDIUM
  // and warrant review, but still never assert legal entitlement.
  if (signals.length >= 2) {
    return {
      personId,
      status: "REQUIRES_REVIEW",
      confidence: "MEDIUM",
      signals,
      reason: `${signals.length} corroborating signals found (${signals.join(", ")}) -- enough to warrant human review, not enough to confirm on their own.`,
    };
  }

  return {
    personId,
    status: "POTENTIAL",
    confidence: "LOW",
    signals,
    reason: `Only one weak signal (${signals[0]}) -- doc 06 section 23: this alone must not trigger a flag.`,
  };
}

// doc 06 section 24: "Do not treat absence from a source as proof that
// a person does not exist." These two outcomes must stay distinct
// everywhere in the system, never collapsed into a single boolean.
export type NegativeEvidenceResult = "NO_EVIDENCE_FOUND" | "EVIDENCE_OF_ABSENCE";

/**
 * Pure: doc 06 section 24. `sourceExplicitlyAddressesQuestion` is true
 * only when the source affirmatively states something like "no other
 * children" -- not merely that it doesn't mention any. Simply not
 * finding a record is NO_EVIDENCE_FOUND, never treated as proof.
 */
export function classifyNegativeEvidence(
  sourceExplicitlyAddressesQuestion: boolean
): NegativeEvidenceResult {
  return sourceExplicitlyAddressesQuestion ? "EVIDENCE_OF_ABSENCE" : "NO_EVIDENCE_FOUND";
}
