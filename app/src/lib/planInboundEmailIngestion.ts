// Inbound email ingestion pipeline (minus the live inbox connection) --
// doc 04 sections 4-5. PLAN.md P3-3.
//
// "1. Receive inbound email. 2. Validate the message. 3. Store raw
// metadata. 4. Store message content. ... 7. Match sender/conversation
// to person and case. ... Preserve the original inbound message. Do not
// rely only on an AI-transformed version." / "Prevent duplicate
// ingestion... Use provider IDs and idempotency mechanisms."
//
// This module is the PLANNING layer only: given a raw inbound email
// payload and the case-matching candidates already in the DB, it
// decides what should happen -- skip as a duplicate, attach to a case,
// or raise a match exception -- without touching Prisma or a live
// inbox. That split mirrors decisionQueue.ts/communicationTimeline.ts's
// pure-function-plus-thin-wrapper pattern, and is deliberate here for a
// second reason: the actual webhook endpoint that receives real
// provider payloads needs a live inbound email provider account
// (Postmark/SendGrid inbound parse or similar), which doesn't exist yet
// -- see PLAN.md's P3-3 note. The decision logic itself has no such
// dependency and is fully testable against synthetic payloads today.
//
// Classification (doc 04 section 6) and summary generation are
// deliberately NOT part of this plan -- those need a real AIProvider,
// same "don't fake it" discipline as caseSummary.ts (P1-3). The plan
// below produces a communication record with classification/aiSummary
// left null, exactly like the Communication model's own optional
// fields, ready for P3-4 to fill in once it exists.

import {
  matchConversationToCase,
  type CaseMatchCandidate,
  type CandidateScore,
} from "./matchConversationToCase";

export interface RawInboundEmail {
  providerMessageId: string;
  inReplyToProviderMessageId?: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  bodyText: string;
  receivedAt: string; // ISO timestamp
}

export interface IngestionContext {
  // Provider message IDs already stored -- doc 04 section 5's dedup
  // requirement. A Set here stands in for the real unique-constraint
  // check a live DB call would do (Communication.providerMessageId is
  // already a unique column per the P3-1 schema).
  existingProviderMessageIds: ReadonlySet<string>;
  candidates: readonly CaseMatchCandidate[];
}

export interface CommunicationDraft {
  channel: "EMAIL";
  direction: "INBOUND";
  sender: string;
  recipient: string;
  subject: string | null;
  // The untouched original body -- doc 04 section 4: "Do not rely only
  // on an AI-transformed version."
  body: string;
  providerMessageId: string;
  status: "RECEIVED";
}

export type IngestionPlan =
  | { action: "SKIP_DUPLICATE"; providerMessageId: string }
  | { action: "REJECT_INVALID"; reason: string }
  | {
      action: "ATTACH_TO_CASE";
      claimantId: string;
      caseNumber: string;
      matchConfidence: number;
      matchReasons: string[];
      communication: CommunicationDraft;
    }
  | {
      action: "CREATE_MATCH_EXCEPTION";
      // Mirrors doc 04's own example: "Possible match between incoming
      // message and Cases RK-1842 and RK-1917" when ambiguous, or an
      // empty candidate list when nothing matched at all -- either way
      // this is never silently dropped (doc 04 section 44: "never
      // silently disappear").
      candidates: CandidateScore[];
      communication: CommunicationDraft;
    };

function isValidPayload(email: RawInboundEmail): string | null {
  if (!email.providerMessageId.trim()) return "missing provider message ID";
  if (!email.fromEmail.trim()) return "missing sender address";
  if (!email.toEmail.trim()) return "missing recipient address";
  if (!email.bodyText.trim()) return "empty message body";
  return null;
}

function buildDraft(email: RawInboundEmail): CommunicationDraft {
  return {
    channel: "EMAIL",
    direction: "INBOUND",
    sender: email.fromEmail,
    recipient: email.toEmail,
    subject: email.subject,
    body: email.bodyText,
    providerMessageId: email.providerMessageId,
    status: "RECEIVED",
  };
}

/**
 * Pure: decides what the ingestion pipeline should do with one raw
 * inbound email. No DB access, no network -- fully unit-testable
 * against synthetic payloads.
 */
export function planInboundEmailIngestion(
  email: RawInboundEmail,
  context: IngestionContext
): IngestionPlan {
  const validationError = isValidPayload(email);
  if (validationError) {
    return { action: "REJECT_INVALID", reason: validationError };
  }

  if (context.existingProviderMessageIds.has(email.providerMessageId)) {
    return { action: "SKIP_DUPLICATE", providerMessageId: email.providerMessageId };
  }

  const communication = buildDraft(email);

  const matchResult = matchConversationToCase(
    {
      fromEmail: email.fromEmail,
      providerThreadId: email.inReplyToProviderMessageId ?? undefined,
      text: `${email.subject ?? ""}\n${email.bodyText}`,
    },
    context.candidates
  );

  if (matchResult.outcome === "AUTO_ATTACH") {
    return {
      action: "ATTACH_TO_CASE",
      claimantId: matchResult.match.claimantId,
      caseNumber: matchResult.match.caseNumber,
      matchConfidence: matchResult.match.confidence,
      matchReasons: matchResult.match.reasons,
      communication,
    };
  }

  if (matchResult.outcome === "AMBIGUOUS") {
    return {
      action: "CREATE_MATCH_EXCEPTION",
      candidates: matchResult.candidates,
      communication,
    };
  }

  // NO_MATCH: doc 04 never describes silently dropping an inbound
  // message just because it didn't match anything -- section 44's
  // "never silently disappear" and section 27's escalation-on-unclear
  // both point the same direction. Route it the same way as an
  // ambiguous match, just with an empty candidate list, so a human
  // decides whether this is a new case rather than the message
  // vanishing.
  return { action: "CREATE_MATCH_EXCEPTION", candidates: [], communication };
}
