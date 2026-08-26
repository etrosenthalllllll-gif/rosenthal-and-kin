import { describe, it, expect } from "vitest";
import { convertCurrency, applyRounding, createAdjustment, type RoundingRule } from "./financialAdjustments";

describe("currency conversion", () => {
  it("preserves the original amount and currency on the result, never overwriting them", () => {
    const conversion = convertCurrency({ amountCents: 10_000_00, currency: "EUR" }, "USD", 1.08, "2026-08-26T00:00:00.000Z", "ECB reference rate");
    expect(conversion.originalAmountCents).toBe(10_000_00);
    expect(conversion.originalCurrency).toBe("EUR");
    expect(conversion.convertedAmountCents).toBe(10_800_00);
    expect(conversion.convertedCurrency).toBe("USD");
  });
});

describe("deterministic rounding", () => {
  const version = "v1";

  it("rounds UP to the next whole cent", () => {
    expect(applyRounding(100.1, { version, method: "UP" })).toBe(101);
  });

  it("rounds DOWN, truncating any fraction", () => {
    expect(applyRounding(100.9, { version, method: "DOWN" })).toBe(100);
  });

  it("rounds HALF_UP at exactly .5", () => {
    expect(applyRounding(100.5, { version, method: "HALF_UP" })).toBe(101);
  });

  it("rounds HALF_EVEN to the nearest even cent at exactly .5", () => {
    expect(applyRounding(100.5, { version, method: "HALF_EVEN" })).toBe(100);
    expect(applyRounding(101.5, { version, method: "HALF_EVEN" })).toBe(102);
  });

  it("produces the identical result for the identical input every time", () => {
    const rule: RoundingRule = { version, method: "HALF_UP" };
    expect(applyRounding(33.335, rule)).toBe(applyRounding(33.335, rule));
  });
});

describe("adjustment creation", () => {
  it("rejects an adjustment with no reason", () => {
    const result = createAdjustment("CREDIT", 100_00, "", "operator-1", "2026-08-26T00:00:00.000Z");
    expect(result.status).toBe("REJECTED_MISSING_AUTHORIZATION");
  });

  it("rejects an adjustment with no approver, even for OTHER", () => {
    const result = createAdjustment("OTHER", 100_00, "Some reason", "", "2026-08-26T00:00:00.000Z");
    expect(result.status).toBe("REJECTED_MISSING_AUTHORIZATION");
  });

  it("creates the adjustment once both reason and approver are present", () => {
    const result = createAdjustment("CORRECTION", -50_00, "Duplicate fee corrected", "operator-1", "2026-08-26T00:00:00.000Z");
    expect(result.status).toBe("CREATED");
    expect(result.adjustment?.amountCents).toBe(-50_00);
  });
});
