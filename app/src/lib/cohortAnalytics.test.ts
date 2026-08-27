import { describe, it, expect } from "vitest";
import { buildCohortComparison, buildRecoveryCurve } from "./cohortAnalytics";

describe("cohort comparison", () => {
  it("computes rates relative to each cohort's own lead count", () => {
    const rows = buildCohortComparison([
      { cohortMonth: "2026-01", leadsAcquired: 1000, responded: 500, converted: 200, filed: 150, recovered: 100, revenueCents: 20_000, costCents: 5_000 },
    ]);
    expect(rows[0].responseRatePercent).toBe(50);
    expect(rows[0].recoveryRatePercent).toBe(10);
    expect(rows[0].roiPercent).toBe(300);
  });

  it("returns null rates for a cohort with no leads yet", () => {
    const rows = buildCohortComparison([
      { cohortMonth: "2026-08", leadsAcquired: 0, responded: 0, converted: 0, filed: 0, recovered: 0, revenueCents: 0, costCents: 0 },
    ]);
    expect(rows[0].responseRatePercent).toBeNull();
    expect(rows[0].roiPercent).toBeNull();
  });
});

describe("recovery curve", () => {
  it("computes percent of eventual value landed at each day mark", () => {
    const curve = buildRecoveryCurve({
      cohortMonth: "2025-06",
      points: [
        { dayMark: 30, recoveredValueCents: 1_000 },
        { dayMark: 90, recoveredValueCents: 8_000 },
      ],
      eventualRecoveryValueCents: 10_000,
    });
    expect(curve.points[0].percentOfEventualValue).toBe(10);
    expect(curve.points[1].percentOfEventualValue).toBe(80);
  });

  it("returns null percentages when the eventual value is not yet known", () => {
    const curve = buildRecoveryCurve({
      cohortMonth: "2026-07",
      points: [{ dayMark: 30, recoveredValueCents: 500 }],
      eventualRecoveryValueCents: null,
    });
    expect(curve.points[0].percentOfEventualValue).toBeNull();
  });
});
