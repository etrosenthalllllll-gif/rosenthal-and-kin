// Deadline dashboard + escalation -- doc 09 sections 24-25. PLAN.md
// P8-8.
//
// "Create dashboard groupings: TODAY, NEXT 3 DAYS, NEXT 7 DAYS, NEXT 30
// DAYS, OVERDUE, COMPLETED. Create escalating alerts: 7 days -- normal
// notification; 3 days -- high priority; 24 hours -- urgent; overdue
// -- critical. Escalation thresholds must be configurable."
//
// The escalation-level ladder here is the identical shape
// filingDeadlineAlerts.ts (P7-18) already built for filing deadlines --
// same config-table-of-thresholds pattern, reused directly rather than
// re-implemented under a new name, same reuse discipline as
// filingData.ts delegating to formFieldMapping.ts.

import { classifyDeadlineAlertLevel, type DeadlineEscalationThreshold, type FilingDeadlineAlertLevel } from "./filingDeadlineAlerts";
import type { DeadlineStatus } from "./postFilingDeadline";

export type DeadlineEscalationLevel = FilingDeadlineAlertLevel;

export function classifyPostFilingDeadlineEscalation(
  daysRemaining: number,
  thresholds?: readonly DeadlineEscalationThreshold[]
): DeadlineEscalationLevel {
  return classifyDeadlineAlertLevel(daysRemaining, thresholds);
}

// doc 09 section 24's own dashboard groupings, verbatim.
export type DeadlineDashboardGroup = "OVERDUE" | "TODAY" | "NEXT_3_DAYS" | "NEXT_7_DAYS" | "NEXT_30_DAYS" | "COMPLETED" | "OTHER";

const RESOLVED_STATUSES: ReadonlySet<DeadlineStatus> = new Set(["COMPLETED", "WAIVED", "CANCELLED"]);

/**
 * Pure: doc 09 section 24. A resolved deadline (completed, waived,
 * cancelled) always groups as COMPLETED regardless of its date --
 * date-based grouping only applies to deadlines still outstanding.
 */
export function groupDeadline(daysRemaining: number, status: DeadlineStatus): DeadlineDashboardGroup {
  if (RESOLVED_STATUSES.has(status)) return "COMPLETED";
  if (daysRemaining < 0) return "OVERDUE";
  if (daysRemaining === 0) return "TODAY";
  if (daysRemaining <= 3) return "NEXT_3_DAYS";
  if (daysRemaining <= 7) return "NEXT_7_DAYS";
  if (daysRemaining <= 30) return "NEXT_30_DAYS";
  return "OTHER";
}

export interface DeadlineDashboardEntry {
  deadlineId: string;
  daysRemaining: number;
  status: DeadlineStatus;
}

export type DeadlineDashboard = Record<DeadlineDashboardGroup, string[]>;

// A fresh object with fresh arrays every call -- never share array
// references across calls, or one caller pushing into its dashboard
// would silently mutate every other caller's "empty" dashboard too.
export function emptyDeadlineDashboard(): DeadlineDashboard {
  return {
    OVERDUE: [],
    TODAY: [],
    NEXT_3_DAYS: [],
    NEXT_7_DAYS: [],
    NEXT_30_DAYS: [],
    COMPLETED: [],
    OTHER: [],
  };
}

export function buildDeadlineDashboard(entries: readonly DeadlineDashboardEntry[]): DeadlineDashboard {
  const dashboard = emptyDeadlineDashboard();

  for (const entry of entries) {
    dashboard[groupDeadline(entry.daysRemaining, entry.status)].push(entry.deadlineId);
  }

  return dashboard;
}
