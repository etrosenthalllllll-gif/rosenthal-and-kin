import { describe, it, expect } from "vitest";
import { generateCaseSummary, type CaseSummaryInput } from "./caseSummary";

const baseInput: CaseSummaryInput = {
  decedentName: "John Smith",
  claimantName: "Jane Smith",
  claimantStatus: "DOCUMENTS_REQUESTED",
  estimatedValueCents: 4_200_000, // $42,000
  documentsReceived: 2,
  documentsRequired: 3,
  missingDocumentTypes: ["proof of relationship"],
  competingHeirCount: 0,
  aiRecommendation: null,
  aiConfidence: null,
  aiReason: null,
};

describe("generateCaseSummary", () => {
  it("names the decedent and claimant", () => {
    const summary = generateCaseSummary(baseInput);
    expect(summary).toContain("Jane Smith");
    expect(summary).toContain("John Smith");
  });

  it("reports document progress", () => {
    const summary = generateCaseSummary(baseInput);
    expect(summary).toContain("2 of 3 required documents");
  });

  it("names the missing document", () => {
    const summary = generateCaseSummary(baseInput);
    expect(summary).toContain("proof of relationship");
  });

  it("states plainly when no competing heirs exist", () => {
    const summary = generateCaseSummary(baseInput);
    expect(summary).toContain("No competing heirs have currently been identified.");
  });

  it("reports competing heirs when present, singular phrasing", () => {
    const summary = generateCaseSummary({ ...baseInput, competingHeirCount: 1 });
    expect(summary).toContain("1 other potential heir has been identified");
  });

  it("reports competing heirs when present, plural phrasing", () => {
    const summary = generateCaseSummary({ ...baseInput, competingHeirCount: 3 });
    expect(summary).toContain("3 other potential heirs have been identified");
  });

  it("formats the estimated recovery as currency", () => {
    const summary = generateCaseSummary(baseInput);
    expect(summary).toContain("$42,000");
  });

  it("omits the recovery sentence when no estimate exists", () => {
    const summary = generateCaseSummary({ ...baseInput, estimatedValueCents: null });
    expect(summary).not.toContain("Estimated potential recovery");
  });

  it("includes the AI recommendation and confidence when present", () => {
    const summary = generateCaseSummary({
      ...baseInput,
      aiRecommendation: "CONTINUE",
      aiConfidence: 0.94,
      aiReason: "Research and claimant-provided information are consistent.",
    });
    expect(summary).toContain("AI recommendation: CONTINUE (94% confidence).");
    expect(summary).toContain("Research and claimant-provided information are consistent.");
  });

  it("omits the AI section entirely when there is no recommendation", () => {
    const summary = generateCaseSummary(baseInput);
    expect(summary).not.toContain("AI recommendation");
  });

  it("never returns an empty string for a minimal valid input", () => {
    const summary = generateCaseSummary({
      decedentName: "Jane Doe",
      claimantName: "John Doe",
      claimantStatus: "LEAD",
      estimatedValueCents: null,
      documentsReceived: 0,
      documentsRequired: 0,
      missingDocumentTypes: [],
      competingHeirCount: 0,
    });
    expect(summary.length).toBeGreaterThan(0);
  });
});
