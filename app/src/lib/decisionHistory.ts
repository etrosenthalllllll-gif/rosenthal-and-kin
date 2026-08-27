// Decision history for one claimant -- doc 02 section 14 "DECISION
// HISTORY": "Every decision, once resolved, should remain visible with
// who decided it, when, and why." The Decision row itself already
// carries all of this (decidedByUserId/decidedAt/reason/selectedAction);
// this is just the first read path for it.

import type { PrismaClient } from "@prisma/client";
import { getDecisionTypeConfig } from "./decisionTypes";

export interface DecisionHistoryItem {
  id: string;
  decisionTypeDisplayName: string;
  status: string;
  selectedAction: string | null;
  reason: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

/**
 * Fetches every non-PENDING/non-IN_PROGRESS decision for a claimant,
 * most recently decided first -- the resolved record doc 02 section 14
 * asks to keep visible. Still-active decisions belong in the live queue
 * (decisionQueue.ts), not here.
 */
export async function fetchDecisionHistory(
  db: PrismaClient,
  claimantId: string
): Promise<DecisionHistoryItem[]> {
  const rows = await db.decision.findMany({
    where: { claimantId, status: { notIn: ["PENDING", "IN_PROGRESS"] } },
    include: { decidedBy: true },
    orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    decisionTypeDisplayName: getDecisionTypeConfig(row.decisionType).displayName,
    status: row.status,
    selectedAction: row.selectedAction,
    reason: row.reason,
    decidedByName: row.decidedBy?.name ?? null,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  }));
}
