// Conflict detection + severity -- doc 06 sections 14-16. PLAN.md P5-6.
//
// "Build a conflict engine. Detect conflicts involving: Names, Dates of
// birth, ... Do not silently choose one." / "Classify conflicts. LOW:
// Minor formatting/name variation. MEDIUM: Potentially meaningful
// discrepancy. HIGH: Identity conflict. CRITICAL: Conflict that could
// materially affect the claim or heirship analysis. ... High/critical
// conflicts should automatically trigger human review." / "Every
// conflict should explain: WHAT CONFLICTED / SOURCE A / SOURCE B / WHY
// IT MATTERS / POSSIBLE EXPLANATIONS / RECOMMENDED NEXT STEP... Do not
// assert a speculative explanation as fact."
//
// Takes a crossSourceComparison.ts (P5-5) CONFLICT result and turns it
// into a fully-explained, severity-classified conflict record -- the
// two modules compose rather than duplicate: P5-5 decides *whether*
// sources disagree, this module decides *how serious* that is and
// drafts the human-facing explanation.

export type ConflictField =
  | "NAME"
  | "DATE_OF_BIRTH"
  | "DATE_OF_DEATH"
  | "PLACE"
  | "PARENT_RELATIONSHIP"
  | "SPOUSE_RELATIONSHIP"
  | "MARRIAGE_DATE"
  | "DIVORCE_DATE"
  | "ADDRESS"
  | "IDENTITY"
  | "FAMILY_RELATIONSHIP"
  | "DOCUMENT_NUMBER"
  | "OTHER";

export type ConflictSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// doc 06 section 15's own examples map fairly directly onto fields --
// not hardcoded inline in the classifier function, same config-table
// discipline as every other severity/threshold table in this codebase.
// A field not listed here fails closed to CRITICAL (see
// classifyConflictSeverity) rather than silently under-flagging an
// unconfigured field as LOW.
export const DEFAULT_FIELD_SEVERITY: Partial<Record<ConflictField, ConflictSeverity>> = {
  NAME: "LOW", // "Minor formatting/name variation" -- doc 06's own LOW example
  DATE_OF_BIRTH: "MEDIUM",
  DATE_OF_DEATH: "MEDIUM",
  PLACE: "MEDIUM",
  ADDRESS: "LOW",
  MARRIAGE_DATE: "MEDIUM",
  DIVORCE_DATE: "MEDIUM",
  DOCUMENT_NUMBER: "MEDIUM",
  IDENTITY: "HIGH", // "Identity conflict" -- doc 06's own HIGH example
  PARENT_RELATIONSHIP: "CRITICAL", // materially affects heirship
  SPOUSE_RELATIONSHIP: "CRITICAL",
  FAMILY_RELATIONSHIP: "CRITICAL",
};

export interface ConflictInput {
  field: ConflictField;
  sourceAId: string;
  sourceAValue: string;
  sourceBId: string;
  sourceBValue: string;
}

export interface ConflictRecord {
  field: ConflictField;
  severity: ConflictSeverity;
  sourceAId: string;
  sourceAValue: string;
  sourceBId: string;
  sourceBValue: string;
  whatConflicted: string;
  whyItMatters: string;
  // Neutral, non-accusatory possibilities -- doc 06 section 16: "Do not
  // assert a speculative explanation as fact."
  possibleExplanations: string[];
  recommendedNextStep: string;
  // doc 06 section 15: "High/critical conflicts should automatically
  // trigger human review."
  requiresHumanReview: boolean;
}

/**
 * Pure: doc 06 section 15. Fails closed to CRITICAL for a field this
 * table hasn't been configured for -- same discipline as
 * checkFeeCompliance()/routeClassifiedCommunication(): an
 * unrecognized field is a gap in configuration, not a reason to
 * under-flag it as harmless.
 */
export function classifyConflictSeverity(field: ConflictField): ConflictSeverity {
  return DEFAULT_FIELD_SEVERITY[field] ?? "CRITICAL";
}

const WHY_IT_MATTERS: Record<ConflictField, string> = {
  NAME: "A name discrepancy can indicate a formatting difference, a legal name change, or a different person entirely.",
  DATE_OF_BIRTH: "Date of birth is used to confirm identity and eligibility; a discrepancy could mean a transcription error or a different person.",
  DATE_OF_DEATH: "Date of death affects filing deadlines and the estate timeline.",
  PLACE: "Place discrepancies can affect jurisdiction and which records are authoritative.",
  PARENT_RELATIONSHIP: "This conflict goes directly to whether the claimed heirship relationship is real.",
  SPOUSE_RELATIONSHIP: "This conflict can affect community-property and heirship calculations.",
  MARRIAGE_DATE: "Marriage date can affect name-change chains and heirship timing.",
  DIVORCE_DATE: "Divorce date can determine whether a spousal relationship still applies.",
  ADDRESS: "Address changes over time are common and rarely indicate a different person on their own.",
  IDENTITY: "This is a direct conflict about whether two records refer to the same real-world person.",
  FAMILY_RELATIONSHIP: "This conflict can materially change who the claim's heirs are.",
  DOCUMENT_NUMBER: "A document-number mismatch can indicate a transcription error or a different document than claimed.",
  OTHER: "This conflict has not been categorized into a specific field.",
};

const POSSIBLE_EXPLANATIONS: Record<ConflictField, string[]> = {
  NAME: ["Data entry or transcription error", "Legal name change", "Different person"],
  DATE_OF_BIRTH: ["Data entry error", "Source transcription error", "Different person"],
  DATE_OF_DEATH: ["Data entry error", "Source transcription error", "Amended record"],
  PLACE: ["Data entry error", "Place renamed or reorganized over time", "Different event"],
  PARENT_RELATIONSHIP: ["Data entry error", "Adoption or step-relationship", "Different person"],
  SPOUSE_RELATIONSHIP: ["Data entry error", "Multiple marriages", "Different person"],
  MARRIAGE_DATE: ["Data entry error", "Ceremony vs. registration date"],
  DIVORCE_DATE: ["Data entry error", "Filing vs. finalization date"],
  ADDRESS: ["Person moved between records", "Data entry error"],
  IDENTITY: ["Same person with a name/detail change", "Different person entirely"],
  FAMILY_RELATIONSHIP: ["Data entry error", "Adoption, half-sibling, or step-relationship", "Different person"],
  DOCUMENT_NUMBER: ["Data entry or transcription error", "Different document than intended"],
  OTHER: ["Unclear without further evidence"],
};

/**
 * Pure: doc 06 section 16. Turns a raw two-source disagreement into a
 * fully-explained conflict record -- never asserts which explanation is
 * correct, just lists neutral possibilities per doc 06's explicit
 * instruction.
 */
export function explainConflict(input: ConflictInput): ConflictRecord {
  const severity = classifyConflictSeverity(input.field);

  return {
    field: input.field,
    severity,
    sourceAId: input.sourceAId,
    sourceAValue: input.sourceAValue,
    sourceBId: input.sourceBId,
    sourceBValue: input.sourceBValue,
    whatConflicted: `${input.field} differs: "${input.sourceAValue}" (${input.sourceAId}) vs. "${input.sourceBValue}" (${input.sourceBId}).`,
    whyItMatters: WHY_IT_MATTERS[input.field],
    possibleExplanations: POSSIBLE_EXPLANATIONS[input.field],
    recommendedNextStep:
      severity === "HIGH" || severity === "CRITICAL"
        ? "Verify against additional primary evidence before proceeding."
        : "Note the discrepancy and continue; escalate only if it recurs or compounds with other conflicts.",
    requiresHumanReview: severity === "HIGH" || severity === "CRITICAL",
  };
}
