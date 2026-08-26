import { describe, it, expect } from "vitest";
import { classifyRejectionSeverity, classifyRejection } from "./filingRejection";

describe("rejection severity classification", () => {
  it("matches the doc's own worked examples", () => {
    expect(classifyRejectionSeverity("TECHNICAL_FAILURE")).toBe("LOW");
    expect(classifyRejectionSeverity("CLAIMANT_INFORMATION_ERROR")).toBe("MEDIUM");
    expect(classifyRejectionSeverity("MISSING_DOCUMENT")).toBe("HIGH");
    expect(classifyRejectionSeverity("JURISDICTION_PROBLEM")).toBe("CRITICAL");
  });

  it("fails closed to CRITICAL for OTHER (unconfigured)", () => {
    expect(classifyRejectionSeverity("OTHER")).toBe("CRITICAL");
  });
});

describe("classifyRejection", () => {
  it("requires human review for HIGH and CRITICAL severities", () => {
    expect(classifyRejection("MISSING_DOCUMENT", "raw").requiresHumanReview).toBe(true);
    expect(classifyRejection("JURISDICTION_PROBLEM", "raw").requiresHumanReview).toBe(true);
  });

  it("does not require human review for LOW/MEDIUM severities", () => {
    expect(classifyRejection("TECHNICAL_FAILURE", "raw").requiresHumanReview).toBe(false);
    expect(classifyRejection("INVALID_FORM", "raw").requiresHumanReview).toBe(false);
  });

  it("preserves the raw provider message and affected component", () => {
    const record = classifyRejection("MISSING_DOCUMENT", "Missing relationship document", "Exhibit B");
    expect(record.rawProviderMessage).toBe("Missing relationship document");
    expect(record.affectedComponent).toBe("Exhibit B");
  });
});
