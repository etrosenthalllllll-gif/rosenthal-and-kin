import { describe, it, expect } from "vitest";
import {
  buildScenarioModel,
  compareManualVsAutomated,
  estimateAtScale,
  evaluateOperatorBottleneck,
  estimateMarginalEconomics,
} from "./scenarioModelingAnalytics";

describe("scenario calculator", () => {
  it("labels every result as a scenario, never an actual result", () => {
    const model = buildScenarioModel("double lead volume", { leadVolumeMultiplier: 2 }, (a) => a.leadVolumeMultiplier * 1000);
    expect(model.isScenario).toBe(true);
    expect(model.result).toBe(2000);
    expect(model.scenarioName).toBe("double lead volume");
  });
});

describe("manual vs automated comparison", () => {
  it("shows automation is cheaper and faster", () => {
    const comparison = compareManualVsAutomated({ manualCostCents: 1000, automatedCostCents: 200, manualTimeHours: 5, automatedTimeHours: 0.5 });
    expect(comparison.automatedIsCheaper).toBe(true);
    expect(comparison.automatedIsFaster).toBe(true);
    expect(comparison.costDeltaCents).toBe(800);
  });
});

describe("volume-scaling estimate", () => {
  it("projects volume and cost at a given scale factor, labeled as an estimate", () => {
    const estimate = estimateAtScale(100, 5_000, 5);
    expect(estimate.projectedVolume).toBe(500);
    expect(estimate.projectedCostCents).toBe(25_000);
    expect(estimate.isEstimate).toBe(true);
  });
});

describe("operator bottleneck detection", () => {
  it("flags a bottleneck when demand exceeds capacity", () => {
    const report = evaluateOperatorBottleneck({ capacityUnitsPerPeriod: 100, demandUnitsPerPeriod: 150, backlogUnits: 0 });
    expect(report.isBottlenecked).toBe(true);
  });

  it("flags a bottleneck when a backlog exists even if demand is within capacity", () => {
    const report = evaluateOperatorBottleneck({ capacityUnitsPerPeriod: 100, demandUnitsPerPeriod: 80, backlogUnits: 5 });
    expect(report.isBottlenecked).toBe(true);
  });

  it("does not flag a bottleneck when demand is within capacity and there's no backlog", () => {
    const report = evaluateOperatorBottleneck({ capacityUnitsPerPeriod: 100, demandUnitsPerPeriod: 80, backlogUnits: 0 });
    expect(report.isBottlenecked).toBe(false);
  });
});

describe("marginal economics", () => {
  it("computes the marginal profit of one additional unit", () => {
    const result = estimateMarginalEconomics(500, 100);
    expect(result.marginalProfitCents).toBe(400);
    expect(result.isProfitable).toBe(true);
  });

  it("flags an unprofitable marginal unit", () => {
    const result = estimateMarginalEconomics(50, 100);
    expect(result.isProfitable).toBe(false);
  });
});
