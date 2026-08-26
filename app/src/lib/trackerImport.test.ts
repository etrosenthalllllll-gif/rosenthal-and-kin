import { describe, it, expect } from "vitest";
import {
  parseMoneyToCents,
  parseFirstHeirName,
  planImportForRow,
  type TrackerRow,
} from "./trackerImport";

describe("parseMoneyToCents", () => {
  it("parses a plain decimal string", () => {
    expect(parseMoneyToCents("389256.69")).toBe(38925669);
  });

  it("strips dollar signs and commas", () => {
    expect(parseMoneyToCents("$389,256.69")).toBe(38925669);
  });

  it("returns null for missing input, not 0", () => {
    expect(parseMoneyToCents(undefined)).toBeNull();
    expect(parseMoneyToCents(null)).toBeNull();
    expect(parseMoneyToCents("")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(parseMoneyToCents("unknown")).toBeNull();
  });
});

describe("parseFirstHeirName", () => {
  it("parses the first heir from a real multi-heir tracker cell", () => {
    expect(
      parseFirstHeirName(
        'Tamar "Tammy" Simon Hoffs (wife); Susanna Hoffs (daughter); John Hoffs, Jesse Hoffs (sons)'
      )
    ).toEqual({ firstName: 'Tamar "Tammy" Simon', lastName: "Hoffs" });
  });

  it("parses a single-heir cell with no relationship suffix", () => {
    expect(parseFirstHeirName("Audrey Terras")).toEqual({ firstName: "Audrey", lastName: "Terras" });
  });

  it("returns null for a single-word name (can't split first/last)", () => {
    expect(parseFirstHeirName("Unknown")).toBeNull();
  });

  it("returns null for a placeholder sentence, not a fake claimant (found via a real production import)", () => {
    expect(
      parseFirstHeirName("none found yet - survivors not accessible via web search")
    ).toBeNull();
  });

  it("returns null for missing input", () => {
    expect(parseFirstHeirName(undefined)).toBeNull();
    expect(parseFirstHeirName("")).toBeNull();
  });
});

describe("planImportForRow", () => {
  const baseRow: TrackerRow = {
    lead_id: "HOFFS-JOSHUA",
    decedent_name: "Joshua A. Hoffs, M.D.",
    county: "Los Angeles County",
    reported_amount: "389257",
    score: "95",
    score_band: "Drop everything",
    candidate_heir_name: "Tamar Simon Hoffs (wife)",
    status: "researching",
  };

  it("creates an import plan for a clean, new, non-duplicate row", () => {
    const result = planImportForRow(baseRow, [], new Set(), 42);
    expect(result.kind).toBe("CREATE");
    if (result.kind !== "CREATE") throw new Error("expected CREATE");
    expect(result.estate.caseNumber).toBe("RK-42");
    expect(result.estate.decedentName).toBe("Joshua A. Hoffs, M.D.");
    expect(result.estate.sourceTrackerRowId).toBe("HOFFS-JOSHUA");
    expect(result.estate.estimatedValueCents).toBe(38925700);
    expect(result.person).toEqual({ firstName: "Tamar Simon", lastName: "Hoffs" });
    expect(result.claimant).toEqual({ status: "LEAD", priorityScore: 80 });
  });

  it("skips a row missing lead_id", () => {
    const result = planImportForRow({ ...baseRow, lead_id: "" }, [], new Set(), 1);
    expect(result).toMatchObject({ kind: "SKIPPED", reason: "missing lead_id" });
  });

  it("skips a row already imported (idempotency)", () => {
    const result = planImportForRow(baseRow, [], new Set(["HOFFS-JOSHUA"]), 1);
    expect(result).toMatchObject({ kind: "SKIPPED", reason: "already imported" });
  });

  it("skips a row with no decedent name", () => {
    const result = planImportForRow({ ...baseRow, decedent_name: "" }, [], new Set(), 1);
    expect(result).toMatchObject({ kind: "SKIPPED", reason: "missing decedent_name" });
  });

  it("skips a row with no parseable heir", () => {
    const result = planImportForRow({ ...baseRow, candidate_heir_name: "Unknown" }, [], new Set(), 1);
    expect(result).toMatchObject({ kind: "SKIPPED", reason: "no parseable candidate heir name" });
  });

  it("flags a duplicate against an existing estate with the same name+jurisdiction", () => {
    const result = planImportForRow(
      baseRow,
      [{ id: "estate-1", decedentName: "Joshua A. Hoffs, M.D.", jurisdiction: "CA" }],
      new Set(),
      1
    );
    expect(result).toMatchObject({ kind: "DUPLICATE", matchesEstateIds: ["estate-1"] });
  });

  it("does not flag a duplicate for a genuinely different decedent", () => {
    const result = planImportForRow(
      baseRow,
      [{ id: "estate-1", decedentName: "Riho Terras", jurisdiction: "CA" }],
      new Set(),
      1
    );
    expect(result.kind).toBe("CREATE");
  });
});
