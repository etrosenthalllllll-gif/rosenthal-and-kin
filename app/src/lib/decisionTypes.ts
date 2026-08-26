// Decision-type registry -- doc 02 section 3 "DECISION TYPES".
//
// "The system must support configurable decision types instead of
// hardcoding every decision into the UI." This registry is the
// configuration; the dashboard UI and the applyDecisionAction() function
// in decisions.ts both read from it rather than switching on decision
// type by name throughout the codebase.

export interface DecisionTypeConfig {
  key: string;
  displayName: string;
  description: string;
  availableActions: readonly string[];
  requiresComment: boolean;
  requiresEvidenceViewed: boolean;
  // Consequential actions (filing, financial, closing) get a confirmation
  // step in the UI -- see doc 02 section 19 "DECISION SAFETY".
  highConsequence: boolean;
  // doc 02 section 12 "EXCEPTION / REVIEW QUEUE": exceptions are a
  // distinct lane from routine decisions, not a separate database
  // entity -- they're Decisions whose type is flagged EXCEPTION here,
  // reusing the same Decision/DecisionStatus machinery already built
  // rather than standing up a competing model. See exceptionQueue.ts.
  category: "DECISION" | "EXCEPTION";
}

export const DECISION_TYPES = {
  APPROVE_OUTREACH: {
    key: "APPROVE_OUTREACH",
    displayName: "Approve Outreach",
    description: "Send a drafted outreach message to a potential heir.",
    availableActions: ["SEND", "REVISE", "REJECT", "ESCALATE"],
    requiresComment: false,
    requiresEvidenceViewed: false,
    highConsequence: false,
    category: "DECISION",
  },
  REQUEST_DOCUMENTS: {
    key: "REQUEST_DOCUMENTS",
    displayName: "Request Documents",
    description: "Ask a claimant for a specific missing document.",
    availableActions: ["SEND", "REVISE", "CANCEL", "ESCALATE"],
    requiresComment: false,
    requiresEvidenceViewed: false,
    highConsequence: false,
    category: "DECISION",
  },
  APPROVE_CLAIMANT: {
    key: "APPROVE_CLAIMANT",
    displayName: "Approve Claimant",
    description: "Confirm a potential heir as a verified claimant.",
    availableActions: ["APPROVE", "REJECT", "REQUEST_MORE_EVIDENCE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "DECISION",
  },
  RESOLVE_GENEALOGY_CONFLICT: {
    key: "RESOLVE_GENEALOGY_CONFLICT",
    displayName: "Resolve Genealogy Conflict",
    description: "Two or more sources disagree about a relationship or identity.",
    availableActions: ["VERIFY", "REJECT", "REQUEST_MORE_EVIDENCE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "DECISION",
  },
  APPROVE_CLAIM_PACKAGE: {
    key: "APPROVE_CLAIM_PACKAGE",
    displayName: "Approve Claim Package",
    description: "Approve a prepared claim package for filing.",
    availableActions: ["APPROVE_AND_FILE", "REVISE", "REJECT", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: true,
    category: "DECISION",
  },
  REVIEW_FILING_REJECTION: {
    key: "REVIEW_FILING_REJECTION",
    displayName: "Review Filing Rejection",
    description: "A filing was rejected by the authority; decide next step.",
    availableActions: ["REQUEST_DOCUMENT", "REVISE_PACKAGE", "REJECT_CASE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "DECISION",
  },
  APPROVE_RECOVERY_DISTRIBUTION: {
    key: "APPROVE_RECOVERY_DISTRIBUTION",
    displayName: "Approve Recovery Distribution",
    description: "Approve calculated fee/distribution before disbursement.",
    availableActions: ["APPROVE", "REVISE", "REJECT", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: true,
    category: "DECISION",
  },
  CLOSE_CASE: {
    key: "CLOSE_CASE",
    displayName: "Close Case",
    description: "Close a claimant's case as complete or terminated.",
    availableActions: ["CLOSE_CASE", "KEEP_OPEN", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: false,
    highConsequence: true,
    category: "DECISION",
  },

  // --- Exceptions (doc 02 section 12) -----------------------------
  // A representative set covering the doc's trigger list, not one type
  // per bullet point -- e.g. RESOLVE_CONFLICTING_EVIDENCE covers
  // "conflicting evidence," "genealogy conflicts," and "claimant
  // disputes information" alike, since they need the same operator
  // actions. `availableActions` omits doc 02's "OVERRIDE where
  // authorized": that needs its own permission plumbing (a specific
  // grant beyond the existing role checks) that doesn't exist yet --
  // add it once that's built rather than fake the authorization check.
  RESOLVE_LOW_CONFIDENCE: {
    key: "RESOLVE_LOW_CONFIDENCE",
    displayName: "Resolve Low-Confidence Case",
    description: "AI confidence fell below the threshold for automatic progression.",
    availableActions: ["RESOLVE", "ESCALATE", "DEFER", "CLOSE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  RESOLVE_CONFLICTING_EVIDENCE: {
    key: "RESOLVE_CONFLICTING_EVIDENCE",
    displayName: "Resolve Conflicting Evidence",
    description:
      "Two or more sources disagree, identity can't be verified, or a claimant disputes information on file.",
    availableActions: ["RESOLVE", "ESCALATE", "DEFER", "CLOSE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  RESOLVE_DUPLICATE_CASE: {
    key: "RESOLVE_DUPLICATE_CASE",
    displayName: "Resolve Suspected Duplicate Case",
    description: "Two estate or claimant records may refer to the same real-world case.",
    availableActions: ["RESOLVE", "ESCALATE", "DEFER", "CLOSE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  RESOLVE_INVALID_DOCUMENT: {
    key: "RESOLVE_INVALID_DOCUMENT",
    displayName: "Resolve Invalid Document",
    description: "A required document was received but failed validation.",
    availableActions: ["RESOLVE", "RETRY", "ESCALATE", "DEFER"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  RESOLVE_WORKFLOW_FAILURE: {
    key: "RESOLVE_WORKFLOW_FAILURE",
    displayName: "Resolve Workflow Failure",
    description:
      "A filing, integration, or automated workflow failed, got stuck, or couldn't determine its next step.",
    availableActions: ["RESOLVE", "RETRY", "ESCALATE", "DEFER"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  RESOLVE_AMBIGUOUS_CASE_MATCH: {
    key: "RESOLVE_AMBIGUOUS_CASE_MATCH",
    displayName: "Resolve Ambiguous Case Match",
    description:
      "An inbound communication could plausibly belong to more than one case, or to none on file -- doc 04 section 3. 'Do not guess.'",
    // Doc 04's own example UI shows per-candidate buttons
    // ([CASE 1842] [CASE 1917] [CREATE NEW CASE] [REVIEW]), but the
    // decision-type registry's actions are static per type, not
    // generated per candidate list. RESOLVE covers "operator picked one
    // of the candidate cases" (which one goes in evidenceRefs/reason,
    // same pattern as RESOLVE_DUPLICATE_CASE); CREATE_NEW_CASE is its
    // own explicit action since "none of these" is a distinct, common
    // outcome doc 04 calls out by name, not just a variant of RESOLVE.
    availableActions: ["RESOLVE", "CREATE_NEW_CASE", "ESCALATE", "DEFER"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
} as const satisfies Record<string, DecisionTypeConfig>;

export type DecisionTypeKey = keyof typeof DECISION_TYPES;

export function getDecisionTypeConfig(key: string): DecisionTypeConfig {
  const config = (DECISION_TYPES as Record<string, DecisionTypeConfig>)[key];
  if (!config) {
    throw new Error(`Unknown decision type: "${key}"`);
  }
  return config;
}

export function isActionAvailable(decisionTypeKey: string, action: string): boolean {
  const config = getDecisionTypeConfig(decisionTypeKey);
  return config.availableActions.includes(action);
}
