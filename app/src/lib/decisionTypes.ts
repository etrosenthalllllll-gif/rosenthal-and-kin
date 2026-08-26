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
  },
  REQUEST_DOCUMENTS: {
    key: "REQUEST_DOCUMENTS",
    displayName: "Request Documents",
    description: "Ask a claimant for a specific missing document.",
    availableActions: ["SEND", "REVISE", "CANCEL", "ESCALATE"],
    requiresComment: false,
    requiresEvidenceViewed: false,
    highConsequence: false,
  },
  APPROVE_CLAIMANT: {
    key: "APPROVE_CLAIMANT",
    displayName: "Approve Claimant",
    description: "Confirm a potential heir as a verified claimant.",
    availableActions: ["APPROVE", "REJECT", "REQUEST_MORE_EVIDENCE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
  },
  RESOLVE_GENEALOGY_CONFLICT: {
    key: "RESOLVE_GENEALOGY_CONFLICT",
    displayName: "Resolve Genealogy Conflict",
    description: "Two or more sources disagree about a relationship or identity.",
    availableActions: ["VERIFY", "REJECT", "REQUEST_MORE_EVIDENCE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
  },
  APPROVE_CLAIM_PACKAGE: {
    key: "APPROVE_CLAIM_PACKAGE",
    displayName: "Approve Claim Package",
    description: "Approve a prepared claim package for filing.",
    availableActions: ["APPROVE_AND_FILE", "REVISE", "REJECT", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: true,
  },
  REVIEW_FILING_REJECTION: {
    key: "REVIEW_FILING_REJECTION",
    displayName: "Review Filing Rejection",
    description: "A filing was rejected by the authority; decide next step.",
    availableActions: ["REQUEST_DOCUMENT", "REVISE_PACKAGE", "REJECT_CASE", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: false,
  },
  APPROVE_RECOVERY_DISTRIBUTION: {
    key: "APPROVE_RECOVERY_DISTRIBUTION",
    displayName: "Approve Recovery Distribution",
    description: "Approve calculated fee/distribution before disbursement.",
    availableActions: ["APPROVE", "REVISE", "REJECT", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: true,
    highConsequence: true,
  },
  CLOSE_CASE: {
    key: "CLOSE_CASE",
    displayName: "Close Case",
    description: "Close a claimant's case as complete or terminated.",
    availableActions: ["CLOSE_CASE", "KEEP_OPEN", "ESCALATE"],
    requiresComment: true,
    requiresEvidenceViewed: false,
    highConsequence: true,
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
