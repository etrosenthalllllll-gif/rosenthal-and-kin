// Unified communication timeline -- doc 04 section 24 ("The operator
// should be able to understand the entire relationship with the person
// from one timeline") and section 1's channel-independent Communication
// model. PLAN.md P3-1.
//
// Same split as decisionQueue.ts and audit.ts: a pure function
// (buildCommunicationTimeline) doing all the real logic, fully
// unit-tested with fixtures, and a thin Prisma-fetching wrapper
// (fetchCommunicationTimeline) that isn't -- there's no branching logic
// in "call Prisma, pass the result to the pure function" worth unit
// testing beyond what integration tests would cover.

import type { PrismaClient } from "@prisma/client";

export type CommunicationChannel = "EMAIL" | "SMS" | "VOICE" | "MAIL";
export type CommunicationDirection = "INBOUND" | "OUTBOUND";
export type ConversationAttentionStatus = "AUTOMATED" | "OPERATOR_REQUIRED" | "EXCEPTION";

export interface CommunicationTimelineRow {
  id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  sender: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  classification: string | null;
  classificationConfidence: number | null;
  aiSummary: string | null;
  aiConfidence: number | null;
  createdAt: Date;
  conversation: {
    id: string;
    attentionStatus: ConversationAttentionStatus;
    humanHandling: boolean;
  };
}

export interface CommunicationTimelineItem {
  id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  sender: string;
  recipient: string;
  subject: string | null;
  // A short line for the timeline UI -- the AI summary when one exists
  // (doc 04 section 24's example rows), otherwise a truncated body so
  // the row is never blank while waiting on classification/summary.
  displaySummary: string;
  status: string;
  classification: string | null;
  conversationId: string;
  // doc 04 section 27: whether this specific message currently needs
  // operator attention, derived from its conversation's state rather
  // than duplicated per-message.
  requiresAttention: boolean;
  humanHandling: boolean;
  createdAt: Date;
}

const DISPLAY_SUMMARY_MAX_LENGTH = 140;

function truncateBody(body: string): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  return collapsed.length > DISPLAY_SUMMARY_MAX_LENGTH
    ? `${collapsed.slice(0, DISPLAY_SUMMARY_MAX_LENGTH - 1)}…`
    : collapsed;
}

/**
 * Pure: turns raw Communication rows (with conversation already joined)
 * into a chronological timeline of view models, oldest first -- matching
 * doc 04 section 24's example ("Jan 4 ... Jan 12 ... Jan 15 ...").
 * No DB access -- fully unit-testable.
 */
export function buildCommunicationTimeline(
  rows: readonly CommunicationTimelineRow[]
): CommunicationTimelineItem[] {
  return [...rows]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((row) => ({
      id: row.id,
      channel: row.channel,
      direction: row.direction,
      sender: row.sender,
      recipient: row.recipient,
      subject: row.subject,
      displaySummary: row.aiSummary ?? truncateBody(row.body),
      status: row.status,
      classification: row.classification,
      conversationId: row.conversation.id,
      requiresAttention: row.conversation.attentionStatus !== "AUTOMATED",
      humanHandling: row.conversation.humanHandling,
      createdAt: row.createdAt,
    }));
}

/**
 * Fetches every Communication for a claimant (case), joined with its
 * conversation, and builds the timeline. Not unit-tested for the same
 * reason fetchDecisionQueue isn't -- buildCommunicationTimeline is where
 * the actual logic lives and is tested there.
 */
export async function fetchCommunicationTimeline(
  db: PrismaClient,
  claimantId: string
): Promise<CommunicationTimelineItem[]> {
  const rows = await db.communication.findMany({
    where: { claimantId },
    include: { conversation: true },
  });

  return buildCommunicationTimeline(rows as unknown as CommunicationTimelineRow[]);
}
