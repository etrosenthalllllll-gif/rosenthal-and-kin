// Document-to-case matching -- doc 05 section 12. PLAN.md P4-4.
//
// "Automatically determine which case a document belongs to. Use:
// Upload context, Email thread, Sender, Recipient, Claimant, Name,
// Address, Case references, Estate/decedent name, Document contents,
// Existing case information, Communication ID... If ambiguous: Create
// a document matching decision... Never silently attach an ambiguous
// document."
//
// This is doc 04's matchConversationToCase.ts (P3-2) pattern, mirrored
// for documents rather than communications -- same scoring shape, same
// never-guess discipline, same "Cases RK-1842 and RK-1917" example.
// Kept as its own module rather than a generic "match anything to a
// case" abstraction: the signal set genuinely differs (a document has
// no "thread ID," a communication has no "file hash"), and forcing
// them into one shared function would just replace two clear names
// with one confusing one.
//
// Pure scoring/decision logic only -- no DB access. Several signals
// below (document-contents name/address references, OCR text case-
// number references) depend on extraction output that's still blocked
// (P4-7 OCR, P4-9 extraction) -- the signal fields exist so this
// function is ready the moment that data exists, same as
// communicationClassification.ts's routing logic waiting on a live
// classifier.

export interface CaseMatchCandidate {
  claimantId: string;
  caseNumber: string; // "RK-1842"
  decedentName: string;
  claimantName: string;
  claimantEmail: string | null;
  // Communication IDs already known to belong to this claimant's case
  // -- doc 05 section 37's email -> attachment -> Document chain.
  knownCommunicationIds: readonly string[];
}

export interface IncomingDocumentSignals {
  // doc 05 section 1: "Source communication ID where applicable" --
  // the strongest possible signal, a literal continuation of a known
  // communication thread.
  sourceCommunicationId?: string | null;
  uploaderEmail?: string | null;
  // OCR/extracted text scanned for an explicit case-number reference,
  // decedent name, or claimant name -- available once P4-7/P4-9 unblock.
  extractedText?: string | null;
}

export interface CandidateScore {
  claimantId: string;
  caseNumber: string;
  confidence: number; // 0.0-1.0
  reasons: string[];
}

export type DocumentMatchDecision =
  | { outcome: "AUTO_ATTACH"; match: CandidateScore }
  | { outcome: "AMBIGUOUS"; candidates: CandidateScore[] }
  | { outcome: "NO_MATCH" };

// Not hardcoded deep in the scoring loop, same reasoning as
// matchConversationToCase.ts's MATCH_SIGNAL_WEIGHTS -- exported so a
// future config-table pass can tune these without touching the logic.
export const DOCUMENT_MATCH_SIGNAL_WEIGHTS = {
  sourceCommunicationId: 0.6,
  uploaderEmail: 0.5,
  caseNumberReference: 0.45,
  decedentNameReference: 0.35,
  claimantNameReference: 0.2,
} as const;

export const AUTO_ATTACH_THRESHOLD = 0.9;
export const AMBIGUOUS_THRESHOLD = 0.3;
// Same purpose as matchConversationToCase.ts's margin: two candidates
// both clearing AUTO_ATTACH_THRESHOLD must not auto-attach to either --
// doc 05 section 12's own "may belong to Case RK-1842 or RK-1917" example.
const AUTO_ATTACH_MARGIN = 0.15;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function includesCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toUpperCase().includes(needle.toUpperCase());
}

/**
 * Scores one candidate case against the incoming document's signals.
 * Pure; confidence clamped to [0, 1] even though weights could in
 * principle stack past 1.0.
 */
export function scoreDocumentCandidate(
  signals: IncomingDocumentSignals,
  candidate: CaseMatchCandidate
): CandidateScore {
  let confidence = 0;
  const reasons: string[] = [];

  if (
    signals.sourceCommunicationId &&
    candidate.knownCommunicationIds.includes(signals.sourceCommunicationId)
  ) {
    confidence += DOCUMENT_MATCH_SIGNAL_WEIGHTS.sourceCommunicationId;
    reasons.push("Attached to a communication already linked to this case");
  }

  if (
    signals.uploaderEmail &&
    candidate.claimantEmail &&
    normalizeEmail(signals.uploaderEmail) === normalizeEmail(candidate.claimantEmail)
  ) {
    confidence += DOCUMENT_MATCH_SIGNAL_WEIGHTS.uploaderEmail;
    reasons.push("Uploader email matches known claimant");
  }

  if (signals.extractedText && candidate.caseNumber) {
    if (includesCaseInsensitive(signals.extractedText, candidate.caseNumber)) {
      confidence += DOCUMENT_MATCH_SIGNAL_WEIGHTS.caseNumberReference;
      reasons.push(`Document text references case number ${candidate.caseNumber}`);
    }
    if (candidate.decedentName && includesCaseInsensitive(signals.extractedText, candidate.decedentName)) {
      confidence += DOCUMENT_MATCH_SIGNAL_WEIGHTS.decedentNameReference;
      reasons.push(`Document text references decedent ${candidate.decedentName}`);
    }
    if (candidate.claimantName && includesCaseInsensitive(signals.extractedText, candidate.claimantName)) {
      confidence += DOCUMENT_MATCH_SIGNAL_WEIGHTS.claimantNameReference;
      reasons.push(`Document text references claimant ${candidate.claimantName}`);
    }
  }

  return {
    claimantId: candidate.claimantId,
    caseNumber: candidate.caseNumber,
    confidence: Math.min(1, confidence),
    reasons,
  };
}

/**
 * Scores every candidate case and decides: auto-attach, create a
 * document-matching exception, or no match. Never guesses -- doc 05
 * section 12: "Never silently attach an ambiguous document."
 */
export function matchDocumentToCase(
  signals: IncomingDocumentSignals,
  candidates: readonly CaseMatchCandidate[]
): DocumentMatchDecision {
  const scored = candidates
    .map((candidate) => scoreDocumentCandidate(signals, candidate))
    .filter((s) => s.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);

  if (scored.length === 0) {
    return { outcome: "NO_MATCH" };
  }

  const [top, second] = scored;
  const clearlyLeads = !second || top.confidence - second.confidence >= AUTO_ATTACH_MARGIN;

  if (top.confidence >= AUTO_ATTACH_THRESHOLD && clearlyLeads) {
    return { outcome: "AUTO_ATTACH", match: top };
  }

  if (top.confidence >= AMBIGUOUS_THRESHOLD) {
    return {
      outcome: "AMBIGUOUS",
      candidates: scored.filter((s) => s.confidence >= AMBIGUOUS_THRESHOLD),
    };
  }

  return { outcome: "NO_MATCH" };
}
