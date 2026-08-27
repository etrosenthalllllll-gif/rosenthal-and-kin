// Funnel/financial/automation dashboard assembly -- doc 13 sections
// 59-61. PLAN.md P12-22.
//
// "Build three dedicated dashboards: a funnel dashboard (stage-by-
// stage conversion and drop-off), a financial dashboard (revenue,
// cost, contribution margin, profit, ROI), and an automation dashboard
// (automation rate, intervention breakdown, hours saved, automation
// value)." Three dedicated dashboards assembled from P12-4 through
// P12-17's already-computed metrics -- no new logic here.

import type { FunnelStageReport } from "./leadFunnelAnalytics";
import type { FunnelDropOff } from "./funnelConversionAnalysis";
import type { ContributionMarginReport, ProfitRollup } from "./profitAnalytics";
import type { RoiBreakoutRow } from "./roiAnalytics";
import type { AutomationRateReport, InterventionReasonBreakdown } from "./automationRateAnalytics";
import type { HoursSavedReport, AutomationValueReport } from "./automationValueAnalytics";

// --- Funnel dashboard (doc 13 §59) ------------------------------------------

export interface FunnelDashboardView {
  funnelReport: readonly FunnelStageReport[];
  largestDropOff: FunnelDropOff | null;
}

export function buildFunnelDashboard(view: FunnelDashboardView): FunnelDashboardView {
  return { ...view };
}

// --- Financial (analytics) dashboard (doc 13 §60) ---------------------------

export interface AnalyticsFinancialDashboardView {
  revenueCents: number;
  costCents: number;
  contributionMargin: ContributionMarginReport;
  profitRollup: ProfitRollup;
  roiBreakout: readonly RoiBreakoutRow[];
}

export function buildAnalyticsFinancialDashboard(view: AnalyticsFinancialDashboardView): AnalyticsFinancialDashboardView {
  return { ...view };
}

// --- Automation dashboard (doc 13 §61) --------------------------------------

export interface AutomationDashboardView {
  automationRate: AutomationRateReport;
  interventionReasons: readonly InterventionReasonBreakdown[];
  hoursSaved: HoursSavedReport;
  automationValue: AutomationValueReport;
}

export function buildAutomationDashboard(view: AutomationDashboardView): AutomationDashboardView {
  return { ...view };
}
