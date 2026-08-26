import { describe, it, expect } from "vitest";
import {
  normalizeProviderStatus,
  verifyFilingConfirmation,
  type ProviderStatusMapping,
  type ConfirmationVerificationInput,
} from "./filingProviderNormalization";

const MAPPINGS: ProviderStatusMapping[] = [
  { connectorId: "provider-a", rawStatus: "in_review", normalizedStatus: "PROCESSING" },
  { connectorId: "provider-a", rawStatus: "denied", normalizedStatus: "REJECTED" },
];

describe("provider response normalization", () => {
  it("maps a configured raw status to its normalized status", () => {
    const result = normalizeProviderStatus("provider-a", "in_review", { raw: true }, MAPPINGS);
    expect(result.normalizedStatus).toBe("PROCESSING");
  });

  it("preserves the raw response and raw status regardless of recognition", () => {
    const result = normalizeProviderStatus("provider-a", "in_review", { raw: true, detail: "x" }, MAPPINGS);
    expect(result.rawStatus).toBe("in_review");
    expect(result.rawResponse).toEqual({ raw: true, detail: "x" });
  });

  it("fails closed to UNKNOWN for an unrecognized raw status, never guessing", () => {
    const result = normalizeProviderStatus("provider-a", "some_new_status_never_seen", { raw: 1 }, MAPPINGS);
    expect(result.normalizedStatus).toBe("UNKNOWN");
    expect(result.rawResponse).toEqual({ raw: 1 });
  });

  it("fails closed to UNKNOWN for an unrecognized connector too", () => {
    const result = normalizeProviderStatus("provider-z", "in_review", {}, MAPPINGS);
    expect(result.normalizedStatus).toBe("UNKNOWN");
  });
});

describe("confirmation verification", () => {
  function input(overrides: Partial<ConfirmationVerificationInput> = {}): ConfirmationVerificationInput {
    return {
      networkResponseReceived: true,
      externalFilingIdPresent: false,
      confirmationNumberPresent: false,
      receiptAvailable: false,
      providerStatusConfirmedIndependently: false,
      ...overrides,
    };
  }

  it("a bare network response alone is never sufficient proof", () => {
    expect(verifyFilingConfirmation(input())).toBe("UNCERTAIN_REQUIRES_REVIEW");
  });

  it("an external filing ID alone, with no corroborating signal, is still uncertain", () => {
    expect(verifyFilingConfirmation(input({ externalFilingIdPresent: true }))).toBe("UNCERTAIN_REQUIRES_REVIEW");
  });

  it("is VERIFIED with an external filing ID plus a confirmation number", () => {
    expect(
      verifyFilingConfirmation(input({ externalFilingIdPresent: true, confirmationNumberPresent: true }))
    ).toBe("VERIFIED");
  });

  it("is VERIFIED with an external filing ID plus a receipt", () => {
    expect(verifyFilingConfirmation(input({ externalFilingIdPresent: true, receiptAvailable: true }))).toBe(
      "VERIFIED"
    );
  });

  it("is VERIFIED with an external filing ID plus independent provider confirmation", () => {
    expect(
      verifyFilingConfirmation(
        input({ externalFilingIdPresent: true, providerStatusConfirmedIndependently: true })
      )
    ).toBe("VERIFIED");
  });
});
