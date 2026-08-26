import { describe, it, expect } from "vitest";
import { getCurrentEstimate, createNextEstimateVersion, type RecoveryEstimateVersionRecord } from "./recoveryEstimate";

const V1: RecoveryEstimateVersionRecord = {
  version: 1,
  amountCents: 20_000_00,
  operatorOrSystem: "system",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("current estimate lookup", () => {
  it("returns null when there are no versions yet", () => {
    expect(getCurrentEstimate([])).toBeNull();
  });

  it("returns the highest-versioned estimate, not the most recently created one", () => {
    const v2: RecoveryEstimateVersionRecord = { ...V1, version: 2, amountCents: 25_000_00 };
    expect(getCurrentEstimate([v2, V1])?.version).toBe(2);
  });
});

describe("next estimate version creation", () => {
  it("starts at version 1 with no prior estimates", () => {
    const result = createNextEstimateVersion([], {
      amountCents: 20_000_00,
      operatorOrSystem: "system",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    expect(result.version).toBe(1);
  });

  it("never overwrites the prior estimate -- always a new version one past the current highest", () => {
    const result = createNextEstimateVersion([V1], {
      amountCents: 25_000_00,
      reasonForChange: "Authority updated distribution.",
      operatorOrSystem: "operator-1",
      createdAt: "2026-08-01T00:00:00.000Z",
    });
    expect(result.version).toBe(2);
    expect(result.amountCents).toBe(25_000_00);
    // The prior version object itself is untouched.
    expect(V1.amountCents).toBe(20_000_00);
  });
});
