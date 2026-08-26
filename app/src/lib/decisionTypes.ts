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

  // --- Document intelligence exceptions (doc 05 section 35) ---------
  // "Create decisions when: Document classification is ambiguous, Case
  // matching is ambiguous, Person matching is ambiguous, Critical
  // extraction has low confidence, Documents conflict, Required
  // evidence is missing, Document quality is inadequate, Duplicate is
  // suspected, Validation fails, Human verification is required." Most
  // of that list is already covered by existing types above without a
  // document-specific duplicate: classification-ambiguous and
  // low-confidence-extraction both fold into RESOLVE_LOW_CONFIDENCE
  // (same "AI confidence below threshold" shape); validation failure
  // is RESOLVE_INVALID_DOCUMENT; missing evidence reuses
  // REQUEST_DOCUMENTS (doc 04's existing type -- section 42's
  // DOCUMENT_REQUEST is that same action, not a new one). Person
  // matching (needs extracted names, P4-10) and document quality
  // (needs OCR-derived quality signals, P4-11) stay unadded until
  // their upstream data exists -- adding a decision type nothing can
  // ever create would be dead configuration. Only genuinely new shapes
  // get their own type below.
  RESOLVE_AMBIGUOUS_DOCUMENT_MATCH: {
    key: "RESOLVE_AMBIGUOUS_DOCUMENT_MATCH",
    displayName: "Resolve Ambiguous Document Match",
    description:
      "A document could plausibly belong to more than one case, or to none on file -- doc 05 section 12. 'Never silently attach an ambiguous document.'",
    // Mirrors RESOLVE_AMBIGUOUS_CASE_MATCH exactly -- same
    // never-guess shape, matchDocumentToCase.ts (P4-4) produces the
    // same AMBIGUOUS/candidate-list outcome matchConversationToCase.ts
    // does. Kept as its own type rather than reusing the
    // communication one so the decision queue can distinguish "which
    // case does this email belong to" from "which case does this
    // document belong to" at a glance.
    availableActions: ["RESOLVE", "CREATE_NEW_CASE", "ESCALATE", "DEFER"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  RESOLVE_DOCUMENT_CONFLICT: {
    key: "RESOLVE_DOCUMENT_CONFLICT",
    displayName: "Resolve Document Conflict",
    description:
      "A document's extracted field conflicts with the case's existing data, or two documents disagree with each other -- doc 05 sections 16-17. 'Do not automatically choose one.'",
    // Doc 05's own example shows named per-document buttons ([USE BIRTH
    // CERTIFICATE] [USE PASSPORT]), but same static-actions constraint
    // as RESOLVE_AMBIGUOUS_CASE_MATCH: which document is "correct"
    // isn't known at registry-definition time. RESOLVE means "operator
    // picked which value is correct," recorded in reason/evidenceRefs
    // exactly like every other RESOLVE action in this table.
    availableActions: ["RESOLVE", "ESCALATE", "DEFER"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  RESOLVE_SUSPECTED_DUPLICATE_DOCUMENT: {
    key: "RESOLVE_SUSPECTED_DUPLICATE_DOCUMENT",
    displayName: "Resolve Suspected Duplicate Document",
    description:
      "A newly received document appears to be an exact duplicate of one already on file -- doc 05 section 22. 'Never delete a potential duplicate automatically.'",
    // Doc 05 gives concrete named actions here (unlike the two types
    // above) -- [KEEP A] [KEEP B] [KEEP BOTH] [REVIEW] -- because the
    // choice itself (which copy to treat as canonical) is generic
    // across every duplicate pair, not case-specific. Used literally.
    availableActions: ["KEEP_NEW", "KEEP_EXISTING", "KEEP_BOTH", "ESCALATE"],
    // requiresComment must be true whenever requiresEvidenceViewed is
    // -- same invariant every other type in this table follows
    // (decisionTypes.test.ts asserts it registry-wide), so the operator
    // always leaves a record of why they picked the copy they did.
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },

  // --- Verification & heirship analysis exceptions (doc 06 sec 30) ---
  // "Integrate with the existing Decision Dashboard. When review is
  // required, create a decision... The operator should be able to:
  // [VERIFY] [REJECT] [REQUEST MORE EVIDENCE] [REVISE] [ESCALATE]."
  // Used literally for identity/relationship verification, since doc
  // 06 gives this exact action set for both. Competing-heir review gets
  // its own type below because section 41's own example uses a
  // different, more specific action set: [RESEARCH] [VERIFY] [RULE OUT]
  // [ESCALATE].
  RESOLVE_IDENTITY_VERIFICATION: {
    key: "RESOLVE_IDENTITY_VERIFICATION",
    displayName: "Resolve Identity Verification",
    description:
      "Two records could plausibly refer to the same real-world person, or a confirmed conflict undermines an identity match -- doc 06 sections 3, 28. 'Never merge identities automatically when evidence is ambiguous.'",
    availableActions: ["VERIFY", "REJECT", "REQUEST_MORE_EVIDENCE", "REVISE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  RESOLVE_RELATIONSHIP_VERIFICATION: {
    key: "RESOLVE_RELATIONSHIP_VERIFICATION",
    displayName: "Resolve Relationship Verification",
    description:
      "A proposed relationship claim is conflicted or unsupported by its gathered evidence -- doc 06 section 8. 'Do not automatically choose one.'",
    availableActions: ["VERIFY", "REJECT", "REQUEST_MORE_EVIDENCE", "REVISE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  REVIEW_COMPETING_HEIR_CANDIDATE: {
    key: "REVIEW_COMPETING_HEIR_CANDIDATE",
    displayName: "Review Competing Heir Candidate",
    description:
      "A potential competing heir was identified with enough corroborating signal to warrant human review -- doc 06 sections 20-23, 41. 'Do not automatically conclude that the person is legally entitled.'",
    // doc 06 section 41's own action set, used literally.
    availableActions: ["RESEARCH", "VERIFY", "RULE_OUT", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
    category: "EXCEPTION",
  },
  REVIEW_CLAIM_PACKAGE: {
    key: "REVIEW_CLAIM_PACKAGE",
    displayName: "Review Claim Package",
    description:
      "An assembled claim package (forms, declarations, exhibits, signatures) needs operator review before it can advance to APPROVED_FOR_FILING -- doc 07 sections 44-48. A package with any completeness/integrity blocker never auto-advances.",
    // doc 07 section 44's own literal action set.
    availableActions: ["APPROVE", "REVISE", "REJECT", "REQUEST_MORE_EVIDENCE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: true, // filing-adjacent -- doc 02 section 19's confirmation-step trigger
    category: "EXCEPTION",
  },
  REVIEW_FILING_EXCEPTION: {
    key: "REVIEW_FILING_EXCEPTION",
    displayName: "Review Filing Exception",
    description:
      "A filing-stage exception needs operator attention -- a provider rejection, a possible duplicate filing, or a filing/external-state reconciliation mismatch (doc 08 sections 39-42, 48, 51, 58).",
    // doc 08 section 51's own literal action set.
    availableActions: ["REQUEST_DOCUMENT", "REVISE", "REJECT_CLAIM", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: true, // filing-adjacent -- doc 02 section 19's confirmation-step trigger
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
