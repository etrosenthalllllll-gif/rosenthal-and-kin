// Scenario modeling + automation-ROI model + scale analysis +
// bottleneck/marginal economics -- doc 13 sections 76-81. PLAN.md
// P12-27.
//
// "Build a scenario calculator with configurable assumptions ('what
// if lead volume doubles', 'what if the automation rate improves 10
// points'). Always label the output SCENARIO / MODEL, never present
// it as an actual result." / "Compare the manual-process model
// against the automated model directly -- cost, time, and outcome." /
// "Estimate what happens at 2x, 5x, 10x current volume -- where does
// the system break first." / "Detect operator bottlenecks: capacity
// vs. demand vs. backlog." / "Estimate the marginal economics of one
// additional lead, case, claim, or recovery -- the incremental
// revenue and cost of handling just one more."

// --- Scenario calculator (doc 13 §76) ---------------------------------------

export type ScenarioAssumptions = Readonly<Record<string, number>>;

export interface ScenarioModelResult<T> {
  scenarioName: string;
  assumptions: ScenarioAssumptions;
  result: T;
  /** Literal `true` -- doc 13 §76's own "never present it as an
   * actual result." */
  isScenario: true;
}

/**
 * Pure: wraps any computed scenario result with its own assumptions
 * and an unmistakable SCENARIO/MODEL label. `computeResult` is
 * supplied by the caller so this stays generic across every scenario
 * type (volume change, automation-rate change, cost change, etc.).
 */
export function buildScenarioModel<T>(scenarioName: string, assumptions: ScenarioAssumptions, computeResult: (assumptions: ScenarioAssumptions) => T): ScenarioModelResult<T> {
  return { scenarioName, assumptions, result: computeResult(assumptions), isScenario: true };
}

// --- Manual-vs-automated model comparison (doc 13 §77) ----------------------

export interface ManualVsAutomatedComparison {
  costDeltaCents: number;
  timeDeltaHours: number;
  automatedIsCheaper: boolean;
  automatedIsFaster: boolean;
}

export function compareManualVsAutomated(params: {
  manualCostCents: number;
  automatedCostCents: number;
  manualTimeHours: number;
  automatedTimeHours: number;
}): ManualVsAutomatedComparison {
  const costDeltaCents = params.manualCostCents - params.automatedCostCents;
  const timeDeltaHours = params.manualTimeHours - params.automatedTimeHours;
  return {
    costDeltaCents,
    timeDeltaHours,
    automatedIsCheaper: costDeltaCents > 0,
    automatedIsFaster: timeDeltaHours > 0,
  };
}

// --- Volume-scaling estimate (doc 13 §78-79) --------------------------------

export interface ScaleEstimate {
  scaleFactor: number;
  projectedVolume: number;
  projectedCostCents: number;
  isEstimate: true;
}

/**
 * Pure: doc 13 §78 -- projects volume and cost at a given multiple of
 * current, always labeled as an estimate (never a committed forecast).
 */
export function estimateAtScale(currentVolume: number, currentCostCents: number, scaleFactor: number): ScaleEstimate {
  return {
    scaleFactor,
    projectedVolume: Math.round(currentVolume * scaleFactor),
    projectedCostCents: Math.round(currentCostCents * scaleFactor),
    isEstimate: true,
  };
}

// --- Operator bottleneck detection (doc 13 §80) -----------------------------

export interface OperatorBottleneckReport {
  capacityUnitsPerPeriod: number;
  demandUnitsPerPeriod: number;
  backlogUnits: number;
  utilizationPercent: number | null;
  isBottlenecked: boolean;
}

/**
 * Pure: doc 13 §80 -- "capacity vs. demand vs. backlog." A bottleneck
 * is flagged when demand exceeds capacity OR a backlog already
 * exists, not solely on a utilization threshold that could look fine
 * even while a backlog quietly accumulates.
 */
export function evaluateOperatorBottleneck(params: { capacityUnitsPerPeriod: number; demandUnitsPerPeriod: number; backlogUnits: number }): OperatorBottleneckReport {
  return {
    ...params,
    utilizationPercent: params.capacityUnitsPerPeriod > 0 ? Math.round((params.demandUnitsPerPeriod / params.capacityUnitsPerPeriod) * 1000) / 10 : null,
    isBottlenecked: params.demandUnitsPerPeriod > params.capacityUnitsPerPeriod || params.backlogUnits > 0,
  };
}

// --- Marginal economics of one additional unit (doc 13 §81) -----------------

export interface MarginalEconomicsResult {
  marginalRevenueCents: number;
  marginalCostCents: number;
  marginalProfitCents: number;
  isProfitable: boolean;
}

export function estimateMarginalEconomics(marginalRevenueCents: number, marginalCostCents: number): MarginalEconomicsResult {
  const marginalProfitCents = marginalRevenueCents - marginalCostCents;
  return { marginalRevenueCents, marginalCostCents, marginalProfitCents, isProfitable: marginalProfitCents > 0 };
}
