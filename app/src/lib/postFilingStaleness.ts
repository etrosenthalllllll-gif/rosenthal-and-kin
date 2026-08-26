// Stale-case/no-update monitoring + calendar/timezone handling -- doc
// 09 sections 53-54, 57-58. PLAN.md P8-16.
//
// "Track how long cases remain unchanged; create a NO_UPDATE_ALERT.
// Do not imply that a delay means rejection. Create configurable
// stale-case thresholds by status (e.g. PROCESSING > 30 days -> review;
// DOCUMENT REQUEST > 7 days -> claimant reminder; PENDING > 60 days ->
// escalation). Every event/deadline must preserve its time zone --
// store UTC + relevant local timezone, display local time, never
// assume the operator's timezone equals the authority's timezone.
// Where business-day calculations are required, support weekends,
// holidays, jurisdiction-specific holidays via a versioned/configurable
// holiday calendar -- do not hardcode assumptions."
//
// doc 09 section 55's own priority-scoring extension lives in
// priority.ts (P8-16 also extends that file directly) -- this module
// covers the staleness-detection and calendar/timezone half.

// --- No-update / stale-case monitoring (doc 09 sections 53-54) --------

export interface NoUpdateCheckResult {
  daysSinceLastUpdate: number;
  isStale: boolean;
}

/**
 * Pure: doc 09 section 53. Purely factual -- "stale" here means only
 * "longer than expected since the last check," never an implication
 * about the outcome. The caller decides what a NO_UPDATE_ALERT should
 * say; this function never phrases delay as rejection.
 */
export function checkNoUpdate(
  lastExternalUpdateAt: string,
  now: string,
  expectedCheckIntervalDays: number
): NoUpdateCheckResult {
  const daysSinceLastUpdate = (new Date(now).getTime() - new Date(lastExternalUpdateAt).getTime()) / (1000 * 60 * 60 * 24);
  return { daysSinceLastUpdate, isStale: daysSinceLastUpdate > expectedCheckIntervalDays };
}

export interface StaleCaseThreshold {
  status: string;
  thresholdDays: number;
  action: string;
}

// doc 09 section 54's own worked examples, verbatim, as a config table
// -- not hardcoded per-status branches. Configurable by
// authority/claim type via a caller-supplied threshold list.
export const DEFAULT_STALE_CASE_THRESHOLDS: readonly StaleCaseThreshold[] = [
  { status: "PROCESSING", thresholdDays: 30, action: "REVIEW" },
  { status: "ADDITIONAL_INFORMATION_REQUIRED", thresholdDays: 7, action: "CLAIMANT_REMINDER" },
  { status: "PENDING", thresholdDays: 60, action: "ESCALATION" },
];

export interface StaleCaseCheckResult {
  isStale: boolean;
  action?: string;
}

/**
 * Pure: doc 09 section 54. A status with no configured threshold never
 * triggers staleness -- there's nothing to compare against, so this
 * fails to "not stale" rather than guessing a default threshold.
 */
export function checkStaleCaseThreshold(
  status: string,
  daysInStatus: number,
  thresholds: readonly StaleCaseThreshold[] = DEFAULT_STALE_CASE_THRESHOLDS
): StaleCaseCheckResult {
  const threshold = thresholds.find((t) => t.status === status);
  if (!threshold) return { isStale: false };
  if (daysInStatus <= threshold.thresholdDays) return { isStale: false };
  return { isStale: true, action: threshold.action };
}

// --- Timezone preservation (doc 09 section 57) --------------------------

export interface TimestampWithTimezone {
  utc: string;
  // The authority's own timezone (IANA name, e.g. "America/Los_Angeles")
  // -- never assumed to equal the operator's timezone. Both are
  // preserved so the UI can display local time correctly regardless of
  // who's viewing it.
  authorityTimezone: string;
}

export function isValidTimestampWithTimezone(value: TimestampWithTimezone): boolean {
  return !Number.isNaN(new Date(value.utc).getTime()) && value.authorityTimezone.trim().length > 0;
}

// --- Business-day calculations (doc 09 section 58) ----------------------

export interface HolidayCalendar {
  version: string;
  // ISO dates (YYYY-MM-DD), explicit and versioned -- never a hardcoded
  // assumption baked into the calculation function itself.
  holidays: readonly string[];
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function toIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Pure: doc 09 section 58. A day is a business day only if it's
 * neither a weekend nor listed in the supplied (versioned) holiday
 * calendar -- the calendar is always an explicit input, never an
 * assumption this function bakes in.
 */
export function isBusinessDay(date: Date, calendar: HolidayCalendar): boolean {
  if (isWeekend(date)) return false;
  return !calendar.holidays.includes(toIsoDateOnly(date));
}

/**
 * Pure: advances from `startDate` by `businessDays` business days per
 * the given calendar, skipping weekends and configured holidays.
 */
export function addBusinessDays(startDate: Date, businessDays: number, calendar: HolidayCalendar): Date {
  const result = new Date(startDate.getTime());
  let remaining = businessDays;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (isBusinessDay(result, calendar)) {
      remaining -= 1;
    }
  }
  return result;
}
