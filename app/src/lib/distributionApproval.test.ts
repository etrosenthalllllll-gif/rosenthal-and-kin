import { describe, it, expect } from "vitest";
import { planDistributionApprovalDecision, buildDistributionStatement } from "./distributionApproval";

describe("distribution approval routing", () => {
  it("always requires an APPROVE_DISTRIBUTION decision -- never auto-approves", () => {
    const result = planDistributionApprovalDecision("dist-1", "recovery-1");
    expect(result.decisionTypeKey).toBe("APPROVE_DISTRIBUTION");
    expect(result.evidenceRefs).toEqual(["dist-1", "recovery-1"]);
  });
});

describe("distribution statement", () => {
  it("names the exact recovery and distribution versions it was generated from", () => {
    const statement = buildDistributionStatement({
      recoveryId: "recovery-1",
      recoveryVersion: 2,
      distributionVersion: 1,
      grossRecoveryCents: 25_000_00,
      deductionsCents: 1_000_00,
      feesCents: 5_000_00,
      expensesCents: 0,
      netDistributableCents: 19_000_00,
      beneficiaries: [{ claimantId: "claimant-1", percent: 100, distributionAmountCents: 19_000_00 }],
    });
    expect(statement).toContain("recovery-1 v2");
    expect(statement).toContain("distribution v1");
    expect(statement).toContain("$19,000.00");
    expect(statement).toContain("claimant-1: 100% = $19,000.00");
  });
});
