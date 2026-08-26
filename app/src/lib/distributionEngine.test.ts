import { describe, it, expect } from "vitest";
import {
  calculateNetDistributable,
  validateDistributionRule,
  allocateDistribution,
  getCurrentDistributionVersion,
  nextDistributionVersionNumber,
  type DistributionVersionRecord,
} from "./distributionEngine";

describe("net distributable calculation", () => {
  it("subtracts deductions, fees, and expenses from gross recovery", () => {
    const result = calculateNetDistributable({
      grossRecoveryCents: 100_000_00,
      deductionsCents: 1_000_00,
      feesCents: 10_000_00,
      expensesCents: 500_00,
    });
    expect(result).toBe(88_500_00);
  });
});

describe("distribution rule validation", () => {
  it("is valid when shares sum to 100%", () => {
    const result = validateDistributionRule([
      { claimantId: "a", percent: 50 },
      { claimantId: "b", percent: 50 },
    ]);
    expect(result.valid).toBe(true);
  });

  it("is invalid when shares do not sum to 100%", () => {
    const result = validateDistributionRule([
      { claimantId: "a", percent: 50 },
      { claimantId: "b", percent: 40 },
    ]);
    expect(result.valid).toBe(false);
    expect(result.totalPercent).toBe(90);
  });

  it("tolerates small floating-point rounding, e.g. a three-way split", () => {
    const result = validateDistributionRule([
      { claimantId: "a", percent: 33.33 },
      { claimantId: "b", percent: 33.33 },
      { claimantId: "c", percent: 33.34 },
    ]);
    expect(result.valid).toBe(true);
  });
});

describe("distribution allocation", () => {
  it("allocates each beneficiary's independently trackable share", () => {
    const result = allocateDistribution(100_000_00, [
      { claimantId: "a", percent: 50 },
      { claimantId: "b", percent: 25 },
      { claimantId: "c", percent: 25 },
    ]);
    expect(result.find((r) => r.claimantId === "a")?.distributionAmountCents).toBe(50_000_00);
    expect(result.find((r) => r.claimantId === "b")?.distributionAmountCents).toBe(25_000_00);
  });
});

describe("distribution versioning", () => {
  const versions: DistributionVersionRecord[] = [
    { claimantId: "a", version: 1, distributionAmountCents: 10_000_00 },
    { claimantId: "a", version: 2, distributionAmountCents: 12_000_00 },
    { claimantId: "b", version: 1, distributionAmountCents: 5_000_00 },
  ];

  it("returns the highest version scoped to one beneficiary", () => {
    expect(getCurrentDistributionVersion(versions, "a")?.version).toBe(2);
    expect(getCurrentDistributionVersion(versions, "b")?.version).toBe(1);
  });

  it("returns null when the beneficiary has no versions yet", () => {
    expect(getCurrentDistributionVersion(versions, "c")).toBeNull();
  });

  it("never overwrites -- the next version is always one past the current highest", () => {
    expect(nextDistributionVersionNumber(versions, "a")).toBe(3);
    expect(nextDistributionVersionNumber(versions, "c")).toBe(1);
  });
});
