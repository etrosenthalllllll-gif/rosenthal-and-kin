import { describe, it, expect } from "vitest";
import {
  formatCaseNumber,
  normalizeName,
  isSameProbateCase,
  isNameAndJurisdictionMatch,
  findDuplicateEstates,
  type EstateDuplicateCandidate,
} from "./caseNumber";

describe("formatCaseNumber", () => {
  it("formats a positive integer sequence as RK-<n>", () => {
    expect(formatCaseNumber(1842)).toBe("RK-1842");
    expect(formatCaseNumber(1)).toBe("RK-1");
  });

  it("rejects zero, negative, and non-integer sequences", () => {
    expect(() => formatCaseNumber(0)).toThrow();
    expect(() => formatCaseNumber(-5)).toThrow();
    expect(() => formatCaseNumber(1.5)).toThrow();
  });
});

describe("normalizeName", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeName("  John   Smith  ")).toBe("john smith");
  });

  it("strips accents so José and Jose compare equal", () => {
    expect(normalizeName("José García")).toBe(normalizeName("Jose Garcia"));
  });

  it("strips punctuation", () => {
    expect(normalizeName("O'Brien, Jr.")).toBe("obrien jr");
  });
});

const estate = (
  overrides: Partial<EstateDuplicateCandidate>
): EstateDuplicateCandidate => ({
  id: "id",
  decedentName: "John Smith",
  jurisdiction: "CA",
  probateCaseNumber: null,
  ...overrides,
});

describe("isSameProbateCase", () => {
  it("matches identical probate case numbers case-insensitively", () => {
    const a = estate({ probateCaseNumber: "PROB-2024-001" });
    const b = estate({ probateCaseNumber: "prob-2024-001" });
    expect(isSameProbateCase(a, b)).toBe(true);
  });

  it("does not match when either side lacks a probate case number", () => {
    const a = estate({ probateCaseNumber: "PROB-2024-001" });
    const b = estate({ probateCaseNumber: null });
    expect(isSameProbateCase(a, b)).toBe(false);
  });
});

describe("isNameAndJurisdictionMatch", () => {
  it("matches same decedent name (normalized) and jurisdiction", () => {
    const a = estate({ decedentName: "John A. Smith", jurisdiction: "CA" });
    const b = estate({ decedentName: "john a smith", jurisdiction: "ca" });
    expect(isNameAndJurisdictionMatch(a, b)).toBe(true);
  });

  it("does not match across different jurisdictions", () => {
    const a = estate({ decedentName: "John Smith", jurisdiction: "CA" });
    const b = estate({ decedentName: "John Smith", jurisdiction: "NY" });
    expect(isNameAndJurisdictionMatch(a, b)).toBe(false);
  });

  it("does not match different names", () => {
    const a = estate({ decedentName: "John Smith" });
    const b = estate({ decedentName: "Jane Smith" });
    expect(isNameAndJurisdictionMatch(a, b)).toBe(false);
  });
});

describe("findDuplicateEstates", () => {
  it("flags a name+jurisdiction match", () => {
    const existing = [estate({ id: "e1", decedentName: "John Smith", jurisdiction: "CA" })];
    const candidate = estate({ id: "e2", decedentName: "John Smith", jurisdiction: "CA" });
    expect(findDuplicateEstates(existing, candidate)).toHaveLength(1);
  });

  it("flags a probate-case-number match even with a different-looking name", () => {
    const existing = [
      estate({
        id: "e1",
        decedentName: "Jon Smyth", // typo'd name
        jurisdiction: "CA",
        probateCaseNumber: "PROB-1",
      }),
    ];
    const candidate = estate({
      id: "e2",
      decedentName: "John Smith",
      jurisdiction: "CA",
      probateCaseNumber: "PROB-1",
    });
    expect(findDuplicateEstates(existing, candidate)).toHaveLength(1);
  });

  it("never flags an estate against itself", () => {
    const existing = [estate({ id: "same-id", decedentName: "John Smith" })];
    const candidate = estate({ id: "same-id", decedentName: "John Smith" });
    expect(findDuplicateEstates(existing, candidate)).toHaveLength(0);
  });

  it("returns nothing when there is no plausible match", () => {
    const existing = [estate({ id: "e1", decedentName: "Alice Jones", jurisdiction: "NY" })];
    const candidate = estate({ id: "e2", decedentName: "Bob Brown", jurisdiction: "CA" });
    expect(findDuplicateEstates(existing, candidate)).toHaveLength(0);
  });
});
