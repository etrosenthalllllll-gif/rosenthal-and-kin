// Claimant response routing -- doc 09 section 40. PLAN.md P8-12.
//
// "When a claimant replies: match communication to case, classify
// response, extract possible intent, attach response to case, create a
// decision/task if needed. Examples: 'I uploaded the document.' ->
// Check portal. 'I don't have this document.' -> Create operator
// decision. 'Can you explain what this means?' -> Human/approved
// response workflow."
//
// Matching an inbound reply to its case reuses
// matchConversationToCase.ts (P3-2) directly -- this module doesn't
// re-derive that. Its own job is the intent -> action mapping, and
// specifically NOT treating a bare "I uploaded it" claim as proof --
// the doc's own first example routes to "check portal" (independent
// verification), never straight to "mark request satisfied."

export type ClaimantResponseIntent =
  | "CLAIMS_DOCUMENT_UPLOADED"
  | "CANNOT_PROVIDE_DOCUMENT"
  | "REQUESTS_EXPLANATION"
  | "OTHER";

export type ClaimantResponseAction =
  | "CHECK_PORTAL"
  | "CREATE_OPERATOR_DECISION"
  | "ROUTE_TO_HUMAN_RESPONSE_WORKFLOW"
  | "CREATE_GENERIC_OPERATOR_DECISION";

// doc 09 section 40's own worked examples, as a config table rather
// than an inline if/else chain. OTHER (an intent the classifier
// couldn't place into one of the doc's own examples) fails closed to
// CREATE_GENERIC_OPERATOR_DECISION -- an unclassifiable reply always
// reaches a human, never silently dropped.
const RESPONSE_ACTION_BY_INTENT: Record<ClaimantResponseIntent, ClaimantResponseAction> = {
  // "I uploaded the document." -- doc 09's own example: check the
  // portal (independent verification), never accept the bare claim as
  // proof that the request is satisfied.
  CLAIMS_DOCUMENT_UPLOADED: "CHECK_PORTAL",
  CANNOT_PROVIDE_DOCUMENT: "CREATE_OPERATOR_DECISION",
  REQUESTS_EXPLANATION: "ROUTE_TO_HUMAN_RESPONSE_WORKFLOW",
  OTHER: "CREATE_GENERIC_OPERATOR_DECISION",
};

/**
 * Pure: doc 09 section 40. Maps a claimant response's classified
 * intent to the action a caller should take. Never returns an action
 * that treats the claimant's own claim as sufficient proof by itself --
 * CLAIMS_DOCUMENT_UPLOADED always routes to independent verification
 * (CHECK_PORTAL), not straight to "satisfied."
 */
export function planClaimantResponseAction(intent: ClaimantResponseIntent): ClaimantResponseAction {
  return RESPONSE_ACTION_BY_INTENT[intent];
}
