// Communication dashboard + analytics -- doc 04 sections 26, 41.
// PLAN.md P3-13.
//
// "Build communication metrics. Show: New inbound messages, Responses
// today, Automated responses, Human-reviewed responses... Pending
// responses, Exceptions, Failed communications, Opt-outs, Follow-ups
// due. The dashboard should link directly to cases/decisions." /
// "Track: Messages sent, Messages received, Response rate... Automated
// response rate, Human intervention rate, Escalation rate, Opt-out
// rate, Bounce rate, Delivery rate..."
//
// Scoped to what's actually trackable given this session's build:
// call-specific metrics (missed calls, voice-agent completion rate,
// call duration, call answer rate) are left out since voice (P3-10) was
// explicitly skipped -- tracking metrics for a channel that doesn't
// exist yet would be fabricated zeros dressed up as real numbers,
// exactly what this project's "don't fake data nothing upstream
// produces" discipline exists to prevent. Same reasoning for
// follow-up-conversion and communication-cost (§41) -- no follow-up
// sends or cost data exists yet either.
//
// Split the usual way: computeDashboardMetrics() is pure (rate math,
// divide-by-zero guarded to null rather than NaN/Infinity) and fully
// tested; fetchDashboardCounts() is a thin, untested Prisma wrapper --
// same pattern as decisionQueue.ts/communicationTimeline.ts.

import type { PrismaClient } from "@prisma/client";

export interface DashboardCounts {
  messagesSent: number;
  messagesReceived: number;
  automatedResponses: number;
  humanReviewedResponses: number;
  pendingResponses: number;
  exceptions: number;
  optOuts: number;
  failedCommunications: number;
  delivered: number;
  bounced: number;
}

export interface DashboardMetrics extends DashboardCounts {
  // Percentages, 0-100, or null when there's nothing to divide by --
  // never NaN/Infinity leaking into a UI.
  automatedResponseRate: number | null;
  humanInterventionRate: number | null;
  escalationRate: number | null;
  optOutRate: number | null;
  bounceRate: number | null;
  deliveryRate: number | null;
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal place
}

/**
 * Pure: turns raw counts into the doc 04 section 41 rates. No DB
 * access -- fully unit-testable.
 */
export function computeDashboardMetrics(counts: DashboardCounts): DashboardMetrics {
  const totalResponded = counts.automatedResponses + counts.humanReviewedResponses;

  return {
    ...counts,
    automatedResponseRate: ratePercent(counts.automatedResponses, totalResponded),
    humanInterventionRate: ratePercent(counts.humanReviewedResponses, totalResponded),
    escalationRate: ratePercent(counts.exceptions, counts.messagesReceived),
    optOutRate: ratePercent(counts.optOuts, counts.messagesReceived),
    bounceRate: ratePercent(counts.bounced, counts.messagesSent),
    deliveryRate: ratePercent(counts.delivered, counts.messagesSent),
  };
}

/**
 * Fetches the raw counts from live Postgres and computes metrics.
 * Not unit-tested for the same reason fetchDecisionQueue() isn't --
 * computeDashboardMetrics() is where the actual logic lives.
 */
export async function fetchDashboardMetrics(db: PrismaClient): Promise<DashboardMetrics> {
  const [
    messagesSent,
    messagesReceived,
    pendingResponses,
    exceptions,
    optOuts,
    failedCommunications,
    delivered,
    bounced,
  ] = await Promise.all([
    db.communication.count({ where: { direction: "OUTBOUND" } }),
    db.communication.count({ where: { direction: "INBOUND" } }),
    db.conversation.count({ where: { attentionStatus: "OPERATOR_REQUIRED" } }),
    db.conversation.count({ where: { attentionStatus: "EXCEPTION" } }),
    db.person.count({ where: { doNotContact: true } }),
    db.communication.count({ where: { status: "FAILED" } }),
    db.communication.count({ where: { status: "DELIVERED" } }),
    db.communication.count({ where: { status: "BOUNCED" } }),
  ]);

  // "Automated" vs. "human-reviewed" isn't a stored status -- it's
  // whichever communications came out of an AUTOMATED-attention
  // conversation vs. one that needed a human. Approximated here as
  // outbound communications on AUTOMATED-attention conversations vs.
  // everything else outbound; revisit once individual Communication
  // rows record which path actually produced them.
  const [automatedResponses, humanReviewedResponses] = await Promise.all([
    db.communication.count({
      where: { direction: "OUTBOUND", conversation: { attentionStatus: "AUTOMATED" } },
    }),
    db.communication.count({
      where: { direction: "OUTBOUND", conversation: { attentionStatus: { not: "AUTOMATED" } } },
    }),
  ]);

  return computeDashboardMetrics({
    messagesSent,
    messagesReceived,
    automatedResponses,
    humanReviewedResponses,
    pendingResponses,
    exceptions,
    optOuts,
    failedCommunications,
    delivered,
    bounced,
  });
}
