import { describe, it, expect } from "vitest";
import { findReconciliationDiscrepancies, evaluateWorkflowStaleness, evaluateSlaCompliance, computeSlaComplianceRate } from "./workflowReconciliation";

describe("nightly reconciliation sweep", () => {
  it("flags only the pairs that actually disagree", () => {
    const discrepancies = findReconciliationDiscrepancies([
      {
        dataObject: "filingStatus",
        entityId: "f-1",
        internalValue: "SUBMITTED",
        externalValue: "SUBMITTED",
        internalSystem: "Filing system",
        externalSystem: "Provider",
      },
      {
        dataObject: "invoiceBalance",
        entityId: "inv-1",
        internalValue: 500,
        externalValue: 450,
        internalSystem: "Financial system",
        externalSystem: "Payment provider",
      },
    ]);
    expect(discrepancies).toHaveLength(1);
    expect(discrepancies[0].dataObject).toBe("invoiceBalance");
  });
});

describe("stale workflow detection", () => {
  it("matches the doc's own worked example (30 min expected, 18 hours actual)", () => {
    const result = evaluateWorkflowStaleness(
      "2026-08-26T00:00:00.000Z",
      "2026-08-26T18:00:00.000Z",
      30 * 60 * 1000
    );
    expect(result.isStale).toBe(true);
  });

  it("does not flag a workflow within its expected duration", () => {
    const result = evaluateWorkflowStaleness("2026-08-26T00:00:00.000Z", "2026-08-26T00:15:00.000Z", 30 * 60 * 1000);
    expect(result.isStale).toBe(false);
  });

  it("does not flag a minor overrun within the threshold multiplier", () => {
    const result = evaluateWorkflowStaleness("2026-08-26T00:00:00.000Z", "2026-08-26T00:45:00.000Z", 30 * 60 * 1000);
    expect(result.isStale).toBe(false);
  });
});

describe("SLA compliance", () => {
  it("meets the SLA when actual is at or under the target", () => {
    expect(evaluateSlaCompliance(120_000, 120_000)).toBe("MET");
    expect(evaluateSlaCompliance(60_000, 120_000)).toBe("MET");
  });

  it("breaches the SLA when actual exceeds the target", () => {
    expect(evaluateSlaCompliance(150_000, 120_000)).toBe("BREACHED");
  });

  it("computes the aggregate compliance rate, null-guarded on empty input", () => {
    expect(computeSlaComplianceRate(["MET", "MET", "BREACHED", "MET"])).toBe(75);
    expect(computeSlaComplianceRate([])).toBeNull();
  });
});
