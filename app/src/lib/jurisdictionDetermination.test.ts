import { describe, it, expect } from "vitest";
import { determineJurisdiction } from "./jurisdictionDetermination";

describe("determineJurisdiction", () => {
  it("returns null jurisdiction and requires review when there are no signals at all", () => {
    const result = determineJurisdiction([]);
    expect(result.jurisdiction).toBeNull();
    expect(result.requiresHumanReview).toBe(true);
  });

  it("determines a clear jurisdiction when strong signals agree", () => {
    const result = determineJurisdiction([
      { type: "ASSET_LOCATION", jurisdiction: "CA" },
      { type: "HOLDER_JURISDICTION", jurisdiction: "CA" },
    ]);
    expect(result.jurisdiction).toBe("CA");
    expect(result.requiresHumanReview).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("never determines jurisdiction from claimant location alone (doc 07's own warning)", () => {
    const result = determineJurisdiction([{ type: "CLAIMANT_LOCATION", jurisdiction: "NY" }]);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("requires human review when two jurisdictions are both plausible", () => {
    const result = determineJurisdiction([
      { type: "ASSET_LOCATION", jurisdiction: "CA" },
      { type: "DECEDENT_DOMICILE", jurisdiction: "NV" },
    ]);
    expect(result.requiresHumanReview).toBe(true);
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves reasons for the winning candidate", () => {
    const result = determineJurisdiction([
      { type: "ASSET_LOCATION", jurisdiction: "CA" },
      { type: "HOLDER_JURISDICTION", jurisdiction: "CA" },
    ]);
    expect(result.reasons.length).toBe(2);
  });

  it("accumulates multiple signals for the same jurisdiction rather than only counting one", () => {
    const single = determineJurisdiction([{ type: "ASSET_LOCATION", jurisdiction: "CA" }]);
    const combined = determineJurisdiction([
      { type: "ASSET_LOCATION", jurisdiction: "CA" },
      { type: "COURT_JURISDICTION", jurisdiction: "CA" },
    ]);
    expect(combined.confidence).toBeGreaterThan(single.confidence);
  });
});
