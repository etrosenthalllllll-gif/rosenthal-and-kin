// Automation health score + analytics + human-intervention metrics +
// quality loop -- doc 11 sections 64-67. PLAN.md P10-15.
//
// "Track: workflow success rate, retry rate, failure rate, approval
// backlog, average approval time, sync failure rate, API failure
// rate, duplicate prevention events, dead-letter count, scheduled-job
// success rate." / "For each workflow calculate: total executions,
// fully automated executions, human-assisted executions, human-blocked
// executions, failed executions." / "Store outcome data [AI
// recommendation vs. human decision]... this can later be used to
// improve rules/thresholds/prompts/models/workflow design. Do not
// automatically retrain or change production rules from individual
// outcomes."
//
// Same pure-math, divide-by-zero-guarded-to-null discipline as
// financialAnalytics.ts/postFilingAnalytics.ts/filingAnalytics.ts.

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export interface AutomationHealthCounts {
  jobsExecuted: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsRetried: number;
}

export interface AutomationHealthScore extends AutomationHealthCounts {
  successRate: number | null;
  failureRate: number | null;
  retryRate: number | null;
}

export function computeAutomationHealthScore(counts: AutomationHealthCounts): AutomationHealthScore {
  return {
    ...counts,
    successRate: ratePercent(counts.jobsCompleted, counts.jobsExecuted),
    failureRate: ratePercent(counts.jobsFailed, counts.jobsExecuted),
    retryRate: ratePercent(counts.jobsRetried, counts.jobsExecuted),
  };
}

// --- Human-intervention metrics per workflow (doc 11 §66) -------------------

export interface WorkflowInterventionCounts {
  totalExecutions: number;
  fullyAutomated: number;
  humanAssisted: number;
  humanBlocked: number;
  failed: number;
}

export interface WorkflowInterventionMetrics extends WorkflowInterventionCounts {
  automationRate: number | null;
  humanInterventionRate: number | null;
}

/**
 * Pure: doc 11 §66's own worked example (1,000 executions: 820 fully
 * automated, 150 human approval, 30 exception) -- "this helps identify
 * where automation is actually working." humanInterventionRate covers
 * both human-assisted and human-blocked executions together, since
 * both represent automation falling short of a fully-automated path.
 */
export function computeWorkflowInterventionMetrics(counts: WorkflowInterventionCounts): WorkflowInterventionMetrics {
  return {
    ...counts,
    automationRate: ratePercent(counts.fullyAutomated, counts.totalExecutions),
    humanInterventionRate: ratePercent(counts.humanAssisted + counts.humanBlocked, counts.totalExecutions),
  };
}

// --- Automation quality loop (doc 11 §67) -----------------------------------

export interface AutomationOutcomeRecord {
  recommendation: string;
  confidencePercent: number;
  humanDecision: string;
  agreed: boolean;
  reason?: string;
  timestamp: string;
}

/**
 * Pure: doc 11 §67's own worked example (AI recommended APPROVE at
 * 94% confidence, human REJECTed, reason "Incorrect relationship").
 * This only builds the record for storage -- it never feeds back into
 * rules/thresholds/models itself, per the doc's explicit "do not
 * automatically retrain or change production rules from individual
 * outcomes."
 */
export function buildAutomationOutcomeRecord(params: {
  recommendation: string;
  confidencePercent: number;
  humanDecision: string;
  reason?: string;
  timestamp: string;
}): AutomationOutcomeRecord {
  return { ...params, agreed: params.recommendation === params.humanDecision };
}

/**
 * Pure: the aggregate agreement rate across a batch of stored outcome
 * records -- useful as an input to a *separate*, deliberate review of
 * thresholds/rules, never as an automatic trigger to change them.
 */
export function computeOutcomeAgreementRate(records: readonly AutomationOutcomeRecord[]): number | null {
  if (records.length === 0) return null;
  return ratePercent(records.filter((r) => r.agreed).length, records.length);
}
