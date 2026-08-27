// Executive + operational dashboard assembly -- doc 13 sections
// 57-58. PLAN.md P12-21.
//
// "Build an executive summary view: leads, cases, claims, recoveries,
// revenue, cost, net contribution, cost per case, human-intervention
// rate, average time to recovery, ROI -- plus a trend indicator and a
// short list of the top problems needing attention." / "Build a
// separate, today-focused operational view for day-to-day use -- not
// the same page as the executive summary."
//
// Deliberately assembly-only -- packages what P12-1 through P12-20
// already produce into the doc's own mockup shapes, no new logic.

export interface ExecutiveSummaryCounts {
  leads: number;
  cases: number;
  claims: number;
  recoveries: number;
  revenueCents: number;
  costCents: number;
}

export interface ExecutiveSummaryMetrics {
  netContributionCents: number;
  costPerCaseCents: number | null;
  humanInterventionRatePercent: number | null;
  avgTimeToRecoveryDays: number | null;
  roiPercent: number | null;
}

export interface ExecutiveSummaryProblem {
  description: string;
  severity: string;
}

export interface ExecutiveSummaryTrendPoint {
  period: string;
  value: number;
}

export interface ExecutiveSummaryView {
  counts: ExecutiveSummaryCounts;
  metrics: ExecutiveSummaryMetrics;
  trend: readonly ExecutiveSummaryTrendPoint[];
  topProblems: readonly ExecutiveSummaryProblem[];
}

/**
 * Pure: assembles the doc 13 §57 executive-summary mockup from pieces
 * already produced elsewhere in this phase -- no new arithmetic here.
 */
export function buildExecutiveSummaryView(view: ExecutiveSummaryView): ExecutiveSummaryView {
  return { ...view };
}

// --- Operational (today-focused) view (doc 13 §58) --------------------------

export interface OperationalTodayCounts {
  leadsToday: number;
  casesAdvancedToday: number;
  claimsFiledToday: number;
  recoveriesClosedToday: number;
}

export interface OperationalAttentionItem {
  caseId: string;
  reason: string;
}

export interface OperationalView {
  today: OperationalTodayCounts;
  attentionNeeded: readonly OperationalAttentionItem[];
  operatorQueueDepth: number;
}

/**
 * Pure: doc 13 §58 -- "a separate, today-focused operational view for
 * day-to-day use, not the same page as the executive summary." Kept
 * as its own distinct type/function so the two views are never
 * accidentally merged into one page.
 */
export function buildOperationalView(view: OperationalView): OperationalView {
  return { ...view };
}
