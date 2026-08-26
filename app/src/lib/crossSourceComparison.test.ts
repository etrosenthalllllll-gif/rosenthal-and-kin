import { describe, it, expect } from "vitest";
import {
  compareAcrossSources,
  countIndependentSources,
  type SourceRecord,
} from "./crossSourceComparison";

describe("countIndependentSources", () => {
  it("counts each source as independent when none are derived from another", () => {
    const records: SourceRecord[] = [
      { sourceId: "birth-cert", value: "1981-01-02" },
      { sourceId: "passport", value: "1981-01-02" },
      { sourceId: "marriage-record", value: "1981-01-02" },
    ];
    expect(countIndependentSources(records)).toBe(3);
  });

  it("counts three republications of one obituary as ONE independent source (doc 06 sec 13)", () => {
    const records: SourceRecord[] = [
      { sourceId: "obituary-original", value: "Jane Smith" },
      { sourceId: "site-a", value: "Jane Smith", derivedFromSourceId: "obituary-original" },
      { sourceId: "site-b", value: "Jane Smith", derivedFromSourceId: "obituary-original" },
    ];
    expect(countIndependentSources(records)).toBe(1);
  });

  it("resolves a multi-hop derivation chain to its ultimate origin", () => {
    const records: SourceRecord[] = [
      { sourceId: "origin", value: "x" },
      { sourceId: "copy1", value: "x", derivedFromSourceId: "origin" },
      { sourceId: "copy2", value: "x", derivedFromSourceId: "copy1" },
    ];
    expect(countIndependentSources(records)).toBe(1);
  });

  it("does not infinite-loop on a cyclic derivation chain", () => {
    const records: SourceRecord[] = [
      { sourceId: "a", value: "x", derivedFromSourceId: "b" },
      { sourceId: "b", value: "x", derivedFromSourceId: "a" },
    ];
    expect(() => countIndependentSources(records)).not.toThrow();
  });
});

describe("compareAcrossSources", () => {
  it("returns CONSISTENT when every source reports the same value (doc 06 sec 11's example)", () => {
    const result = compareAcrossSources([
      { sourceId: "birth-cert", value: "01/02/1981" },
      { sourceId: "passport", value: "01/02/1981" },
      { sourceId: "marriage-record", value: "01/02/1981" },
    ]);
    expect(result.status).toBe("CONSISTENT");
    expect(result.independentSourceCount).toBe(3);
  });

  it("returns CONFLICT and preserves every distinct value with its sources", () => {
    const result = compareAcrossSources([
      { sourceId: "birth-cert", value: "01/02/1981" },
      { sourceId: "passport", value: "01/02/1982" },
    ]);
    expect(result.status).toBe("CONFLICT");
    expect(result.distinctValues.sort((a, b) => a.value.localeCompare(b.value))).toEqual([
      { value: "01/02/1981", sourceIds: ["birth-cert"] },
      { value: "01/02/1982", sourceIds: ["passport"] },
    ]);
  });

  it("reports a low independent-source count even when several sources agree, if they share an origin", () => {
    const result = compareAcrossSources([
      { sourceId: "obituary-original", value: "Jane Smith" },
      { sourceId: "site-a", value: "Jane Smith", derivedFromSourceId: "obituary-original" },
      { sourceId: "site-b", value: "Jane Smith", derivedFromSourceId: "obituary-original" },
    ]);
    expect(result.status).toBe("CONSISTENT");
    expect(result.independentSourceCount).toBe(1);
  });

  it("ignores empty values rather than treating them as a conflicting third value", () => {
    const result = compareAcrossSources([
      { sourceId: "a", value: "1981-01-02" },
      { sourceId: "b", value: "" },
    ]);
    expect(result.status).toBe("CONSISTENT");
  });
});
