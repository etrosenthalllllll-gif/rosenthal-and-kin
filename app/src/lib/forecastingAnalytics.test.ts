import { describe, it, expect } from "vitest";
import { buildHistoricalTrendForecast, computePipelineValue } from "./forecastingAnalytics";

describe("historical-trend forecast", () => {
  it("projects the next value along a linear trend, labeled as an estimate", () => {
    const result = buildHistoricalTrendForecast("REVENUE", [
      { period: "2026-01", value: 100 },
      { period: "2026-02", value: 200 },
      { period: "2026-03", value: 300 },
    ]);
    expect(result?.projectedNextValue).toBe(400);
    expect(result?.isEstimate).toBe(true);
    expect(result?.method).toBe("LINEAR_TREND");
  });

  it("returns null with fewer than two historical points", () => {
    expect(buildHistoricalTrendForecast("LEADS", [{ period: "2026-01", value: 100 }])).toBeNull();
  });
});

describe("pipeline value breakdown", () => {
  it("sums potential/expected/committed/collected into a total", () => {
    const breakdown = computePipelineValue({
      potentialValueCents: 100_000,
      expectedValueCents: 40_000,
      committedValueCents: 20_000,
      collectedValueCents: 10_000,
    });
    expect(breakdown.totalPipelineValueCents).toBe(170_000);
  });
});
