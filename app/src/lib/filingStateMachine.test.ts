import { describe, it, expect } from "vitest";
import {
  canTransitionFiling,
  assertValidFilingTransition,
  isTerminalFilingStatus,
  InvalidFilingTransitionError,
} from "./filingStateMachine";

describe("filing state machine", () => {
  it("allows the documented happy path", () => {
    expect(canTransitionFiling("NOT_READY", "READY_FOR_FILING")).toBe(true);
    expect(canTransitionFiling("APPROVED_TO_FILE", "PREPARING_SUBMISSION")).toBe(true);
    expect(canTransitionFiling("SUBMITTING", "SUBMITTED")).toBe(true);
    expect(canTransitionFiling("RECEIVED", "PROCESSING")).toBe(true);
    expect(canTransitionFiling("PROCESSING", "ACCEPTED")).toBe(true);
    expect(canTransitionFiling("ACCEPTED", "CLOSED")).toBe(true);
  });

  it("allows skipping the payment branch when no payment is required", () => {
    expect(canTransitionFiling("PREPARING_SUBMISSION", "SUBMITTING")).toBe(true);
  });

  it("allows the payment branch when payment is required", () => {
    expect(canTransitionFiling("PREPARING_SUBMISSION", "AWAITING_PAYMENT")).toBe(true);
    expect(canTransitionFiling("AWAITING_PAYMENT", "PAYMENT_PROCESSING")).toBe(true);
    expect(canTransitionFiling("PAYMENT_PROCESSING", "PAYMENT_COMPLETE")).toBe(true);
    expect(canTransitionFiling("PAYMENT_COMPLETE", "SUBMITTING")).toBe(true);
  });

  it("rejects skipping states", () => {
    expect(canTransitionFiling("NOT_READY", "SUBMITTED")).toBe(false);
  });

  it("rejects moving backward on the happy path", () => {
    expect(canTransitionFiling("SUBMITTED", "SUBMITTING")).toBe(false);
  });

  it("PROCESSING can branch to ACCEPTED, PENDING, or REJECTED", () => {
    expect(canTransitionFiling("PROCESSING", "ACCEPTED")).toBe(true);
    expect(canTransitionFiling("PROCESSING", "PENDING")).toBe(true);
    expect(canTransitionFiling("PROCESSING", "REJECTED")).toBe(true);
  });

  it("a rejection can lead through correction to resubmission as a new attempt", () => {
    expect(canTransitionFiling("REJECTED", "CORRECTION_REQUIRED")).toBe(true);
    expect(canTransitionFiling("CORRECTION_REQUIRED", "RESUBMISSION_REQUIRED")).toBe(true);
    expect(canTransitionFiling("RESUBMISSION_REQUIRED", "RESUBMITTED")).toBe(true);
    expect(canTransitionFiling("RESUBMITTED", "PROCESSING")).toBe(true);
  });

  it("allows CANCELLED/FAILED from a non-terminal state", () => {
    for (const from of ["NOT_READY", "SUBMITTING", "PROCESSING", "REJECTED"] as const) {
      expect(canTransitionFiling(from, "CANCELLED")).toBe(true);
      expect(canTransitionFiling(from, "FAILED")).toBe(true);
    }
  });

  it("does not allow transitions out of terminal states", () => {
    expect(canTransitionFiling("CLOSED", "ACCEPTED")).toBe(false);
    expect(canTransitionFiling("FAILED", "NOT_READY")).toBe(false);
    expect(canTransitionFiling("CANCELLED", "NOT_READY")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    expect(canTransitionFiling("NOT_READY", "NOT_READY")).toBe(false);
  });

  it("isTerminalFilingStatus reports the three terminal states correctly", () => {
    expect(isTerminalFilingStatus("CLOSED")).toBe(true);
    expect(isTerminalFilingStatus("FAILED")).toBe(true);
    expect(isTerminalFilingStatus("CANCELLED")).toBe(true);
    expect(isTerminalFilingStatus("NOT_READY")).toBe(false);
    expect(isTerminalFilingStatus("REJECTED")).toBe(false);
  });

  it("assertValidFilingTransition throws a typed error on invalid transitions", () => {
    expect(() => assertValidFilingTransition("NOT_READY", "SUBMITTED")).toThrow(InvalidFilingTransitionError);
    expect(() => assertValidFilingTransition("NOT_READY", "READY_FOR_FILING")).not.toThrow();
  });
});
