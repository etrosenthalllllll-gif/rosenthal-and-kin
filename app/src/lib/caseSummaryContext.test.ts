import { describe, it, expect } from "vitest";
import { buildCaseSummaryInput } from "./caseSummaryContext";

describe("buildCaseSummaryInput", () => {
  it("builds a complete CaseSummaryInput from raw case facts, with no documents on file", () => {
    const input = buildCaseSummaryInput({
      decedentName: "John Smith",
      claimantFirstName: "Jane",
      claimantLastName: "Smith",
      claimantStatus: "POTENTIAL_HEIR",
      estimatedValueCents: 8_750_000,
      documents: [],
      competingHeirCount: 0,
    });

    expect(input.claimantName).toBe("Jane Smith");
    expect(input.documentsReceived).toBe(0);
    expect(input.documentsRequired).toBe(2); // CLAIMANT_VERIFICATION: identity + proof of relationship
    expect(input.missingDocumentTypes).toEqual(["Identity", "Proof of Relationship"]);
    expect(input.competingHeirCount).toBe(0);
  });

  it("reflects a validated document as satisfying its requirement, not just 'received'", () => {
    const input = buildCaseSummaryInput({
      decedentName: "John Smith",
      claimantFirstName: "Jane",
      claimantLastName: "Smith",
      claimantStatus: "DOCUMENTS_REQUESTED",
      estimatedValueCents: null,
      documents: [
        { id: "doc-1", documentType: "DRIVER_LICENSE", validationStatus: "VALID", duplicateStatus: "UNIQUE" },
      ],
      competingHeirCount: 2,
    });

    expect(input.documentsReceived).toBe(1);
    expect(input.missingDocumentTypes).toEqual(["Proof of Relationship"]);
    expect(input.competingHeirCount).toBe(2);
  });

  it("does not count a confirmed-duplicate document toward satisfying a requirement", () => {
    const input = buildCaseSummaryInput({
      decedentName: "John Smith",
      claimantFirstName: "Jane",
      claimantLastName: "Smith",
      claimantStatus: "DOCUMENTS_REQUESTED",
      estimatedValueCents: null,
      documents: [
        { id: "doc-1", documentType: "DRIVER_LICENSE", validationStatus: "VALID", duplicateStatus: "CONFIRMED_DUPLICATE" },
      ],
      competingHeirCount: 0,
    });

    expect(input.missingDocumentTypes).toContain("Identity");
  });
});
