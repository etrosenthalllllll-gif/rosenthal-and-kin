import { describe, it, expect } from "vitest";
import {
  generateNextInvoiceNumber,
  evaluateInvoiceGenerationReadiness,
  isInvoiceConfirmedDelivered,
  type InvoiceGenerationReadinessInput,
} from "./invoiceGeneration";

describe("invoice numbering", () => {
  it("generates a sequential, zero-padded invoice number", () => {
    expect(generateNextInvoiceNumber({ prefix: "INV", lastIssuedSequence: 3 })).toBe("INV-0004");
  });

  it("continues from a large sequence without truncating", () => {
    expect(generateNextInvoiceNumber({ prefix: "INV", lastIssuedSequence: 9999 })).toBe("INV-10000");
  });
});

function input(overrides: Partial<InvoiceGenerationReadinessInput> = {}): InvoiceGenerationReadinessInput {
  return {
    recoveryVerified: true,
    feeCalculated: true,
    distributionApproved: true,
    ...overrides,
  };
}

describe("invoice generation readiness", () => {
  it("can generate once every upstream condition is satisfied", () => {
    const result = evaluateInvoiceGenerationReadiness(input());
    expect(result.canGenerate).toBe(true);
  });

  it("cannot generate before the recovery is verified", () => {
    const result = evaluateInvoiceGenerationReadiness(input({ recoveryVerified: false }));
    expect(result.canGenerate).toBe(false);
    expect(result.unmetChecks.length).toBeGreaterThan(0);
  });

  it("cannot generate before the distribution is approved", () => {
    const result = evaluateInvoiceGenerationReadiness(input({ distributionApproved: false }));
    expect(result.canGenerate).toBe(false);
  });
});

describe("invoice delivery confirmation", () => {
  it("is not confirmed delivered when only SENT", () => {
    expect(isInvoiceConfirmedDelivered("SENT")).toBe(false);
  });

  it("is confirmed delivered once DELIVERED or OPENED", () => {
    expect(isInvoiceConfirmedDelivered("DELIVERED")).toBe(true);
    expect(isInvoiceConfirmedDelivered("OPENED")).toBe(true);
  });
});
