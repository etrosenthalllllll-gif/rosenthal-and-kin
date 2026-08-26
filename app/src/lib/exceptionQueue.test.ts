import { describe, it, expect } from "vitest";
import { isExceptionDecisionType, splitQueueByLane, buildExceptionQueue } from "./exceptionQueue";
import type { DecisionQueueItem } from "./decisionQueue";

function fixture(decisionTypeKey: string, score: number): DecisionQueueItem {
  return {
    id: `decision-${decisionTypeKey}-${score}`,
    decisionTypeKey,
    decisionTypeDisplayName: decisionTypeKey,
    status: "PENDING",
    deadline: null,
    claimantId: "claimant-1",
    claimantName: "Jane Smith",
    claimantStatus: "DOCUMENTS_REQUESTED",
    caseNumber: "RK-1",
    decedentName: "John Smith",
    estimatedValueCents: 100_000_00,
    priority: { score, label: "MEDIUM", components: { value: 0, deadline: 0, age: 0, risk: 0, confidence: 0, highConsequenceBonus: 0, competingHeirs: 0, unresolvedIssues: 0 } },
  };
}

describe("isExceptionDecisionType", () => {
  it("is true for an exception-category decision type", () => {
    expect(isExceptionDecisionType("RESOLVE_LOW_CONFIDENCE")).toBe(true);
  });

  it("is false for a routine decision type", () => {
    expect(isExceptionDecisionType("APPROVE_OUTREACH")).toBe(false);
  });
});

describe("splitQueueByLane", () => {
  it("separates routine decisions from exceptions", () => {
    const items = [
      fixture("APPROVE_OUTREACH", 50),
      fixture("RESOLVE_CONFLICTING_EVIDENCE", 80),
      fixture("REQUEST_DOCUMENTS", 30),
      fixture("RESOLVE_DUPLICATE_CASE", 60),
    ];

    const { decisions, exceptions } = splitQueueByLane(items);

    expect(decisions.map((d) => d.decisionTypeKey)).toEqual(["APPROVE_OUTREACH", "REQUEST_DOCUMENTS"]);
    expect(exceptions.map((d) => d.decisionTypeKey)).toEqual([
      "RESOLVE_CONFLICTING_EVIDENCE",
      "RESOLVE_DUPLICATE_CASE",
    ]);
  });

  it("preserves the existing priority order within each lane rather than re-ranking", () => {
    const items = [fixture("RESOLVE_LOW_CONFIDENCE", 20), fixture("RESOLVE_DUPLICATE_CASE", 90)];
    const { exceptions } = splitQueueByLane(items);
    // Input order preserved, not re-sorted by score -- splitQueueByLane
    // trusts the caller already ranked the queue.
    expect(exceptions[0].priority.score).toBe(20);
    expect(exceptions[1].priority.score).toBe(90);
  });

  it("returns empty lanes for an empty queue", () => {
    expect(splitQueueByLane([])).toEqual({ decisions: [], exceptions: [] });
  });
});

describe("buildExceptionQueue", () => {
  it("returns only the exception lane", () => {
    const items = [fixture("APPROVE_OUTREACH", 50), fixture("RESOLVE_INVALID_DOCUMENT", 70)];
    const result = buildExceptionQueue(items);
    expect(result).toHaveLength(1);
    expect(result[0].decisionTypeKey).toBe("RESOLVE_INVALID_DOCUMENT");
  });
});
