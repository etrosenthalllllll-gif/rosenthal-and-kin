// Decision queue view-model builder -- doc 02's "smart queue" UI, backed
// by real Decision/Claimant/Estate/Person rows once they exist.
//
// Split the same way src/lib/audit.ts is: a pure function
// (buildDecisionQueue) that does all the actual logic and is fully
// unit-tested with fixtures, and a thin DB-fetching wrapper
// (fetchDecisionQueue) that isn't -- there's nothing to unit-test in "call
// Prisma, pass the result to the pure function" beyond what integration
// tests would eventually cover.

import type { PrismaClient } from "@prisma/client";
import { rankByPriority, type PriorityScore } from "./priority";
import { getDecisionTypeConfig } from "./decisionTypes";

export interface DecisionQueueRow {
  id: string;
  decisionType: string;
  status: string;
  deadline: Date | null;
  aiConfidence: number | null;
  createdAt: Date;
  claimant: {
    id: string;
    status: string;
    person: { firstName: string; lastName: string };
    estate: {
      id: string;
      caseNumber: string;
      decedentName: string;
      estimatedValueCents: number | null;
    };
  };
}

export interface DecisionQueueItem {
  id: string;
  decisionTypeKey: string;
  decisionTypeDisplayName: string;
  status: string;
  deadline: Date | null;
  claimantId: string;
  claimantName: string;
  claimantStatus: string;
  caseNumber: string;
  decedentName: string;
  estimatedValueCents: number | null;
  priority: PriorityScore;
}

/**
 * Pure: turns raw Decision rows (with claimant/estate/person already
 * joined) into ranked view models. No DB access -- fully unit-testable.
 * `now` is injectable for deterministic tests, same as computePriorityScore.
 */
export function buildDecisionQueue(
  rows: readonly DecisionQueueRow[],
  now?: Date
): DecisionQueueItem[] {
  const withPriorityInputs = rows.map((row) => {
    const config = getDecisionTypeConfig(row.decisionType);
    return {
      ...row,
      potentialRecoveryCents: row.claimant.estate.estimatedValueCents,
      highConsequence: config.highConsequence,
      now,
    };
  });

  return rankByPriority(withPriorityInputs).map((row) => ({
    id: row.id,
    decisionTypeKey: row.decisionType,
    decisionTypeDisplayName: getDecisionTypeConfig(row.decisionType).displayName,
    status: row.status,
    deadline: row.deadline,
    claimantId: row.claimant.id,
    claimantName: `${row.claimant.person.firstName} ${row.claimant.person.lastName}`,
    claimantStatus: row.claimant.status,
    caseNumber: row.claimant.estate.caseNumber,
    decedentName: row.claimant.estate.decedentName,
    estimatedValueCents: row.claimant.estate.estimatedValueCents,
    priority: row.priority,
  }));
}

/**
 * Fetches all PENDING decisions with their claimant/estate/person joined,
 * and ranks them. Not unit-tested (it's a direct Prisma call with no
 * branching logic of its own) -- buildDecisionQueue is where the actual
 * logic lives and is tested.
 */
export async function fetchDecisionQueue(
  db: PrismaClient
): Promise<DecisionQueueItem[]> {
  const rows = await db.decision.findMany({
    where: { status: "PENDING" },
    include: {
      claimant: {
        include: { person: true, estate: true },
      },
    },
  });

  return buildDecisionQueue(rows);
}
