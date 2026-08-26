// Filing deadlines + escalating alerts -- doc 08 section 49. PLAN.md
// P7-18 (part 1 of 4).
//
// "If configured filing deadlines exist, track: deadline, days
// remaining, filing status, required action. Generate alerts. Do not
// fabricate deadlines -- only use configured/verified sources/rules."
//
// `source` is a required field precisely because of that
// non-fabrication instruction -- a deadline with no named source is
// exactly the kind of thing this module refuses to silently invent;
// callers populate it from a real configured rule or authority
// notice, never a guess.

export type FilingDeadlineAlertLevel = "NORMAL" | "HIGH" | "URGENT" | "CRITICAL";

export interface DeadlineEscalationThreshold {
  // The alert escalates to this level once daysRemaining is at or
  // below this threshold. Configurable, not hardcoded -- a caller may
  // supply a different ladder per jurisdiction/authority.
  maxDaysRemaining: number;
  level: FilingDeadlineAlertLevel;
}

export const DEFAULT_DEADLINE_ESCALATION: readonly DeadlineEscalationThreshold[] = [
  { maxDaysRemaining: 0, level: "CRITICAL" }, // due today or overdue
  { maxDaysRemaining: 3, level: "URGENT" },
  { maxDaysRemaining: 7, level: "HIGH" },
];

export interface FilingDeadlineInput {
  deadlineDate: string; // ISO date
  source: string; // required -- see module header
  currentDate: string; // caller-supplied "now"
}

export interface FilingDeadlineAlert {
  daysRemaining: number;
  level: FilingDeadlineAlertLevel;
  isOverdue: boolean;
  source: string;
}

/**
 * Pure: doc 08 section 49. Escalates through the configured threshold
 * ladder (smallest maxDaysRemaining wins first); anything not caught
 * by a threshold is NORMAL.
 */
export function classifyDeadlineAlertLevel(
  daysRemaining: number,
  thresholds: readonly DeadlineEscalationThreshold[] = DEFAULT_DEADLINE_ESCALATION
): FilingDeadlineAlertLevel {
  const sorted = [...thresholds].sort((a, b) => a.maxDaysRemaining - b.maxDaysRemaining);
  for (const threshold of sorted) {
    if (daysRemaining <= threshold.maxDaysRemaining) return threshold.level;
  }
  return "NORMAL";
}

export function evaluateFilingDeadlineAlert(
  input: FilingDeadlineInput,
  thresholds: readonly DeadlineEscalationThreshold[] = DEFAULT_DEADLINE_ESCALATION
): FilingDeadlineAlert {
  const daysRemaining = Math.ceil(
    (new Date(input.deadlineDate).getTime() - new Date(input.currentDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  return {
    daysRemaining,
    level: classifyDeadlineAlertLevel(daysRemaining, thresholds),
    isOverdue: daysRemaining < 0,
    source: input.source,
  };
}
