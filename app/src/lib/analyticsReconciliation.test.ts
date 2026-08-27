import { describe, it, expect } from "vitest";
import {
  evaluateAnalyticsReconciliation,
  resolveCanonicalCaseId,
  dedupeByCanonicalId,
  shouldCountAsNewFunnelEntry,
  countsAsSuccessfulFiling,
  shouldCountResubmissionAsNewFiling,
  sumPartialRecoveries,
  computeNetRevenueAfterAdjustments,
  splitSharedCaseAttribution,
  includeInLiveDashboard,
  applyLateArrivingEvent,
} from "./analyticsReconciliation";

describe("analytics reconciliation against the transactional system", () => {
  it("passes when counts match exactly", () => {
    const result = evaluateAnalyticsReconciliation("cases", 1245, 1245);
    expect(result.outcome).toBe("PASS");
    expect(result.delta).toBe(0);
  });

  it("raises ANALYTICS_RECONCILIATION_ERROR on any nonzero delta, matching doc 13's own example", () => {
    const result = evaluateAnalyticsReconciliation("cases", 1245, 1231);
    expect(result.outcome).toBe("ANALYTICS_RECONCILIATION_ERROR");
    expect(result.delta).toBe(-14);
  });

  it("flags analytics overcounting too, not just undercounting", () => {
    const result = evaluateAnalyticsReconciliation("cases", 1000, 1002);
    expect(result.outcome).toBe("ANALYTICS_RECONCILIATION_ERROR");
    expect(result.delta).toBe(2);
  });
});

describe("duplicate leads / merged cases", () => {
  it("resolves a single-hop merge to its canonical id", () => {
    const mergeMap = new Map([["case-a", "case-b"]]);
    expect(resolveCanonicalCaseId("case-a", mergeMap)).toBe("case-b");
  });

  it("follows a multi-hop merge chain to its final canonical id", () => {
    const mergeMap = new Map([
      ["case-a", "case-b"],
      ["case-b", "case-c"],
    ]);
    expect(resolveCanonicalCaseId("case-a", mergeMap)).toBe("case-c");
  });

  it("terminates on a cyclical merge map instead of looping forever", () => {
    const mergeMap = new Map([
      ["case-a", "case-b"],
      ["case-b", "case-a"],
    ]);
    expect(() => resolveCanonicalCaseId("case-a", mergeMap)).not.toThrow();
  });

  it("dedupes duplicate leads that were later merged into one case", () => {
    const mergeMap = new Map([["case-a", "case-b"]]);
    const records = [{ id: "case-a" }, { id: "case-b" }, { id: "case-c" }];
    const deduped = dedupeByCanonicalId(records, mergeMap);
    expect(deduped.map((r) => r.id)).toEqual(["case-a", "case-c"]);
  });
});

describe("reopened cases", () => {
  it("does not count a reopened case as a new funnel entry", () => {
    expect(shouldCountAsNewFunnelEntry({ isReopen: true })).toBe(false);
  });

  it("counts a genuinely new case as a new funnel entry", () => {
    expect(shouldCountAsNewFunnelEntry({ isReopen: false })).toBe(true);
  });
});

describe("cancelled/rejected claims + resubmissions", () => {
  it("counts only FILED_ACTIVE as a successful filing", () => {
    expect(countsAsSuccessfulFiling("FILED_ACTIVE")).toBe(true);
    expect(countsAsSuccessfulFiling("FILED_CANCELLED")).toBe(false);
    expect(countsAsSuccessfulFiling("FILED_REJECTED")).toBe(false);
    expect(countsAsSuccessfulFiling("RESUBMITTED")).toBe(false);
  });

  it("never counts a resubmission as a new filing", () => {
    expect(shouldCountResubmissionAsNewFiling()).toBe(false);
  });
});

describe("partial recoveries / multiple payments", () => {
  it("sums every payment rather than using only the latest", () => {
    expect(sumPartialRecoveries([5000, 3000, 2000])).toBe(10000);
  });

  it("sums to zero for no payments yet", () => {
    expect(sumPartialRecoveries([])).toBe(0);
  });
});

describe("refunds / chargebacks / reversed payments", () => {
  it("nets every adjustment off gross revenue", () => {
    expect(computeNetRevenueAfterAdjustments(10000, 1000, 500, 200)).toBe(8300);
  });

  it("returns gross revenue unchanged with no adjustments", () => {
    expect(computeNetRevenueAfterAdjustments(10000, 0, 0, 0)).toBe(10000);
  });
});

describe("multiple operators / shared cases", () => {
  it("splits attribution proportionally to recorded hours", () => {
    const shares = splitSharedCaseAttribution(
      new Map([
        ["op-1", 6],
        ["op-2", 2],
      ])
    );
    expect(shares).toEqual([
      { operatorId: "op-1", shareFraction: 0.75 },
      { operatorId: "op-2", shareFraction: 0.25 },
    ]);
  });

  it("falls back to an equal split only when no hours were recorded at all", () => {
    const shares = splitSharedCaseAttribution(
      new Map([
        ["op-1", 0],
        ["op-2", 0],
      ])
    );
    expect(shares).toEqual([
      { operatorId: "op-1", shareFraction: 0.5 },
      { operatorId: "op-2", shareFraction: 0.5 },
    ]);
  });
});

describe("deleted/archived records", () => {
  it("excludes an archived record from the live dashboard", () => {
    expect(includeInLiveDashboard({ isArchived: true, isDeleted: false })).toBe(false);
  });

  it("excludes a deleted record from the live dashboard", () => {
    expect(includeInLiveDashboard({ isArchived: false, isDeleted: true })).toBe(false);
  });

  it("includes an active record", () => {
    expect(includeInLiveDashboard({ isArchived: false, isDeleted: false })).toBe(true);
  });
});

describe("late-arriving events", () => {
  it("folds a late event into its correct historical period and flags it revised", () => {
    const adjustment = applyLateArrivingEvent("2026-06", 50000, 12000);
    expect(adjustment.isRevised).toBe(true);
    expect(adjustment.revisedValueCents).toBe(62000);
    expect(adjustment.previousValueCents).toBe(50000);
  });
});
