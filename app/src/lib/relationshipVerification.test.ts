import { describe, it, expect } from "vitest";
import { verifyRelationshipClaim, type RelationshipEvidenceEntry } from "./relationshipVerification";

function entry(overrides: Partial<RelationshipEvidenceEntry> = {}): RelationshipEvidenceEntry {
  return { sourceId: "s1", supports: true, independent: true, ...overrides };
}

describe("verifyRelationshipClaim", () => {
  it("returns INSUFFICIENT_EVIDENCE when no evidence has been gathered", () => {
    const result = verifyRelationshipClaim([]);
    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.requiresHumanReview).toBe(false);
  });

  it("returns CONFLICTED when both supporting and contradicting evidence exist -- never picks a side", () => {
    const result = verifyRelationshipClaim([
      entry({ sourceId: "a", supports: true }),
      entry({ sourceId: "b", supports: false }),
    ]);
    expect(result.status).toBe("CONFLICTED");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("returns UNSUPPORTED when only contradicting evidence exists", () => {
    const result = verifyRelationshipClaim([entry({ sourceId: "a", supports: false })]);
    expect(result.status).toBe("UNSUPPORTED");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("returns STRONGLY_SUPPORTED with 3+ independent supporting sources", () => {
    const result = verifyRelationshipClaim([
      entry({ sourceId: "a" }),
      entry({ sourceId: "b" }),
      entry({ sourceId: "c" }),
    ]);
    expect(result.status).toBe("STRONGLY_SUPPORTED");
    expect(result.independentSupportingCount).toBe(3);
    expect(result.requiresHumanReview).toBe(false);
  });

  it("returns SUPPORTED with exactly 2 independent supporting sources", () => {
    const result = verifyRelationshipClaim([
      entry({ sourceId: "a" }),
      entry({ sourceId: "b" }),
    ]);
    expect(result.status).toBe("SUPPORTED");
  });

  it("returns PARTIALLY_SUPPORTED with a single independent supporting source", () => {
    const result = verifyRelationshipClaim([entry({ sourceId: "a" })]);
    expect(result.status).toBe("PARTIALLY_SUPPORTED");
  });

  it("does not let non-independent duplicates count as sufficient support (doc 06 sec 13)", () => {
    const result = verifyRelationshipClaim([
      entry({ sourceId: "a", independent: false }),
      entry({ sourceId: "b", independent: false }),
      entry({ sourceId: "c", independent: false }),
    ]);
    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.independentSupportingCount).toBe(0);
  });

  it("mixes independent and non-independent sources correctly", () => {
    const result = verifyRelationshipClaim([
      entry({ sourceId: "a", independent: true }),
      entry({ sourceId: "b", independent: false }),
      entry({ sourceId: "c", independent: true }),
    ]);
    expect(result.status).toBe("SUPPORTED");
    expect(result.independentSupportingCount).toBe(2);
  });
});
