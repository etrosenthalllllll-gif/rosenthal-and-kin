// Communication classification -- doc 04 section 6 (categories),
// section 9 (per-category automation rules), section 28 (configurable
// confidence thresholds). PLAN.md P3-4.
//
// "Create an AI classification layer... Make classifications
// configurable... If confidence is below configured threshold, create a
// human-review decision."
//
// This module does NOT call an AI model -- there is no live AIProvider
// account provisioned yet (see providers/types.ts's AIProvider
// interface, still unimplemented), same "don't fake what doesn't exist
// upstream" discipline as caseSummary.ts (P1-3). What it provides is the
// CONFIGURATION TABLE (doc 04's own "make classifications configurable"
// instruction -- same pattern as complianceRules.ts and
// decisionTypes.ts: versioned config, not switch statements scattered
// through the app) and the ROUTING DECISION that runs on a
// classification result once one exists, from any source (a live model
// today would be blocked: needs credential -- Anthropic API key not yet
// provisioned; tests below use synthetic classification results, which
// exercise the exact same routing logic a real model's output would).

export type ClassificationCategory =
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "QUESTION"
  | "REQUEST_FOR_INFORMATION"
  | "DOCUMENT_ATTACHED"
  | "DOCUMENT_MISSING"
  | "IDENTITY_INFORMATION"
  | "RELATIONSHIP_INFORMATION"
  | "CLAIM_INFORMATION"
  | "LEGAL_QUESTION"
  | "PAYMENT_QUESTION"
  | "SUSPICIOUS"
  | "WRONG_PERSON"
  | "DECEASED_PERSON"
  | "DO_NOT_CONTACT"
  | "UNSUBSCRIBE"
  | "AUTO_REPLY"
  | "BOUNCE"
  | "UNCLEAR"
  | "ESCALATE";

export interface ClassificationCategoryConfig {
  key: ClassificationCategory;
  displayName: string;
  description: string;
  // doc 04 section 28: thresholds configurable "by communication type,
  // workflow, action risk, channel" -- this is the per-category piece
  // of that; confidence at or above this routes to automation.
  confidenceThreshold: number;
  // doc 04 section 7/9's explicit examples ("Legal interpretation...
  // should normally require human review", "IF classification =
  // LEGAL_QUESTION THEN: Do not automatically answer"): some categories
  // never auto-route regardless of how confident the classifier is.
  alwaysRequiresHumanReview: boolean;
}

// doc 04 section 6's own category list, verbatim -- not trimmed down,
// since the doc calls this "at minimum" and each one maps to a distinct
// operator action later in the doc (section 17's call-classification
// list overlaps but isn't identical; email gets its own table here).
export const CLASSIFICATION_CATEGORIES: Record<
  ClassificationCategory,
  ClassificationCategoryConfig
> = {
  INTERESTED: {
    key: "INTERESTED",
    displayName: "Interested",
    description: "Claimant expresses interest in pursuing the claim.",
    confidenceThreshold: 0.9,
    alwaysRequiresHumanReview: false,
  },
  NOT_INTERESTED: {
    key: "NOT_INTERESTED",
    displayName: "Not Interested",
    description: "Claimant declines to pursue the claim.",
    confidenceThreshold: 0.9,
    alwaysRequiresHumanReview: false,
  },
  QUESTION: {
    key: "QUESTION",
    displayName: "Question",
    description: "A general, non-legal, non-financial question.",
    confidenceThreshold: 0.85,
    alwaysRequiresHumanReview: false,
  },
  REQUEST_FOR_INFORMATION: {
    key: "REQUEST_FOR_INFORMATION",
    displayName: "Request For Information",
    description: "Claimant asks what information or documents are needed next.",
    confidenceThreshold: 0.85,
    alwaysRequiresHumanReview: false,
  },
  DOCUMENT_ATTACHED: {
    key: "DOCUMENT_ATTACHED",
    displayName: "Document Attached",
    description: "Message includes a document attachment.",
    confidenceThreshold: 0.9,
    alwaysRequiresHumanReview: false,
  },
  DOCUMENT_MISSING: {
    key: "DOCUMENT_MISSING",
    displayName: "Document Missing",
    description: "Claimant says a requested document isn't available or doesn't exist.",
    confidenceThreshold: 0.85,
    alwaysRequiresHumanReview: false,
  },
  IDENTITY_INFORMATION: {
    key: "IDENTITY_INFORMATION",
    displayName: "Identity Information",
    description: "Message contains identity details (DOB, address, etc.).",
    confidenceThreshold: 0.85,
    alwaysRequiresHumanReview: false,
  },
  RELATIONSHIP_INFORMATION: {
    key: "RELATIONSHIP_INFORMATION",
    displayName: "Relationship Information",
    description: "Message describes the claimant's relationship to the decedent.",
    confidenceThreshold: 0.85,
    alwaysRequiresHumanReview: false,
  },
  CLAIM_INFORMATION: {
    key: "CLAIM_INFORMATION",
    displayName: "Claim Information",
    description: "Message contains substantive information about the claim itself.",
    confidenceThreshold: 0.85,
    alwaysRequiresHumanReview: false,
  },
  LEGAL_QUESTION: {
    key: "LEGAL_QUESTION",
    displayName: "Legal Question",
    description: "Claimant asks a legal-interpretation question.",
    confidenceThreshold: 0.5,
    // doc 04 section 9's own example: "IF classification =
    // LEGAL_QUESTION THEN: Do not automatically answer / Create
    // operator decision" -- no confidence level clears this.
    alwaysRequiresHumanReview: true,
  },
  PAYMENT_QUESTION: {
    key: "PAYMENT_QUESTION",
    displayName: "Payment Question",
    description: "Claimant asks about fees, payment, or financial terms.",
    confidenceThreshold: 0.5,
    alwaysRequiresHumanReview: true,
  },
  SUSPICIOUS: {
    key: "SUSPICIOUS",
    displayName: "Suspicious",
    description: "Message shows signs of fraud, impersonation, or a scam attempt.",
    confidenceThreshold: 0.5,
    alwaysRequiresHumanReview: true,
  },
  WRONG_PERSON: {
    key: "WRONG_PERSON",
    displayName: "Wrong Person",
    description: "Recipient says they are not the person being sought.",
    confidenceThreshold: 0.9,
    alwaysRequiresHumanReview: false,
  },
  DECEASED_PERSON: {
    key: "DECEASED_PERSON",
    displayName: "Deceased Person",
    description: "Sender reports that the claimant/contact is deceased.",
    confidenceThreshold: 0.5,
    // A consequential, sensitive fact -- doc 04 section 10 lists
    // "sensitive issue arises" as an automatic-escalation trigger.
    alwaysRequiresHumanReview: true,
  },
  DO_NOT_CONTACT: {
    key: "DO_NOT_CONTACT",
    displayName: "Do Not Contact",
    description: "Recipient asks not to be contacted again.",
    confidenceThreshold: 0.85,
    alwaysRequiresHumanReview: false,
  },
  UNSUBSCRIBE: {
    key: "UNSUBSCRIBE",
    displayName: "Unsubscribe",
    description: "Automated unsubscribe/opt-out signal.",
    confidenceThreshold: 0.9,
    alwaysRequiresHumanReview: false,
  },
  AUTO_REPLY: {
    key: "AUTO_REPLY",
    displayName: "Auto-Reply",
    description: "Out-of-office or other automated reply, not from the actual person.",
    confidenceThreshold: 0.9,
    alwaysRequiresHumanReview: false,
  },
  BOUNCE: {
    key: "BOUNCE",
    displayName: "Bounce",
    description: "Delivery failure notification.",
    confidenceThreshold: 0.9,
    alwaysRequiresHumanReview: false,
  },
  UNCLEAR: {
    key: "UNCLEAR",
    displayName: "Unclear",
    description: "The classifier could not confidently categorize the message.",
    confidenceThreshold: 0.5,
    // Being UNCLEAR is, by definition, never confident enough to
    // automate -- the category itself means "route to a human."
    alwaysRequiresHumanReview: true,
  },
  ESCALATE: {
    key: "ESCALATE",
    displayName: "Escalate",
    description: "The classifier itself determined this needs immediate human attention.",
    confidenceThreshold: 0.5,
    alwaysRequiresHumanReview: true,
  },
} as const;

export interface ClassificationResult {
  category: ClassificationCategory;
  confidence: number; // 0.0-1.0
  modelVersion: string;
}

export interface RoutingDecision {
  route: "AUTOMATED" | "HUMAN_REVIEW";
  reason: string;
}

export function getCategoryConfig(category: string): ClassificationCategoryConfig | null {
  return (CLASSIFICATION_CATEGORIES as Record<string, ClassificationCategoryConfig>)[category] ?? null;
}

/**
 * Pure: decides whether a classified communication can proceed through
 * automation or must be routed to a human, given its category and
 * confidence. Fails closed (routes to a human) on an unrecognized
 * category, same discipline as checkFeeCompliance()'s "no matching rule
 * -> block" default -- an unconfigured category is a gap, not silent
 * permission.
 */
export function routeClassifiedCommunication(result: ClassificationResult): RoutingDecision {
  const config = getCategoryConfig(result.category);

  if (!config) {
    return {
      route: "HUMAN_REVIEW",
      reason: `Unrecognized classification category "${result.category}" -- no routing rule configured.`,
    };
  }

  if (config.alwaysRequiresHumanReview) {
    return {
      route: "HUMAN_REVIEW",
      reason: `${config.displayName} always requires human review regardless of confidence.`,
    };
  }

  if (result.confidence >= config.confidenceThreshold) {
    return {
      route: "AUTOMATED",
      reason: `Confidence ${(result.confidence * 100).toFixed(1)}% meets the ${(
        config.confidenceThreshold * 100
      ).toFixed(0)}% threshold for ${config.displayName}.`,
    };
  }

  return {
    route: "HUMAN_REVIEW",
    reason: `Confidence ${(result.confidence * 100).toFixed(1)}% is below the ${(
      config.confidenceThreshold * 100
    ).toFixed(0)}% threshold for ${config.displayName}.`,
  };
}
