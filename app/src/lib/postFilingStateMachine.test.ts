import { describe, it, expect } from "vitest";
import {
  canTransitionPostFilingCase,
  assertValidPostFilingTransition,
  isTerminalPostFilingStatus,
  InvalidPostFilingTransitionError,
} from "./postFilingStateMachine";

describe("post-filing case state machine", () => {
  it("allows the documented happy path", () => {
    expect(canTransitionPostFilingCase("FILED", "RECEIVED")).toBe(true);
    expect(canTransitionPostFilingCase("RECEIVED", "PROCESSING")).toBe(true);
    expect(canTransitionPostFilingCase("PROCESSING", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionPostFilingCase("UNDER_REVIEW", "DECISION_PENDING")).toBe(true);
    expect(canTransitionPostFilingCase("DECISION_PENDING", "APPROVED")).toBe(true);
    expect(canTransitionPostFilingCase("PAYMENT_PENDING", "COMPLETED")).toBe(true);
    expect(canTransitionPostFilingCase("COMPLETED", "CLOSED")).toBe(true);
  });

  it("UNDER_REVIEW branches to additional-info/hearing/court-event/denied", () => {
    expect(canTransitionPostFilingCase("UNDER_REVIEW", "ADDITIONAL_INFORMATION_REQUIRED")).toBe(true);
    expect(canTransitionPostFilingCase("UNDER_REVIEW", "HEARING_SCHEDULED")).toBe(true);
    expect(canTransitionPostFilingCase("UNDER_REVIEW", "COURT_EVENT_PENDING")).toBe(true);
    expect(canTransitionPostFilingCase("UNDER_REVIEW", "DENIED")).toBe(true);
  });

  it("ADDITIONAL_INFORMATION_REQUIRED collapses back to PROCESSING once resolved", () => {
    expect(canTransitionPostFilingCase("ADDITIONAL_INFORMATION_REQUIRED", "PROCESSING")).toBe(true);
  });

  it("HEARING_SCHEDULED/COURT_EVENT_PENDING lead to DECISION_PENDING", () => {
    expect(canTransitionPostFilingCase("HEARING_SCHEDULED", "DECISION_PENDING")).toBe(true);
    expect(canTransitionPostFilingCase("COURT_EVENT_PENDING", "DECISION_PENDING")).toBe(true);
  });

  it("APPROVED can skip settlement and go straight to payment or completion", () => {
    expect(canTransitionPostFilingCase("APPROVED", "PAYMENT_PENDING")).toBe(true);
    expect(canTransitionPostFilingCase("APPROVED", "COMPLETED")).toBe(true);
  });

  it("DENIED leads only to CLOSED", () => {
    expect(canTransitionPostFilingCase("DENIED", "CLOSED")).toBe(true);
    expect(canTransitionPostFilingCase("DENIED", "APPROVED")).toBe(false);
  });

  it("allows ESCALATED/ON_HOLD from any non-terminal state", () => {
    for (const from of ["FILED", "PROCESSING", "UNDER_REVIEW", "HEARING_SCHEDULED"] as const) {
      expect(canTransitionPostFilingCase(from, "ESCALATED")).toBe(true);
      expect(canTransitionPostFilingCase(from, "ON_HOLD")).toBe(true);
    }
  });

  it("rejects skipping states", () => {
    expect(canTransitionPostFilingCase("FILED", "COMPLETED")).toBe(false);
  });

  it("rejects moving backward", () => {
    expect(canTransitionPostFilingCase("PROCESSING", "RECEIVED")).toBe(false);
  });

  it("does not allow transitions out of CLOSED", () => {
    expect(canTransitionPostFilingCase("CLOSED", "FILED")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    expect(canTransitionPostFilingCase("FILED", "FILED")).toBe(false);
  });

  it("isTerminalPostFilingStatus reports only CLOSED as terminal", () => {
    expect(isTerminalPostFilingStatus("CLOSED")).toBe(true);
    expect(isTerminalPostFilingStatus("DENIED")).toBe(false);
    expect(isTerminalPostFilingStatus("ESCALATED")).toBe(false);
  });

  it("assertValidPostFilingTransition throws a typed error on invalid transitions", () => {
    expect(() => assertValidPostFilingTransition("FILED", "COMPLETED")).toThrow(InvalidPostFilingTransitionError);
    expect(() => assertValidPostFilingTransition("FILED", "RECEIVED")).not.toThrow();
  });
});
