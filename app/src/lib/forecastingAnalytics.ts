// Forecasting + recovery forecast + pipeline value -- doc 13 sections
// 66-68. PLAN.md P12-24.
//
// "Build basic forecasts for leads, cases, claims, recoveries,
// revenue, cost, and operator workload, based on historical trend.
// Always label these as estimates, never as guaranteed outcomes." /
// "Show pipeline value broken into: potential value (all open cases,
// unqualified), expected value (probability-weighted), committed
// value (claims filed, awaiting decision), collected value (recovery
// already landed)."

// --- Historical-trend forecast (doc 13 §66) ---------------------------------

export type ForecastableMetric = "LEADS" | "CASES" | "CLAIMS" | "RECOVERIES" | "REVENUE" | "COST" | "OPERATOR_WORKLOAD";

export interface ForecastPoint {
  period: string;
  value: number;
}

export interface ForecastResult {
  metric: ForecastableMetric;
  projectedNextValue: number;
  method: "LINEAR_TREND";
  isEstimate: true;
  basedOnPeriods: number;
}

/**
 * Pure: doc 13 §66 -- "always label these as estimates, never as
 * guaranteed outcomes." `isEstimate` is a literal `true` type, not a
 * boolean a caller could accidentally flip. Uses simple linear
 * regression over the supplied history; requires at least 2 points,
 * returning null rather than guessing with less data than that.
 */
export function buildHistoricalTrendForecast(metric: ForecastableMetric, history: readonly ForecastPoint[]): ForecastResult | null {
  if (history.length < 2) return null;
  const n = history.length;
  const xs = history.map((_, i) => i);
  const ys = history.map((p) => p.value);
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;
  const numerator = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
  const denominator = xs.reduce((s, x) => s + (x - xMean) ** 2, 0);
  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;
  const projectedNextValue = Math.round(slope * n + intercept);
  return { metric, projectedNextValue, method: "LINEAR_TREND", isEstimate: true, basedOnPeriods: n };
}

// --- Pipeline value breakdown (doc 13 §67-68) -------------------------------

export interface PipelineValueBreakdown {
  /** All open cases, unqualified. */
  potentialValueCents: number;
  /** Probability-weighted. */
  expectedValueCents: number;
  /** Claims filed, awaiting decision. */
  committedValueCents: number;
  /** Recovery already landed. */
  collectedValueCents: number;
  totalPipelineValueCents: number;
}

export function computePipelineValue(inputs: Omit<PipelineValueBreakdown, "totalPipelineValueCents">): PipelineValueBreakdown {
  return {
    ...inputs,
    totalPipelineValueCents: inputs.potentialValueCents + inputs.expectedValueCents + inputs.committedValueCents + inputs.collectedValueCents,
  };
}
