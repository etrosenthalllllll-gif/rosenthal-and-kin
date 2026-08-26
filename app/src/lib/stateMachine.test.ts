import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertValidTransition,
  isTerminal,
  InvalidClaimantTransitionError,
} from "./stateMachine";

describe("claimant state machine", () => {
  it("allows the documented happy path", () => {
    expect(canTransition("LEAD", "CONTACTED")).toBe(true);
    expect(canTransition("CONTACTED", "RESPONDED")).toBe(true);
    expect(canTransition("RESPONDED", "POTENTIAL_HEIR")).toBe(true);
    expect(canTransition("CLAIM_READY", "AWAITING_OPERATOR_APPROVAL")).toBe(true);
    expect(canTransition("AWAITING_OPERATOR_APPROVAL", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "FILED")).toBe(true);
    expect(canTransition("RECOVERY", "PAID")).toBe(true);
    expect(canTransition("PAID", "CLOSED")).toBe(true);
  });

  it("rejects skipping states", () => {
    expect(canTransition("LEAD", "APPROVED")).toBe(false);
    expect(canTransition("LEAD", "FILED")).toBe(false);
  });

  it("rejects moving backward on the happy path", () => {
    expect(canTransition("FILED", "APPROVED")).toBe(false);
    expect(canTransition("VERIFIED", "CONTACTED")).toBe(false);
  });

  it("allows REJECTED, WITHDRAWN, ESCALATED from any non-terminal state", () => {
    for (const from of ["LEAD", "ENGAGED", "CLAIM_READY", "FILED", "RECOVERY"] as const) {
      expect(canTransition(from, "REJECTED")).toBe(true);
      expect(canTransition(from, "WITHDRAWN")).toBe(true);
      expect(canTransition(from, "ESCALATED")).toBe(true);
    }
  });

  it("does not allow transitions out of terminal states except to CLOSED", () => {
    expect(canTransition("PAID", "RECOVERY")).toBe(false);
    expect(canTransition("REJECTED", "LEAD")).toBe(false);
    expect(canTransition("REJECTED", "CLOSED")).toBe(true);
    expect(canTransition("WITHDRAWN", "CLOSED")).toBe(true);
  });

  it("rejects no-op transitions", () => {
    expect(canTransition("LEAD", "LEAD")).toBe(false);
  });

  it("isTerminal reports the four terminal states correctly", () => {
    expect(isTerminal("PAID")).toBe(true);
    expect(isTerminal("CLOSED")).toBe(true);
    expect(isTerminal("REJECTED")).toBe(true);
    expect(isTerminal("WITHDRAWN")).toBe(true);
    expect(isTerminal("LEAD")).toBe(false);
    expect(isTerminal("ESCALATED")).toBe(false);
  });

  it("assertValidTransition throws a typed error on invalid transitions", () => {
    expect(() => assertValidTransition("LEAD", "PAID")).toThrow(
      InvalidClaimantTransitionError
    );
    expect(() => assertValidTransition("LEAD", "CONTACTED")).not.toThrow();
  });
});
