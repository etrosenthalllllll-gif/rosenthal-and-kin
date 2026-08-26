import { describe, it, expect } from "vitest";
import {
  detectEventOrderException,
  validateAutomatedTransition,
  detectWorkflowConflicts,
  isRaceProtected,
} from "./concurrencyGuard";

const FILING_SEQUENCE = ["SUBMITTED", "RECEIVED", "PROCESSING", "ACCEPTED"];

describe("event ordering", () => {
  it("flags ACCEPTED arriving before SUBMITTED -- the doc's own example", () => {
    expect(detectEventOrderException(FILING_SEQUENCE, new Set(), "ACCEPTED")).toBe(true);
  });

  it("allows a stage once every prior stage has been seen", () => {
    const seen = new Set(["SUBMITTED", "RECEIVED", "PROCESSING"]);
    expect(detectEventOrderException(FILING_SEQUENCE, seen, "ACCEPTED")).toBe(false);
  });

  it("never blocks the first stage in the sequence", () => {
    expect(detectEventOrderException(FILING_SEQUENCE, new Set(), "SUBMITTED")).toBe(false);
  });

  it("never blocks a stage this sequence doesn't know about", () => {
    expect(detectEventOrderException(FILING_SEQUENCE, new Set(), "UNKNOWN_STAGE")).toBe(false);
  });
});

describe("generic state-transition validation", () => {
  const isAllowed = (from: string, to: string) => from === "DRAFT" && to === "REVIEW";

  it("delegates to the caller's own transition check", () => {
    expect(validateAutomatedTransition("DRAFT", "REVIEW", isAllowed)).toBe("ALLOWED");
    expect(validateAutomatedTransition("DRAFT", "CLOSED", isAllowed)).toBe("BLOCKED_INVALID_TRANSITION");
  });
});

describe("workflow conflict detection", () => {
  it("flags claim preparation as conflicting with an active case-closure workflow", () => {
    const conflicts = detectWorkflowConflicts(["CASE_CLOSURE"], "CLAIM_PREPARATION");
    expect(conflicts).toEqual([{ activeWorkflowType: "CASE_CLOSURE" }]);
  });

  it("returns no conflicts for two unrelated workflow types", () => {
    expect(detectWorkflowConflicts(["DOCUMENT_INTAKE"], "CLAIM_PREPARATION")).toEqual([]);
  });

  it("is symmetric: the reverse pairing conflicts too", () => {
    const conflicts = detectWorkflowConflicts(["CLAIM_PREPARATION"], "CASE_CLOSURE");
    expect(conflicts).toEqual([{ activeWorkflowType: "CLAIM_PREPARATION" }]);
  });
});

describe("optimistic-lock race protection", () => {
  it("is protected (safe to proceed) when the lock key isn't already claimed", () => {
    expect(isRaceProtected("approval-1", new Set())).toBe(true);
  });

  it("is not protected once another actor already claimed the same key", () => {
    expect(isRaceProtected("approval-1", new Set(["approval-1"]))).toBe(false);
  });
});
