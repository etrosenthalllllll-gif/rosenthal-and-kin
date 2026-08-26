import { describe, it, expect } from "vitest";
import { evaluateClosureReadiness, reopenCase, type ClosureReadinessInput, type ClosureRecord } from "./postFilingClosure";

function readyInput(overrides: Partial<ClosureReadinessInput> = {}): ClosureReadinessInput {
  return {
    hasOutstandingDeadline: false,
    hasUnresolvedDocumentRequest: false,
    hasUnresolvedEscalation: false,
    hasActiveHearing: false,
    finalStatusCaptured: true,
    finalDocumentsStored: true,
    ...overrides,
  };
}

describe("closure readiness", () => {
  it("can close when every check passes", () => {
    const result = evaluateClosureReadiness(readyInput());
    expect(result.canClose).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("cannot close with an outstanding deadline", () => {
    const result = evaluateClosureReadiness(readyInput({ hasOutstandingDeadline: true }));
    expect(result.canClose).toBe(false);
    expect(result.blockers.some((b) => b.key === "hasOutstandingDeadline")).toBe(true);
  });

  it("cannot close with an active hearing", () => {
    const result = evaluateClosureReadiness(readyInput({ hasActiveHearing: true }));
    expect(result.canClose).toBe(false);
  });

  it("cannot close if the final status hasn't been captured", () => {
    const result = evaluateClosureReadiness(readyInput({ finalStatusCaptured: false }));
    expect(result.canClose).toBe(false);
    expect(result.blockers.some((b) => b.key === "finalStatusCaptured")).toBe(true);
  });

  it("lists every failing check, not just the first", () => {
    const result = evaluateClosureReadiness(readyInput({ hasOutstandingDeadline: true, hasActiveHearing: true }));
    expect(result.blockers).toHaveLength(2);
  });
});

describe("case reopening", () => {
  const closure: ClosureRecord = { reason: "CLAIM_ACCEPTED", closedAt: "2026-08-01T00:00:00.000Z", closedBy: "system" };

  it("rejects an empty reopen reason", () => {
    const result = reopenCase(closure, "", "operator-1", "2026-08-26T00:00:00.000Z");
    expect(result.status).toBe("REJECTED_MISSING_REASON");
  });

  it("rejects a whitespace-only reopen reason", () => {
    const result = reopenCase(closure, "   ", "operator-1", "2026-08-26T00:00:00.000Z");
    expect(result.status).toBe("REJECTED_MISSING_REASON");
  });

  it("preserves the prior closure record on a successful reopen", () => {
    const result = reopenCase(closure, "New authority notice received.", "operator-1", "2026-08-26T00:00:00.000Z");
    expect(result.status).toBe("REOPENED");
    expect(result.preservedClosure).toEqual(closure);
    expect(result.reopenReason).toBe("New authority notice received.");
  });
});
