import { describe, it, expect } from "vitest";
import { nameMatchScore, resolveIdentityMatch, type IdentityRecord } from "./identityResolution";

function record(overrides: Partial<IdentityRecord> = {}): IdentityRecord {
  return {
    fullName: "Jane Smith",
    dob: "1981-01-02",
    address: "123 Main St",
    phone: "555-123-4567",
    email: "jane@example.com",
    ...overrides,
  };
}

describe("nameMatchScore", () => {
  it("scores an exact name match as 1", () => {
    expect(nameMatchScore(record({ fullName: "Jane Smith" }), record({ fullName: "Jane Smith" }))).toBe(1);
  });

  it("scores a middle-initial variation highly but not perfectly", () => {
    const score = nameMatchScore(
      record({ fullName: "John Smith" }),
      record({ fullName: "John A Smith" })
    );
    expect(score).toBe(0.8);
  });

  it("treats a first-name initial as a match (J. A. Smith vs John Albert Smith)", () => {
    const score = nameMatchScore(
      record({ fullName: "J. A. Smith" }),
      record({ fullName: "John Albert Smith" })
    );
    expect(score).toBeGreaterThan(0);
  });

  it("scores zero when surnames don't match at all", () => {
    expect(nameMatchScore(record({ fullName: "Jane Smith" }), record({ fullName: "Jane Johnson" }))).toBe(0);
  });

  it("matches via an alternate/maiden name", () => {
    const score = nameMatchScore(
      record({ fullName: "Jane Smith", alternateNames: ["Jane Johnson"] }),
      record({ fullName: "Jane Johnson" })
    );
    expect(score).toBeGreaterThan(0);
  });

  it("scores a shared surname with a different first name as weak", () => {
    const score = nameMatchScore(record({ fullName: "Jane Smith" }), record({ fullName: "Mary Smith" }));
    expect(score).toBe(0.3);
  });
});

describe("resolveIdentityMatch", () => {
  it("classifies a strong multi-signal match as LIKELY_SAME_PERSON", () => {
    const result = resolveIdentityMatch(record(), record());
    expect(result.outcome).toBe("LIKELY_SAME_PERSON");
    expect(result.matchScore).toBeGreaterThanOrEqual(0.85);
  });

  it("never decides from name similarity alone -- name-only match is not LIKELY_SAME_PERSON", () => {
    const result = resolveIdentityMatch(
      { fullName: "Jane Smith" },
      { fullName: "Jane Smith" }
    );
    expect(result.outcome).not.toBe("LIKELY_SAME_PERSON");
  });

  it("classifies a documented link (marriage record + DOB match) as LIKELY_SAME_PERSON per doc 06's own example", () => {
    const result = resolveIdentityMatch(
      { fullName: "Jane Marie Smith", dob: "1981-01-02" },
      { fullName: "Jane M. Johnson", dob: "1981-01-02" },
      { documentedLinks: ["Marriage record links surname change"] }
    );
    expect(result.outcome).toBe("LIKELY_SAME_PERSON");
    expect(result.matchingEvidence).toContain("Marriage record links surname change");
  });

  it("classifies a moderate signal overlap as POSSIBLE_MATCH, never auto-merging", () => {
    const result = resolveIdentityMatch(
      record({ address: "999 Other St", phone: null, email: null }),
      record({ address: "999 Other St", phone: null, email: null })
    );
    expect(result.outcome).toBe("POSSIBLE_MATCH");
  });

  it("classifies no meaningful overlap as INSUFFICIENT_EVIDENCE", () => {
    const result = resolveIdentityMatch(
      { fullName: "Jane Smith" },
      { fullName: "Mary Smith" }
    );
    expect(result.outcome).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("classifies a confirmed DOB conflict with a weak name-only signal as LIKELY_DIFFERENT_PERSON", () => {
    const result = resolveIdentityMatch(
      { fullName: "Jane Smith", dob: "1981-01-02" },
      { fullName: "Jane Smith", dob: "1982-06-15" }
    );
    expect(result.outcome).toBe("LIKELY_DIFFERENT_PERSON");
  });

  it("always includes the matching evidence list for a positive score", () => {
    const result = resolveIdentityMatch(record(), record());
    expect(result.matchingEvidence.length).toBeGreaterThan(0);
  });
});
