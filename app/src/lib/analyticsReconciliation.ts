// Analytics reconciliation + edge cases -- doc 13 sections 91-92.
// PLAN.md P12-29 (part 2 of 2, alongside analyticsAccessControl.ts).
//
// "Periodically compare analytics totals against the transactional
// system... If Transactional: 1,245 / Analytics: 1,231, create
// ANALYTICS_RECONCILIATION_ERROR." / "Handle: duplicate leads, merged
// cases, reopened cases, cancelled claims, rejected claims,
// resubmissions, partial recoveries, multiple payments, refunds,
// chargebacks, reversed payments, multiple operators, shared cases,
// cases transferred between operators, deleted/archived records,
// late-arriving events."
//
// Deliberately does not rebuild existing mechanisms for the pieces
// that already exist elsewhere: `financialReconciliation.ts` (P9-14)
// already reconciles payment/invoice/distribution math,
// `paymentReversal.ts` (P9-10) already preserves original payment
// records on reversal/refund, and `dataConsistency.ts` (P10-20)
// already builds the cross-system case timeline transfers rely on.
// This module covers only the analytics-specific counting/attribution
// decisions doc 13 §92's list requires that nothing upstream decides.

// --- Reconciliation against the transactional system (doc 13 §91) ----------

export type AnalyticsReconciliationOutcome = "PASS" | "ANALYTICS_RECONCILIATION_ERROR";

export interface AnalyticsReconciliationResult {
  entityName: string;
  transactionalCount: number;
  analyticsCount: number;
  delta: number;
  outcome: AnalyticsReconciliationOutcome;
}

/**
 * Pure: doc 13 §91's own worked example. Any nonzero delta between the
 * transactional system's count and the analytics layer's count is an
 * error to surface, never silently tolerated as "close enough."
 */
export function evaluateAnalyticsReconciliation(
  entityName: string,
  transactionalCount: number,
  analyticsCount: number
): AnalyticsReconciliationResult {
  const delta = analyticsCount - transactionalCount;
  return {
    entityName,
    transactionalCount,
    analyticsCount,
    delta,
    outcome: delta === 0 ? "PASS" : "ANALYTICS_RECONCILIATION_ERROR",
  };
}

// --- Duplicate leads / merged cases / reopened cases (doc 13 §92) ----------

/**
 * Pure: follows a merge chain (A merged into B, B later merged into C)
 * to its final canonical id, rather than stopping one hop early. A
 * cycle in a corrupted merge map terminates via `seen` instead of
 * looping forever.
 */
export function resolveCanonicalCaseId(caseId: string, mergeMap: ReadonlyMap<string, string>): string {
  let current = caseId;
  const seen = new Set<string>();
  while (mergeMap.has(current) && !seen.has(current)) {
    seen.add(current);
    current = mergeMap.get(current)!;
  }
  return current;
}

/**
 * Pure: doc 13 §92 -- "duplicate leads, merged cases." Counts each
 * underlying entity exactly once by its canonical id, so a lead that
 * was later merged into another case isn't counted as two leads.
 */
export function dedupeByCanonicalId<T extends { id: string }>(records: readonly T[], mergeMap: ReadonlyMap<string, string>): T[] {
  const seenCanonicalIds = new Set<string>();
  const deduped: T[] = [];
  for (const record of records) {
    const canonicalId = resolveCanonicalCaseId(record.id, mergeMap);
    if (!seenCanonicalIds.has(canonicalId)) {
      seenCanonicalIds.add(canonicalId);
      deduped.push(record);
    }
  }
  return deduped;
}

/**
 * Pure: doc 13 §92 -- "reopened cases." A reopened case is the same
 * case reappearing, not a new lead entering the funnel a second time.
 */
export function shouldCountAsNewFunnelEntry(event: { isReopen: boolean }): boolean {
  return !event.isReopen;
}

// --- Cancelled/rejected claims + resubmissions (doc 13 §92) -----------------

export type ClaimOutcomeForAnalytics = "FILED_ACTIVE" | "FILED_CANCELLED" | "FILED_REJECTED" | "RESUBMITTED";

/**
 * Pure: doc 13 §92 -- "cancelled claims, rejected claims." Only an
 * actively-filed claim counts toward filing-success metrics; a
 * cancelled or rejected one still counts in the funnel's denominator
 * (handled upstream by the funnel modules) but not as a success.
 */
export function countsAsSuccessfulFiling(outcome: ClaimOutcomeForAnalytics): boolean {
  return outcome === "FILED_ACTIVE";
}

/**
 * Pure: doc 13 §92 -- "resubmissions." A resubmission is a correction
 * to the same claim, never a second independent filing -- counting it
 * as a new filing would inflate both the numerator and the funnel's
 * apparent volume.
 */
export function shouldCountResubmissionAsNewFiling(): boolean {
  return false;
}

// --- Partial recoveries / multiple payments (doc 13 §92) -------------------

/**
 * Pure: doc 13 §92 -- "partial recoveries, multiple payments." Total
 * recovered is always the sum across every payment received, never
 * just the most recent one.
 */
export function sumPartialRecoveries(paymentsCents: readonly number[]): number {
  return paymentsCents.reduce((sum, cents) => sum + cents, 0);
}

// --- Refunds / chargebacks / reversed payments (doc 13 §92) ----------------

/**
 * Pure: doc 13 §92 -- "refunds, chargebacks, reversed payments."
 * Recognized revenue is always net of every adjustment against it --
 * gross revenue before adjustments is a different, separate figure
 * (doc 13 §93's "never confuse earned/collected revenue with profit"
 * discipline applied to gross-vs-net here).
 */
export function computeNetRevenueAfterAdjustments(
  grossCents: number,
  refundsCents: number,
  chargebacksCents: number,
  reversalsCents: number
): number {
  return grossCents - refundsCents - chargebacksCents - reversalsCents;
}

// --- Multiple operators / shared cases / transfers (doc 13 §92) ------------

export interface OperatorAttributionShare {
  operatorId: string;
  shareFraction: number;
}

/**
 * Pure: doc 13 §92 -- "multiple operators, shared cases." Attribution
 * (for operator-hours and revenue-per-hour metrics) is split
 * proportionally to each operator's recorded hours on the case, never
 * assigned entirely to whichever operator is currently listed as
 * owner. Falls back to an equal split only when no hours were
 * recorded at all for any operator (all-zero input), so a case with
 * real hour data is never equal-split by mistake.
 */
export function splitSharedCaseAttribution(operatorHoursById: ReadonlyMap<string, number>): OperatorAttributionShare[] {
  const operatorIds = [...operatorHoursById.keys()];
  const totalHours = [...operatorHoursById.values()].reduce((sum, hours) => sum + hours, 0);
  if (totalHours === 0) {
    const equalShare = operatorIds.length > 0 ? 1 / operatorIds.length : 0;
    return operatorIds.map((operatorId) => ({ operatorId, shareFraction: equalShare }));
  }
  return operatorIds.map((operatorId) => ({
    operatorId,
    shareFraction: (operatorHoursById.get(operatorId) ?? 0) / totalHours,
  }));
}

// --- Deleted / archived records (doc 13 §92) --------------------------------

/**
 * Pure: doc 13 §92 -- "deleted/archived records." Excluded from live
 * dashboards (so a closed-out case doesn't inflate current-period
 * counts) but never excluded from the audit trail itself -- this
 * function only governs dashboard inclusion, not data retention.
 */
export function includeInLiveDashboard(record: { isArchived: boolean; isDeleted: boolean }): boolean {
  return !record.isArchived && !record.isDeleted;
}

// --- Late-arriving events (doc 13 §92) --------------------------------------

export interface LateArrivingEventAdjustment {
  affectedPeriod: string;
  /** Literal `true` so a revised historical figure can never be
   * mistaken for a value that was correct all along -- same discipline
   * as `scenarioModelingAnalytics.ts`'s (P12-27) `isScenario` flag. */
  isRevised: true;
  previousValueCents: number;
  revisedValueCents: number;
}

/**
 * Pure: doc 13 §92 -- "late-arriving events." A late event is folded
 * into the historical period it actually belongs to, and that period
 * is explicitly flagged as revised rather than silently changing a
 * number a dashboard already showed as final.
 */
export function applyLateArrivingEvent(
  affectedPeriod: string,
  previousValueCents: number,
  lateEventValueCents: number
): LateArrivingEventAdjustment {
  return {
    affectedPeriod,
    isRevised: true,
    previousValueCents,
    revisedValueCents: previousValueCents + lateEventValueCents,
  };
}
