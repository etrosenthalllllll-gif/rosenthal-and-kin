// Post-filing dashboard + "what needs attention" queue -- doc 09
// sections 3-4. PLAN.md P8-2.
//
// "Build a centralized dashboard. The operator should not have to open
// individual cases just to discover what requires attention. Create an
// action queue with categories: URGENT, DEADLINE APPROACHING, NEW
// AUTHORITY UPDATE, DOCUMENT REQUEST, HEARING, CLAIMANT RESPONSE,
// PROVIDER RESPONSE, ESCALATION, NO UPDATE, SYSTEM ERROR. The operator
// should be able to process the queue sequentially."
//
// Same exception-queue-first philosophy as exceptionQueue.ts (P1-3):
// this doesn't add a new decision mechanism, it derives which
// attention categories currently apply to a case from signals already
// computed elsewhere (deadline alerts, escalation state, document
// requests, etc.) and assembles the queue an operator processes. A
// case can trigger more than one category at once -- doc 09 never says
// these are mutually exclusive, and collapsing them to just one would
// hide real outstanding work.

export type AttentionCategory =
  | "URGENT"
  | "DEADLINE_APPROACHING"
  | "NEW_AUTHORITY_UPDATE"
  | "DOCUMENT_REQUEST"
  | "HEARING"
  | "CLAIMANT_RESPONSE"
  | "PROVIDER_RESPONSE"
  | "ESCALATION"
  | "NO_UPDATE"
  | "SYSTEM_ERROR";

// Doc 09's own category list, in the priority order an operator should
// see them -- config table, not an inline sort comparator.
export const ATTENTION_CATEGORY_PRIORITY: readonly AttentionCategory[] = [
  "SYSTEM_ERROR",
  "ESCALATION",
  "URGENT",
  "DEADLINE_APPROACHING",
  "HEARING",
  "DOCUMENT_REQUEST",
  "CLAIMANT_RESPONSE",
  "PROVIDER_RESPONSE",
  "NEW_AUTHORITY_UPDATE",
  "NO_UPDATE",
];

export interface PostFilingCaseSignals {
  postFilingCaseId: string;
  hasSystemError: boolean;
  hasEscalation: boolean;
  isUrgent: boolean; // caller-determined (e.g. a CRITICAL deadline alert -- filingDeadlineAlerts.ts)
  hasApproachingDeadline: boolean; // e.g. HIGH/URGENT deadline alert, not yet CRITICAL/urgent-enough for isUrgent
  hasUpcomingHearing: boolean;
  hasOpenDocumentRequest: boolean;
  hasUnprocessedClaimantResponse: boolean;
  hasUnprocessedProviderResponse: boolean;
  hasNewAuthorityUpdate: boolean;
  hasNoRecentUpdate: boolean;
}

const CATEGORY_CHECKS: ReadonlyArray<{ key: keyof Omit<PostFilingCaseSignals, "postFilingCaseId">; category: AttentionCategory }> = [
  { key: "hasSystemError", category: "SYSTEM_ERROR" },
  { key: "hasEscalation", category: "ESCALATION" },
  { key: "isUrgent", category: "URGENT" },
  { key: "hasApproachingDeadline", category: "DEADLINE_APPROACHING" },
  { key: "hasUpcomingHearing", category: "HEARING" },
  { key: "hasOpenDocumentRequest", category: "DOCUMENT_REQUEST" },
  { key: "hasUnprocessedClaimantResponse", category: "CLAIMANT_RESPONSE" },
  { key: "hasUnprocessedProviderResponse", category: "PROVIDER_RESPONSE" },
  { key: "hasNewAuthorityUpdate", category: "NEW_AUTHORITY_UPDATE" },
  { key: "hasNoRecentUpdate", category: "NO_UPDATE" },
];

/**
 * Pure: doc 09 section 4. Every triggered category for this case, in
 * doc-defined priority order -- a case with multiple outstanding
 * issues appears under every category that applies, not just the most
 * severe one.
 */
export function categorizeAttention(signals: PostFilingCaseSignals): AttentionCategory[] {
  return CATEGORY_CHECKS.filter((check) => signals[check.key]).map((check) => check.category);
}

export interface AttentionQueueItem {
  postFilingCaseId: string;
  category: AttentionCategory;
}

/**
 * Pure: builds one queue item per (case, triggered category) pair
 * across every case, sorted by doc 09's own category priority so an
 * operator processing the queue top-to-bottom sees the most severe
 * items first.
 */
export function buildAttentionQueue(cases: readonly PostFilingCaseSignals[]): AttentionQueueItem[] {
  const items: AttentionQueueItem[] = [];
  for (const signals of cases) {
    for (const category of categorizeAttention(signals)) {
      items.push({ postFilingCaseId: signals.postFilingCaseId, category });
    }
  }

  const priorityIndex = new Map(ATTENTION_CATEGORY_PRIORITY.map((c, i) => [c, i]));
  return [...items].sort((a, b) => (priorityIndex.get(a.category) ?? 0) - (priorityIndex.get(b.category) ?? 0));
}

// --- Dashboard row (doc 09 section 3) -----------------------------------
//
// Pure pass-through assembly, same "project already-computed fields
// into one row" role as filingQueue.ts's (P7-18) buildFilingQueueRow()
// -- this module doesn't derive any of these values itself.

export interface PostFilingDashboardRow {
  postFilingCaseId: string;
  caseNumber: string;
  claimantName: string;
  authority: string;
  jurisdiction: string;
  filingStatus: string;
  lastExternalUpdateAt: string | null;
  nextDeadlineAt: string | null;
  daysRemaining: number | null;
  outstandingRequest: string | null;
  riskLevel: string | null;
  priority: number;
  nextAction: string | null;
  assignedOperatorId: string | null;
}

export function buildPostFilingDashboard(rows: readonly PostFilingDashboardRow[]): PostFilingDashboardRow[] {
  return [...rows].sort((a, b) => b.priority - a.priority);
}
