import { describe, it, expect } from "vitest";
import { evaluateReviewTriggers, getTriggerRisk } from "./humanReviewTriggers";

describe("getTriggerRisk", () => {
  it("classifies a competing heir as CRITICAL (doc 06 sec 46's own example)", () => {
    expect(getTriggerRisk("COMPETING_HEIR_DETECTED")).toBe("CRITICAL");
  });

  it("classifies a plausible identity match ambiguity as CRITICAL (doc 06 sec 29's example)", () => {
    expect(getTriggerRisk("PLAUSIBLE_IDENTITY_MATCH_AMBIGUITY")).toBe("CRITICAL");
  });

  it("classifies genealogy incompleteness as MEDIUM", () => {
    expect(getTriggerRisk("GENEALOGY_BRANCH_INCOMPLETE")).toBe("MEDIUM");
  });
});

describe("evaluateReviewTriggers", () => {
  it("does not require review when nothing fired -- null risk, not LOW", () => {
    const result = evaluateReviewTriggers([]);
    expect(result.requiresReview).toBe(false);
    expect(result.overallRisk).toBeNull();
  });

  it("requires review whenever any trigger fires, per doc 06's unconditional rule", () => {
    const result = evaluateReviewTriggers([{ type: "GENEALOGY_BRANCH_INCOMPLETE" }]);
    expect(result.requiresReview).toBe(true);
  });

  it("reports the single highest risk level among multiple fired triggers", () => {
    const result = evaluateReviewTriggers([
      { type: "GENEALOGY_BRANCH_INCOMPLETE" }, // MEDIUM
      { type: "COMPETING_HEIR_DETECTED" }, // CRITICAL
      { type: "AI_CANNOT_EXPLAIN_CONCLUSION" }, // HIGH
    ]);
    expect(result.overallRisk).toBe("CRITICAL");
    expect(result.firedTriggers).toHaveLength(3);
  });

  it("preserves each trigger's own detail text for the operator", () => {
    const result = evaluateReviewTriggers([
      { type: "OPERATOR_REQUESTED_REVIEW", detail: "Operator flagged this case manually." },
    ]);
    expect(result.firedTriggers[0].detail).toBe("Operator flagged this case manually.");
  });
});
