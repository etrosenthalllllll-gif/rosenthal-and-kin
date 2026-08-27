// Time dimensions + comparison periods -- doc 13 section 4. PLAN.md
// P12-2.
//
// "Every major metric should support: Today, Yesterday, 7 days, 30
// days, 90 days, Year-to-date, Custom date range. Support comparison
// against: Previous period, Previous month, Previous quarter,
// Previous year where enough data exists."

export type TimeWindowLabel = "TODAY" | "YESTERDAY" | "7D" | "30D" | "90D" | "YTD" | "CUSTOM";

export interface DateRange {
  startAt: string;
  endAt: string;
}

function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Pure: resolves one of the doc's own named windows into a concrete
 * [startAt, endAt) range, ending at `now`. CUSTOM requires the caller
 * to supply its own range explicitly -- this function never invents
 * one.
 */
export function resolveTimeWindow(window: TimeWindowLabel, now: string, customRange?: DateRange): DateRange {
  const nowDate = new Date(now);
  const today = startOfDayUTC(nowDate);

  switch (window) {
    case "TODAY":
      return { startAt: today.toISOString(), endAt: now };
    case "YESTERDAY": {
      const yesterday = addDaysUTC(today, -1);
      return { startAt: yesterday.toISOString(), endAt: today.toISOString() };
    }
    case "7D":
      return { startAt: addDaysUTC(today, -7).toISOString(), endAt: now };
    case "30D":
      return { startAt: addDaysUTC(today, -30).toISOString(), endAt: now };
    case "90D":
      return { startAt: addDaysUTC(today, -90).toISOString(), endAt: now };
    case "YTD":
      return { startAt: new Date(Date.UTC(nowDate.getUTCFullYear(), 0, 1)).toISOString(), endAt: now };
    case "CUSTOM":
      if (!customRange) throw new Error("CUSTOM time window requires an explicit customRange.");
      return customRange;
  }
}

// --- Comparison periods (doc 13 §4) -----------------------------------------

export type ComparisonPeriodLabel = "PREVIOUS_PERIOD" | "PREVIOUS_MONTH" | "PREVIOUS_QUARTER" | "PREVIOUS_YEAR";

/**
 * Pure: doc 13 §4's own comparison list. PREVIOUS_PERIOD shifts the
 * current range back by its own length (an equal-length window
 * immediately prior); PREVIOUS_MONTH/QUARTER/YEAR shift by calendar
 * units regardless of the current range's length, since those are
 * fixed calendar comparisons, not "the same duration further back."
 */
export function resolveComparisonWindow(current: DateRange, comparison: ComparisonPeriodLabel): DateRange {
  const start = new Date(current.startAt);
  const end = new Date(current.endAt);
  const durationMs = end.getTime() - start.getTime();

  switch (comparison) {
    case "PREVIOUS_PERIOD":
      return { startAt: new Date(start.getTime() - durationMs).toISOString(), endAt: current.startAt };
    case "PREVIOUS_MONTH":
      return {
        startAt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, start.getUTCDate())).toISOString(),
        endAt: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, end.getUTCDate())).toISOString(),
      };
    case "PREVIOUS_QUARTER":
      return {
        startAt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 3, start.getUTCDate())).toISOString(),
        endAt: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 3, end.getUTCDate())).toISOString(),
      };
    case "PREVIOUS_YEAR":
      return {
        startAt: new Date(Date.UTC(start.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate())).toISOString(),
        endAt: new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate())).toISOString(),
      };
  }
}

/**
 * Pure: percent change from previous to current, guarded against a
 * zero (or negative, which shouldn't occur for a count/amount but is
 * still guarded) baseline -- null, never a divide-by-zero Infinity or
 * NaN silently displayed as a number.
 */
export function computePercentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
