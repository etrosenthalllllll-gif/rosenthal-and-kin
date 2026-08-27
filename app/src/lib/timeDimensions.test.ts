import { describe, it, expect } from "vitest";
import { resolveTimeWindow, resolveComparisonWindow, computePercentChange } from "./timeDimensions";

const now = "2026-08-26T15:00:00.000Z";

describe("time window resolution", () => {
  it("resolves TODAY to midnight UTC through now", () => {
    const range = resolveTimeWindow("TODAY", now);
    expect(range.startAt).toBe("2026-08-26T00:00:00.000Z");
    expect(range.endAt).toBe(now);
  });

  it("resolves YESTERDAY to the full prior day", () => {
    const range = resolveTimeWindow("YESTERDAY", now);
    expect(range.startAt).toBe("2026-08-25T00:00:00.000Z");
    expect(range.endAt).toBe("2026-08-26T00:00:00.000Z");
  });

  it("resolves 30D to 30 days before today through now", () => {
    const range = resolveTimeWindow("30D", now);
    expect(range.startAt).toBe("2026-07-27T00:00:00.000Z");
  });

  it("resolves YTD to January 1st of the current year", () => {
    const range = resolveTimeWindow("YTD", now);
    expect(range.startAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("requires an explicit customRange for CUSTOM", () => {
    expect(() => resolveTimeWindow("CUSTOM", now)).toThrow();
    const custom = resolveTimeWindow("CUSTOM", now, { startAt: "2026-01-01T00:00:00.000Z", endAt: "2026-02-01T00:00:00.000Z" });
    expect(custom.startAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("comparison period resolution", () => {
  const current = { startAt: "2026-08-01T00:00:00.000Z", endAt: "2026-08-31T00:00:00.000Z" };

  it("shifts PREVIOUS_PERIOD back by the current range's own duration", () => {
    const previous = resolveComparisonWindow(current, "PREVIOUS_PERIOD");
    expect(previous.endAt).toBe(current.startAt);
  });

  it("shifts PREVIOUS_MONTH back one calendar month", () => {
    const previous = resolveComparisonWindow(current, "PREVIOUS_MONTH");
    expect(previous.startAt).toBe("2026-07-01T00:00:00.000Z");
  });

  it("shifts PREVIOUS_YEAR back one calendar year", () => {
    const previous = resolveComparisonWindow(current, "PREVIOUS_YEAR");
    expect(previous.startAt).toBe("2025-08-01T00:00:00.000Z");
  });
});

describe("percent change computation", () => {
  it("computes a positive percent change", () => {
    expect(computePercentChange(120, 100)).toBe(20);
  });

  it("returns null rather than dividing by a zero baseline", () => {
    expect(computePercentChange(50, 0)).toBeNull();
  });
});
