// Exception / review queue -- doc 02 section 12. "Build a dedicated
// exception queue... Never silently suppress exceptions."
//
// Deliberately NOT a new database entity: exceptions are Decisions
// whose decisionType is flagged category "EXCEPTION" in
// decisionTypes.ts, reusing the exact same Decision/DecisionStatus
// state machine, priority engine, and audit trail already built for
// the normal decision queue -- matching this codebase's existing
// "reuse the architecture, don't build a competing one" pattern (the
// same reasoning audit.ts and decisionQueue.ts already follow). This
// module just splits one ranked queue into two lanes.

import { getDecisionTypeConfig } from "./decisionTypes";
import type { DecisionQueueItem } from "./decisionQueue";

export function isExceptionDecisionType(decisionTypeKey: string): boolean {
  return getDecisionTypeConfig(decisionTypeKey).category === "EXCEPTION";
}

export interface SplitQueue {
  decisions: DecisionQueueItem[];
  exceptions: DecisionQueueItem[];
}

/**
 * Splits an already-ranked queue (e.g. from buildDecisionQueue) into the
 * routine-decision lane and the exception lane, preserving each item's
 * existing priority order within its lane. Pure -- no DB access, no
 * re-ranking.
 */
export function splitQueueByLane(items: readonly DecisionQueueItem[]): SplitQueue {
  const decisions: DecisionQueueItem[] = [];
  const exceptions: DecisionQueueItem[] = [];

  for (const item of items) {
    if (isExceptionDecisionType(item.decisionTypeKey)) {
      exceptions.push(item);
    } else {
      decisions.push(item);
    }
  }

  return { decisions, exceptions };
}

/**
 * Convenience wrapper for just the exception lane, since that's the
 * queue the exception-review UI reads from.
 */
export function buildExceptionQueue(items: readonly DecisionQueueItem[]): DecisionQueueItem[] {
  return splitQueueByLane(items).exceptions;
}
