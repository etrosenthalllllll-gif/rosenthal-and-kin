import { describe, it, expect } from "vitest";
import { computeDetectionTimeMs, computeResolutionTimeMs, computeMeanTimeMs } from "./incidentTimingMetrics";

describe("detection time", () => {
  it("matches the doc's own worked example (10:00 -> 10:02 = 2 minutes)", () => {
    expect(computeDetectionTimeMs("2026-08-26T10:00:00.000Z", "2026-08-26T10:02:00.000Z")).toBe(2 * 60 * 1000);
  });
});

describe("resolution time", () => {
  it("matches the doc's own worked example (10:00 -> 10:45 = 45 minutes)", () => {
    expect(computeResolutionTimeMs("2026-08-26T10:00:00.000Z", "2026-08-26T10:45:00.000Z")).toBe(45 * 60 * 1000);
  });
});

describe("mean time computation", () => {
  it("averages a batch of individual times", () => {
    expect(computeMeanTimeMs([60_000, 120_000, 180_000])).toBe(120_000);
  });

  it("returns null (not zero) for an empty batch", () => {
    expect(computeMeanTimeMs([])).toBeNull();
  });
});
