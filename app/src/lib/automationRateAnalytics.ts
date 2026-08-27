// Human-intervention rate + automation rate + breakdown +
// improvement-over-time -- doc 13 sections 37-40. PLAN.md P12-14.
//
// "Calculate: number of cases requiring human intervention / total
// cases. Track intervention at: lead stage, verification, claim
// preparation, filing, post-filing, recovery." / "Be precise about
// what 'automated' means. Distinguish: Fully automated, AI-assisted,
// Human-approved, Fully manual." (Note: doc 13 §94 restates this list
// with the extra EXCEPTION state -- both are honored here.) / "Show
// why humans intervene... This identifies opportunities for further
// automation." / "Track human-intervention rate over time... reveal
// whether the platform is becoming more autonomous."

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// doc 13 §94's own classification, used everywhere "automated" is
// measured in this module -- never a bare boolean.
export type AutomationStateClassification = "FULLY_AUTOMATED" | "AI_ASSISTED" | "HUMAN_APPROVED" | "HUMAN_REVIEWED" | "MANUAL" | "EXCEPTION";

export type PipelineStage = "LEAD" | "VERIFICATION" | "CLAIM_PREPARATION" | "FILING" | "POST_FILING" | "RECOVERY";

export interface StageInterventionCounts {
  stage: PipelineStage;
  totalCases: number;
  interventionCases: number;
}

export interface StageInterventionRate extends StageInterventionCounts {
  interventionRatePercent: number | null;
}

export function computeInterventionRateByStage(counts: readonly StageInterventionCounts[]): StageInterventionRate[] {
  return counts.map((c) => ({ ...c, interventionRatePercent: ratePercent(c.interventionCases, c.totalCases) }));
}

// --- Automation-state breakdown (doc 13 §38) --------------------------------

export type AutomationStateCounts = Record<AutomationStateClassification, number>;

export interface AutomationRateReport {
  counts: AutomationStateCounts;
  totalCases: number;
  fullyAutomatedRatePercent: number | null;
}

/**
 * Pure: doc 13 §38's own worked example (10,000 cases, 2,000 required
 * human intervention -> 80% automation completion rate). Never
 * collapses the full six-state breakdown into one bare "automated"
 * boolean -- the full counts are always returned alongside the
 * headline rate.
 */
export function computeAutomationRateReport(counts: AutomationStateCounts): AutomationRateReport {
  const totalCases = Object.values(counts).reduce((sum, c) => sum + c, 0);
  return { counts, totalCases, fullyAutomatedRatePercent: ratePercent(counts.FULLY_AUTOMATED, totalCases) };
}

// --- Intervention reason breakdown (doc 13 §39) -----------------------------

export type InterventionReason =
  | "LOW_AI_CONFIDENCE"
  | "MISSING_DOCUMENT"
  | "CONFLICTING_GENEALOGY_DATA"
  | "FILING_REJECTION"
  | "COMMUNICATION_EXCEPTION"
  | "PAYMENT_MISMATCH"
  | "SYSTEM_FAILURE"
  | "OPERATOR_APPROVAL_GATE"
  | "UNKNOWN";

export interface InterventionReasonBreakdown {
  reason: InterventionReason;
  count: number;
  sharePercent: number | null;
}

/**
 * Pure: doc 13 §39 -- "this identifies opportunities for further
 * automation," sorted by count descending so the biggest driver is
 * always first.
 */
export function computeInterventionReasonBreakdown(counts: Partial<Record<InterventionReason, number>>): InterventionReasonBreakdown[] {
  const total = Object.values(counts).reduce((sum, c) => sum + (c ?? 0), 0);
  return (Object.entries(counts) as Array<[InterventionReason, number]>)
    .map(([reason, count]) => ({ reason, count, sharePercent: ratePercent(count, total) }))
    .sort((a, b) => b.count - a.count);
}

// --- Improvement over time (doc 13 §40) -------------------------------------

export interface MonthlyInterventionRate {
  month: string;
  interventionRatePercent: number;
}

/**
 * Pure: doc 13 §40's own worked example (January 32%, February 25%,
 * March 18%) -- a monotonically-decreasing intervention rate across
 * the given periods means the platform is becoming more autonomous.
 * Requires at least two periods; with fewer, there's nothing to
 * compare and the function returns null rather than guessing a trend.
 */
export function isAutomationImproving(monthlyRates: readonly MonthlyInterventionRate[]): boolean | null {
  if (monthlyRates.length < 2) return null;
  for (let i = 1; i < monthlyRates.length; i++) {
    if (monthlyRates[i].interventionRatePercent > monthlyRates[i - 1].interventionRatePercent) return false;
  }
  return true;
}
