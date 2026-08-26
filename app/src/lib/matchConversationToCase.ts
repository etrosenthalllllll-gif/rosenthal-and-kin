// Conversation-to-case matching -- doc 04 section 3. PLAN.md P3-2.
//
// "Build automatic matching of incoming communications to existing
// cases. Use multiple signals... Create a matching confidence score...
// If confidence is high enough, automatically attach the communication
// to the case. If confidence is ambiguous: DO NOT guess. Create a
// decision/exception... Store the matching decision."
//
// Pure scoring/decision logic only -- no DB access, fully unit-tested.
// Wiring this into the actual inbound-email pipeline (calling it with
// real candidate rows from Prisma, creating the real
// RESOLVE_AMBIGUOUS_CASE_MATCH Decision row) is P3-3.

export interface CaseMatchCandidate {
  claimantId: string;
  caseNumber: string; // e.g. "RK-1842" -- referenced directly in message text per doc 04's example
  personEmail: string | null;
  personPhone: string | null;
  personName: string; // "First Last"
  // Provider thread/message IDs seen on prior communications for this
  // conversation -- doc 04 section 5's threading identifiers, reused
  // here as the strongest possible signal (a literal continuation of a
  // known thread).
  priorProviderThreadIds: readonly string[];
}

export interface IncomingCommunicationSignals {
  fromEmail?: string | null;
  fromPhone?: string | null;
  providerThreadId?: string | null;
  rawSenderName?: string | null;
  // Subject + body, scanned for an explicit case-number reference
  // ("RK-1842") -- doc 04 section 3's "case references" signal.
  text?: string | null;
}

export interface CandidateScore {
  claimantId: string;
  caseNumber: string;
  confidence: number; // 0.0-1.0, same scale as Relationship.confidence
  reasons: string[];
}

export type CaseMatchDecision =
  | { outcome: "AUTO_ATTACH"; match: CandidateScore }
  | { outcome: "AMBIGUOUS"; candidates: CandidateScore[] }
  | { outcome: "NO_MATCH" };

// Signal weights. Deliberately NOT hardcoded deep in the scoring loop --
// exported so a future config-table pass (same discipline as
// complianceRules.ts / decisionTypes.ts) can make these tunable without
// touching the scoring logic itself.
export const MATCH_SIGNAL_WEIGHTS = {
  providerThreadId: 0.6, // a literal continuation of a known thread -- near-certain
  caseNumberReference: 0.45, // claimant typed/quoted the case number
  email: 0.5,
  phone: 0.4,
  name: 0.2, // weak alone -- common names collide
} as const;

export const AUTO_ATTACH_THRESHOLD = 0.9;
export const AMBIGUOUS_THRESHOLD = 0.3;
// The top candidate must beat the runner-up by at least this much to
// auto-attach -- two candidates both clearing AUTO_ATTACH_THRESHOLD is
// exactly doc 04's "Possible match between ... Cases RK-1842 and
// RK-1917" example, which must NOT auto-attach to either.
const AUTO_ATTACH_MARGIN = 0.15;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Scores one candidate case against the incoming signals. Pure, no
 * upper bound violation -- confidence is clamped to [0, 1] even though
 * weights could in principle stack past 1.0 (e.g. thread + email + name
 * all matching).
 */
export function scoreCandidate(
  signals: IncomingCommunicationSignals,
  candidate: CaseMatchCandidate
): CandidateScore {
  let confidence = 0;
  const reasons: string[] = [];

  if (
    signals.providerThreadId &&
    candidate.priorProviderThreadIds.includes(signals.providerThreadId)
  ) {
    confidence += MATCH_SIGNAL_WEIGHTS.providerThreadId;
    reasons.push("Thread ID matches a previous communication on this case");
  }

  if (
    signals.text &&
    candidate.caseNumber &&
    signals.text.toUpperCase().includes(candidate.caseNumber.toUpperCase())
  ) {
    confidence += MATCH_SIGNAL_WEIGHTS.caseNumberReference;
    reasons.push(`Message references case number ${candidate.caseNumber}`);
  }

  if (
    signals.fromEmail &&
    candidate.personEmail &&
    normalizeEmail(signals.fromEmail) === normalizeEmail(candidate.personEmail)
  ) {
    confidence += MATCH_SIGNAL_WEIGHTS.email;
    reasons.push("Email matches known claimant");
  }

  if (
    signals.fromPhone &&
    candidate.personPhone &&
    normalizePhone(signals.fromPhone) === normalizePhone(candidate.personPhone)
  ) {
    confidence += MATCH_SIGNAL_WEIGHTS.phone;
    reasons.push("Phone matches known claimant");
  }

  if (
    signals.rawSenderName &&
    candidate.personName &&
    normalizeName(signals.rawSenderName) === normalizeName(candidate.personName)
  ) {
    confidence += MATCH_SIGNAL_WEIGHTS.name;
    reasons.push("Name matches");
  }

  return {
    claimantId: candidate.claimantId,
    caseNumber: candidate.caseNumber,
    confidence: Math.min(1, confidence),
    reasons,
  };
}

/**
 * Scores every candidate and decides: auto-attach, create an
 * ambiguous-match exception, or no match at all. Never guesses --
 * mirrors doc 04 section 3's explicit instruction.
 */
export function matchConversationToCase(
  signals: IncomingCommunicationSignals,
  candidates: readonly CaseMatchCandidate[]
): CaseMatchDecision {
  const scored = candidates
    .map((candidate) => scoreCandidate(signals, candidate))
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
