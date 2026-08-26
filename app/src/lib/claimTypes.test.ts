import { describe, it, expect } from "vitest";
import { CLAIM_TYPES, getClaimTypeConfig } from "./claimTypes";

describe("claim type config", () => {
  it("returns config for a known claim type", () => {
    const config = getClaimTypeConfig("UNCLAIMED_PROPERTY");
    expect(config?.displayName).toBe("Unclaimed Property Claim");
  });

  it("returns null for an unrecognized claim type", () => {
    expect(getClaimTypeConfig("NOT_A_REAL_TYPE")).toBeNull();
  });

  it("includes an OTHER fallback that always requires review rather than guessing requirements", () => {
    expect(CLAIM_TYPES.OTHER.alwaysRequiresReview).toBe(true);
    expect(CLAIM_TYPES.OTHER.requiredDocumentTypes).toEqual([]);
  });

  it("every claim type specifies the full shape doc 07 sec 2 requires", () => {
    for (const config of Object.values(CLAIM_TYPES)) {
      expect(Array.isArray(config.requiredInformation)).toBe(true);
      expect(Array.isArray(config.requiredDocumentTypes)).toBe(true);
      expect(Array.isArray(config.potentialFormIds)).toBe(true);
      expect(Array.isArray(config.requiredSignatures)).toBe(true);
      expect(Array.isArray(config.requiredDeclarations)).toBe(true);
      expect(Array.isArray(config.requiredExhibits)).toBe(true);
      expect(typeof config.filingMethod).toBe("string");
      expect(typeof config.alwaysRequiresReview).toBe("boolean");
    }
  });

  it("marks estate and probate-related claims as always requiring review (court/probate involvement)", () => {
    expect(CLAIM_TYPES.ESTATE_CLAIM.alwaysRequiresReview).toBe(true);
    expect(CLAIM_TYPES.PROBATE_RELATED.alwaysRequiresReview).toBe(true);
  });
});
