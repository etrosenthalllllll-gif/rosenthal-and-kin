import { describe, it, expect } from "vitest";
import {
  evaluateFinancialClosureReadiness,
  reopenFinancialCase,
  type FinancialClosureReadinessInput,
  type FinancialClosureRecord,
} from "./financialClosure";

function readyInput(overrides: Partial<FinancialClosureReadinessInput> = {}): FinancialClosureReadinessInput {
  return {
    recoveryVerified: true,
    distributionComplete: true,
    feesCalculated: true,
    invoicePaidWhereApplicable: true,
    noOutstandingBalance: true,
    noOpenDispute: true,
    noUnresolvedReconciliationException: true,
    ...overrides,
  };
}

describe("financial closure readiness", () => {
  it("can close when every check passes", () => {
    const result = evaluateFinancialClosureReadiness(readyInput());
    expect(result.canClose).toBe(true);
  });

  it("cannot close with an outstanding balance", () => {
    const result = evaluateFinancialClosureReadiness(readyInput({ noOutstandingBalance: false }));
    expect(result.canClose).toBe(false);
    expect(result.blockers.some((b) => b.key === "noOutstandingBalance")).toBe(true);
  });

  it("cannot close with an open dispute", () => {
    const result = evaluateFinancialClosureReadiness(readyInput({ noOpenDispute: false }));
    expect(result.canClose).toBe(false);
  });

  it("lists every failing check, not just the first", () => {
    const result = evaluateFinancialClosureReadiness(readyInput({ noOutstandingBalance: false, noOpenDispute: false }));
    expect(result.blockers).toHaveLength(2);
  });
});

describe("financial case reopening", () => {
  const closure: FinancialClosureRecord = {
    reason: "Recovery received and distributed",
    finalRecoveryCents: 24_850_00,
    finalFeesCents: 2_500_00,
    finalDistributionCents: 22_350_00,
    finalOutstandingBalanceCents: 0,
    closedAt: "2026-09-20T00:00:00.000Z",
    closedBy: "system",
  };

  it("rejects an empty reopen reason", () => {
    const result = reopenFinancialCase(closure, "", "operator-1", "2026-09-26T00:00:00.000Z");
    expect(result.status).toBe("REJECTED_MISSING_REASON");
  });

  it("preserves the prior closure record on a successful reopen", () => {
    const result = reopenFinancialCase(closure, "Payment reversal received after closure", "operator-1", "2026-09-26T00:00:00.000Z");
    expect(result.status).toBe("REOPENED");
    expect(result.preservedClosure).toEqual(closure);
  });
});
