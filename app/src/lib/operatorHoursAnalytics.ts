// Operator-hours tracking + action tracking + labor estimate/actual
// distinction + utilization -- doc 13 sections 33-36. PLAN.md P12-13.
//
// "Build operator time tracking... Where possible, infer time from
// application events. Allow explicit start/stop timers where accurate
// measurement requires it." / "Every meaningful operator action should
// record: operator, case, action, start time, end time if available,
// duration, outcome, reason." / "Distinguish actual measured time from
// estimated time. Do not present inferred time as fact. Clearly label
// estimates." / "Show: hours worked, cases touched, decisions made,
// claims reviewed, exceptions resolved, average time per case, cases
// per operator hour, revenue per operator hour."

export interface OperatorActionRecord {
  operator: string;
  caseId: string;
  action: string;
  startAt: string;
  endAt?: string;
  durationMs: number | null;
  isEstimated: boolean;
  outcome?: string;
  reason?: string;
}

/**
 * Pure: doc 13 §34's own field list. Duration is only ever computed
 * from a real start/end pair -- if the caller has no end time, this
 * never guesses one; `durationMs` stays null and `isEstimated` reports
 * honestly whether the caller is supplying an inferred fallback.
 */
export function buildOperatorActionRecord(params: {
  operator: string;
  caseId: string;
  action: string;
  startAt: string;
  endAt?: string;
  estimatedDurationMs?: number;
  outcome?: string;
  reason?: string;
}): OperatorActionRecord {
  const measuredDurationMs = params.endAt ? new Date(params.endAt).getTime() - new Date(params.startAt).getTime() : null;
  return {
    operator: params.operator,
    caseId: params.caseId,
    action: params.action,
    startAt: params.startAt,
    endAt: params.endAt,
    durationMs: measuredDurationMs ?? params.estimatedDurationMs ?? null,
    isEstimated: measuredDurationMs === null && params.estimatedDurationMs !== undefined,
    outcome: params.outcome,
    reason: params.reason,
  };
}

// --- Measured vs. estimated labor (doc 13 §35) ------------------------------

export interface LaborTimeSummary {
  measuredMs: number;
  estimatedMs: number;
}

/**
 * Pure: doc 13 §35's own "do not present inferred time as fact" --
 * measured and estimated totals are kept as two separate fields,
 * never summed into one blended "hours worked" number that hides
 * which portion is a guess.
 */
export function summarizeLaborTime(records: readonly OperatorActionRecord[]): LaborTimeSummary {
  return records.reduce<LaborTimeSummary>(
    (acc, r) => {
      if (r.durationMs === null) return acc;
      return r.isEstimated ? { ...acc, estimatedMs: acc.estimatedMs + r.durationMs } : { ...acc, measuredMs: acc.measuredMs + r.durationMs };
    },
    { measuredMs: 0, estimatedMs: 0 }
  );
}

// --- Operator utilization (doc 13 §36) --------------------------------------

export interface OperatorUtilizationCounts {
  hoursWorked: number;
  casesTouched: number;
  decisionsMade: number;
  claimsReviewed: number;
  exceptionsResolved: number;
  revenueCents: number;
}

export interface OperatorUtilizationMetrics extends OperatorUtilizationCounts {
  avgTimePerCaseHours: number | null;
  casesPerOperatorHour: number | null;
  revenuePerOperatorHourCents: number | null;
}

export function computeOperatorUtilization(counts: OperatorUtilizationCounts): OperatorUtilizationMetrics {
  return {
    ...counts,
    avgTimePerCaseHours: counts.casesTouched > 0 ? Math.round((counts.hoursWorked / counts.casesTouched) * 100) / 100 : null,
    casesPerOperatorHour: counts.hoursWorked > 0 ? Math.round((counts.casesTouched / counts.hoursWorked) * 100) / 100 : null,
    revenuePerOperatorHourCents: counts.hoursWorked > 0 ? Math.round(counts.revenueCents / counts.hoursWorked) : null,
  };
}
