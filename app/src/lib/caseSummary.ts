// Case-summary generator -- doc 02 section 9. "Build a case-summary
// service that generates a concise operator briefing... The operator
// should understand the case in seconds."
//
// v1 is deterministic templating over structured case facts, not an
// LLM call -- there's no AIProvider wired up yet (that's Phase 3+
// per PLAN.md), and doc 02 itself only asks for synthesis "from the
// case," not specifically from a model. This gives every case a real,
// useful summary today; swapping in an AIProvider-backed version later
// is a drop-in replacement for generateCaseSummary's body, not a
// different interface -- CaseSummaryInput stays the contract.
//
// Priority order per doc 02 section 9: what happened, who's involved,
// what's known, what's uncertain, what's missing, what the AI
// recommends, what the operator needs to decide.

export interface CaseSummaryInput {
  decedentName: string;
  claimantName: string;
  claimantStatus: string;
  estimatedValueCents: number | null;
  documentsReceived: number;
  documentsRequired: number;
  missingDocumentTypes: readonly string[];
  competingHeirCount: number;
  aiRecommendation?: string | null;
  aiConfidence?: number | null; // 0.0-1.0
  aiReason?: string | null;
}

function formatMoney(cents: number | null): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function claimantStatusPhrase(status: string): string {
  // Human-readable phrasing for a subset of ClaimantStatus values that
  // read naturally mid-sentence; falls back to the raw status for any
  // value not covered rather than guessing at a wrong-sounding phrase.
  const PHRASES: Record<string, string> = {
    LEAD: "has been identified as a potential heir",
    CONTACTED: "has been contacted",
    RESPONDED: "has responded to outreach",
    POTENTIAL_HEIR: "is a potential heir under review",
    VERIFIED: "has been verified as an heir",
    ENGAGED: "has engaged with the case",
    DOCUMENTS_REQUESTED: "has been asked for supporting documents",
    DOCUMENTS_COMPLETE: "has provided all requested documents",
    CLAIM_READY: "has a claim package ready for review",
    AWAITING_OPERATOR_APPROVAL: "is awaiting operator approval",
    APPROVED: "has been approved",
    FILED: "has a filed claim",
  };
  return PHRASES[status] ?? `has status ${status}`;
}

/**
 * Synthesizes a short operator briefing from structured case facts.
 * Pure and deterministic -- same input always produces the same
 * summary, which also makes it fully unit-testable without a live DB
 * or an AI call.
 */
export function generateCaseSummary(input: CaseSummaryInput): string {
  const sentences: string[] = [];

  // 1. What happened / 2. who's involved
  sentences.push(
    `${input.claimantName} ${claimantStatusPhrase(input.claimantStatus)} in the estate of ${input.decedentName}.`
  );

  // 3. What's known
  if (input.documentsRequired > 0) {
    sentences.push(
      `${input.documentsReceived} of ${input.documentsRequired} required documents have been received.`
    );
  }

  // 4. What's uncertain / 5. what's missing
  if (input.missingDocumentTypes.length > 0) {
    const list = input.missingDocumentTypes.join(", ");
    sentences.push(
      `${input.missingDocumentTypes.length === 1 ? "One document remains" : "Documents remain"} outstanding: ${list}.`
    );
  }
  if (input.competingHeirCount > 0) {
    sentences.push(
      `${input.competingHeirCount} other potential ${input.competingHeirCount === 1 ? "heir has" : "heirs have"} been identified on this estate.`
    );
  } else {
    sentences.push("No competing heirs have currently been identified.");
  }

  const money = formatMoney(input.estimatedValueCents);
  if (money) {
    sentences.push(`Estimated potential recovery is ${money}.`);
  }

  // 6. What the AI recommends
  if (input.aiRecommendation) {
    const confidencePart =
      input.aiConfidence != null ? ` (${Math.round(input.aiConfidence * 100)}% confidence)` : "";
    sentences.push(`AI recommendation: ${input.aiRecommendation}${confidencePart}.`);
    if (input.aiReason) {
      sentences.push(input.aiReason);
    }
  }

  return sentences.join(" ");
}
