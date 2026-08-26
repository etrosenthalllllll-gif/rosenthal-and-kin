import { describe, it, expect } from "vitest";
import {
  canTransitionDecision,
  assertValidDecisionTransition,
  isTerminalDecisionStatus,
  InvalidDecisionTransitionError,
} from "./decisionStatus";

describe("decision status state machine", () => {
  it("allows PENDING to move to any first-line outcome", () => {
    for (const to of ["IN_PROGRESS", "APPROVED", "REJECTED", "REVISED", "ESCALATED", "DEFERRED"] as const) {
      expect(canTransitionDecision("PENDING", to)).toBe(true);
    }
  });

  it("requires APPROVED/REJECTED to pass through COMPLETED, not skip it", () => {
    expect(canTransitionDecision("APPROVED", "COMPLETED")).toBe(true);
    expect(canTransitionDecision("REJECTED", "COMPLETED")).toBe(true);
  });

  it("does not allow APPROVED or REJECTED to transition anywhere else", () => {
    expect(canTransitionDecision("APPROVED", "PENDING")).toBe(false);
    expect(canTransitionDecision("REJECTED", "REVISED")).toBe(false);
  });

  it("ESCALATED can only return to the active queue or be cancelled, never self-resolve", () => {
    expect(canTransitionDecision("ESCALATED", "PENDING")).toBe(true);
    expect(canTransitionDecision("ESCALATED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionDecision("ESCALATED", "CANCELLED")).toBe(true);
    expect(canTransitionDecision("ESCALATED", "APPROVED")).toBe(false);
    expect(canTransitionDecision("ESCALATED", "REJECTED")).toBe(false);
  });

  it("REVISED goes back to PENDING for re-decision, not straight to APPROVED", () => {
    expect(canTransitionDecision("REVISED", "PENDING")).toBe(true);
    expect(canTransitionDecision("REVISED", "APPROVED")).toBe(false);
  });

  it("terminal statuses have no outgoing transitions", () => {
    for (const status of ["COMPLETED", "EXPIRED", "CANCELLED"] as const) {
      expect(isTerminalDecisionStatus(status)).toBe(true);
      expect(canTransitionDecision(status, "PENDING")).toBe(false);
    }
  });

  it("rejects no-op transitions", () => {
    expect(canTransitionDecision("PENDING", "PENDING")).toBe(false);
  });

  it("assertValidDecisionTransition throws a typed error", () => {
    expect(() => assertValidDecisionTransition("APPROVED", "PENDING")).toThrow(
      InvalidDecisionTransitionError
    );
  });
});
