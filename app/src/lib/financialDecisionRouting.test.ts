import { describe, it, expect } from "vitest";
import { planFinancialReconciliationDecision } from "./financialDecisionRouting";

describe("financial reconciliation decision routing", () => {
  it("returns no decision on PASS", () => {
    expect(planFinancialReconciliationDecision("estate-1", { outcome: "PASS", exceptions: [] })).toBeNull();
  });

  it("recommends a decision naming every exception on EXCEPTION", () => {
    const result = planFinancialReconciliationDecision("estate-1", {
      outcome: "EXCEPTION",
      exceptions: ["DISTRIBUTION_MISMATCH", "DUPLICATE_PAYMENT"],
    });
    expect(result?.decisionTypeKey).toBe("REVIEW_FINANCIAL_EXCEPTION");
    expect(result?.reason).toContain("DISTRIBUTION_MISMATCH");
    expect(result?.reason).toContain("DUPLICATE_PAYMENT");
    expect(result?.evidenceRefs).toEqual(["estate-1"]);
  });
});
