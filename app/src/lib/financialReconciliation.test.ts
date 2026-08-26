import { describe, it, expect } from "vitest";
import { evaluateFinancialReconciliation, type FinancialReconciliationInput } from "./financialReconciliation";

function reconciledInput(overrides: Partial<FinancialReconciliationInput> = {}): FinancialReconciliationInput {
  // Mirrors doc 10's own worked example: actual $24,850 - fees $2,500 =
  // distributed $22,350; invoiced $2,500 - paid $2,500 = outstanding $0.
  return {
    actualCents: 24_850_00,
    distributedCents: 22_350_00,
    feesCents: 2_500_00,
    invoicedCents: 2_500_00,
    paidCents: 2_500_00,
    outstandingCents: 0,
    ...overrides,
  };
}

describe("financial reconciliation", () => {
  it("PASSes on the doc's own worked example", () => {
    const result = evaluateFinancialReconciliation(reconciledInput());
    expect(result.outcome).toBe("PASS");
    expect(result.exceptions).toEqual([]);
  });

  it("flags a DISTRIBUTION_MISMATCH when actual - fees does not equal distributed", () => {
    const result = evaluateFinancialReconciliation(reconciledInput({ distributedCents: 20_000_00 }));
    expect(result.outcome).toBe("EXCEPTION");
    expect(result.exceptions).toContain("DISTRIBUTION_MISMATCH");
  });

  it("flags a PAYMENT_MISMATCH when invoiced - paid does not equal outstanding", () => {
    const result = evaluateFinancialReconciliation(reconciledInput({ outstandingCents: 500_00 }));
    expect(result.outcome).toBe("EXCEPTION");
    expect(result.exceptions).toContain("PAYMENT_MISMATCH");
  });

  it("merges in additional exceptions detected elsewhere", () => {
    const result = evaluateFinancialReconciliation(reconciledInput(), ["DUPLICATE_PAYMENT"]);
    expect(result.outcome).toBe("EXCEPTION");
    expect(result.exceptions).toContain("DUPLICATE_PAYMENT");
  });
});
