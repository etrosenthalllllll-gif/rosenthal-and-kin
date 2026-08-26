import { describe, it, expect } from "vitest";
import {
  canTransitionPreparation,
  assertValidPreparationTransition,
  isTerminalPreparationStatus,
  InvalidClaimPreparationTransitionError,
} from "./claimPreparationStateMachine";

describe("claim preparation state machine", () => {
  it("allows the documented happy path", () => {
    expect(canTransitionPreparation("NOT_STARTED", "INITIALIZING")).toBe(true);
    expect(canTransitionPreparation("INITIALIZING", "JURISDICTION_REVIEW")).toBe(true);
    expect(canTransitionPreparation("EXHIBIT_ASSEMBLY", "SIGNATURE_PENDING")).toBe(true);
    expect(canTransitionPreparation("READY_FOR_APPROVAL", "APPROVED_FOR_FILING")).toBe(true);
    expect(canTransitionPreparation("APPROVED_FOR_FILING", "FILED")).toBe(true);
  });

  it("rejects skipping states", () => {
    expect(canTransitionPreparation("NOT_STARTED", "FILED")).toBe(false);
    expect(canTransitionPreparation("JURISDICTION_REVIEW", "READY_FOR_APPROVAL")).toBe(false);
  });

  it("rejects moving backward on the happy path", () => {
    expect(canTransitionPreparation("FILED", "APPROVED_FOR_FILING")).toBe(false);
    expect(canTransitionPreparation("FORM_POPULATION", "FORMS_SELECTED")).toBe(false);
  });

  it("allows REJECTED, CANCELLED, SUPERSEDED from any non-terminal state", () => {
    for (const from of ["NOT_STARTED", "FORM_POPULATION", "SIGNATURE_PENDING", "READY_FOR_APPROVAL"] as const) {
      expect(canTransitionPreparation(from, "REJECTED")).toBe(true);
      expect(canTransitionPreparation(from, "CANCELLED")).toBe(true);
      expect(canTransitionPreparation(from, "SUPERSEDED")).toBe(true);
    }
  });

  it("COMPLETENESS_REVIEW can move to REQUIRES_OPERATOR_REVIEW, which can then resolve to READY_FOR_APPROVAL", () => {
    expect(canTransitionPreparation("COMPLETENESS_REVIEW", "REQUIRES_OPERATOR_REVIEW")).toBe(true);
    expect(canTransitionPreparation("REQUIRES_OPERATOR_REVIEW", "READY_FOR_APPROVAL")).toBe(true);
  });

  it("does not allow transitions out of terminal states", () => {
    expect(canTransitionPreparation("FILED", "APPROVED_FOR_FILING")).toBe(false);
    expect(canTransitionPreparation("REJECTED", "NOT_STARTED")).toBe(false);
    expect(canTransitionPreparation("SUPERSEDED", "NOT_STARTED")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    expect(canTransitionPreparation("NOT_STARTED", "NOT_STARTED")).toBe(false);
  });

  it("isTerminalPreparationStatus reports the four terminal states correctly", () => {
    expect(isTerminalPreparationStatus("FILED")).toBe(true);
    expect(isTerminalPreparationStatus("REJECTED")).toBe(true);
    expect(isTerminalPreparationStatus("SUPERSEDED")).toBe(true);
    expect(isTerminalPreparationStatus("CANCELLED")).toBe(true);
    expect(isTerminalPreparationStatus("NOT_STARTED")).toBe(false);
    expect(isTerminalPreparationStatus("REQUIRES_OPERATOR_REVIEW")).toBe(false);
  });

  it("assertValidPreparationTransition throws a typed error on invalid transitions", () => {
    expect(() => assertValidPreparationTransition("NOT_STARTED", "FILED")).toThrow(
      InvalidClaimPreparationTransitionError
    );
    expect(() => assertValidPreparationTransition("NOT_STARTED", "INITIALIZING")).not.toThrow();
  });
});
