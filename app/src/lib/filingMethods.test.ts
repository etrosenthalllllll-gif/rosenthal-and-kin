import { describe, it, expect } from "vitest";
import { FILING_METHODS, getFilingMethodConfig, methodSupportsOperation } from "./filingMethods";

describe("filing method config", () => {
  it("returns config for a known filing method", () => {
    const config = getFilingMethodConfig("ONLINE_PORTAL");
    expect(config?.displayName).toBe("Online Portal");
  });

  it("returns null for an unrecognized filing method", () => {
    expect(getFilingMethodConfig("NOT_A_REAL_METHOD")).toBeNull();
  });

  it("includes an OTHER fallback that always requires manual steps", () => {
    expect(FILING_METHODS.OTHER.requiresManualSteps).toBe(true);
    expect(FILING_METHODS.OTHER.supportedOperations).toEqual([]);
  });

  it("every method specifies the full shape doc 08 sec 7 requires", () => {
    for (const config of Object.values(FILING_METHODS)) {
      expect(typeof config.submissionMechanism).toBe("string");
      expect(Array.isArray(config.requiredMetadata)).toBe(true);
      expect(Array.isArray(config.requiredDocumentFormats)).toBe(true);
      expect(typeof config.authenticationRequired).toBe("boolean");
      expect(typeof config.feeProcess).toBe("string");
      expect(typeof config.confirmationMechanism).toBe("string");
      expect(typeof config.hasStatusMechanism).toBe("boolean");
      expect(typeof config.supportsRetry).toBe("boolean");
      expect(typeof config.requiresManualSteps).toBe("boolean");
      expect(Array.isArray(config.supportedOperations)).toBe(true);
    }
  });

  it("methodSupportsOperation reports true only for a listed operation", () => {
    expect(methodSupportsOperation("ONLINE_PORTAL", "submit")).toBe(true);
    expect(methodSupportsOperation("EMAIL_SUBMISSION", "get_status")).toBe(false);
  });

  it("methodSupportsOperation returns false for an unrecognized method rather than throwing", () => {
    expect(methodSupportsOperation("NOT_A_REAL_METHOD", "submit")).toBe(false);
  });
});
