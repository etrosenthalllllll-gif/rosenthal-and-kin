import { describe, it, expect } from "vitest";
import { evaluateClaimCompleteness, type CompletenessSignal } from "./claimCompletenessEngine";

describe("claim completeness engine", () => {
  it("is COMPLETE when every signal is satisfied", () => {
    const signals: CompletenessSignal[] = [
      { key: "documents", isHardBlocker: true, satisfied: true, explanation: "" },
      { key: "signatures", isHardBlocker: false, satisfied: true, explanation: "" },
    ];
    const result = evaluateClaimCompleteness(signals);
    expect(result.status).toBe("COMPLETE");
    expect(result.explanation).not.toBe("");
  });

  it("an unsatisfied hard blocker forces INCOMPLETE regardless of everything else being satisfied", () => {
    const signals: CompletenessSignal[] = [
      { key: "identity", isHardBlocker: true, satisfied: false, explanation: "Identity not yet verified." },
      { key: "signatures", isHardBlocker: false, satisfied: true, explanation: "" },
      { key: "exhibits", isHardBlocker: false, satisfied: true, explanation: "" },
    ];
    const result = evaluateClaimCompleteness(signals);
    expect(result.status).toBe("INCOMPLETE");
    expect(result.hardBlockers).toHaveLength(1);
  });

  it("an unsatisfied soft signal alone produces REQUIRES_REVIEW, never INCOMPLETE", () => {
    const signals: CompletenessSignal[] = [
      { key: "documents", isHardBlocker: true, satisfied: true, explanation: "" },
      { key: "competingHeir", isHardBlocker: false, satisfied: false, explanation: "A potential competing heir needs review." },
    ];
    const result = evaluateClaimCompleteness(signals);
    expect(result.status).toBe("REQUIRES_REVIEW");
    expect(result.softWarnings).toHaveLength(1);
  });

  it("never returns a bare status with no explanation", () => {
    const signals: CompletenessSignal[] = [
      { key: "documents", isHardBlocker: true, satisfied: false, explanation: "Missing death certificate." },
    ];
    const result = evaluateClaimCompleteness(signals);
    expect(result.explanation).toContain("Missing death certificate.");
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  it("with no signals at all, is COMPLETE (nothing outstanding)", () => {
    const result = evaluateClaimCompleteness([]);
    expect(result.status).toBe("COMPLETE");
  });
});
