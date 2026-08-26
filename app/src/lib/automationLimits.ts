// Automation priority + resource/rate/cost limits -- doc 11 sections
// 54-58. PLAN.md P10-13.
//
// "Create priority levels: CRITICAL, HIGH, NORMAL, LOW." / "Prevent
// one workflow from consuming all resources. Support limits for:
// concurrent workflows, API calls, AI calls, email sends, SMS sends,
// voice calls, document processing, filing requests." / "Implement
// configurable rate limits... when rate limited: queue and retry
// according to policy." / "Track automation costs... if exceeded:
// PAUSE and REQUEST_OPERATOR_REVIEW." / "Create optional budgets...
// per case. If budget is exceeded: create AUTOMATION_BUDGET_EXCEPTION."

export type AutomationPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

const PRIORITY_ORDER: Record<AutomationPriority, number> = { CRITICAL: 3, HIGH: 2, NORMAL: 1, LOW: 0 };

/**
 * Pure: sorts by descending priority (CRITICAL first), stable for
 * equal-priority items -- used for queue ordering, doc 11 §54.
 */
export function sortByAutomationPriority<T extends { priority: AutomationPriority }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
}

// --- Resource limits (doc 11 §55) -------------------------------------------

export type ResourceKind =
  | "CONCURRENT_WORKFLOWS"
  | "API_CALLS"
  | "AI_CALLS"
  | "EMAIL_SENDS"
  | "SMS_SENDS"
  | "VOICE_CALLS"
  | "DOCUMENT_PROCESSING"
  | "FILING_REQUESTS";

export type ResourceLimitTable = Readonly<Partial<Record<ResourceKind, number>>>;

/**
 * Pure: doc 11 §55 -- no resource kind has an implicit unlimited
 * ceiling; an unconfigured kind is treated as having no limit
 * (returns true, i.e. "within limit"), but a configured kind is
 * enforced strictly.
 */
export function isWithinResourceLimit(kind: ResourceKind, currentUsage: number, limits: ResourceLimitTable): boolean {
  const limit = limits[kind];
  if (limit === undefined) return true;
  return currentUsage < limit;
}

// --- Rate limiting (doc 11 §56) ---------------------------------------------

export interface RateLimitWindow {
  maxRequests: number;
  windowMs: number;
}

export type RateLimitOutcome = "ALLOWED" | "RATE_LIMITED";

/**
 * Pure: doc 11 §56's own scoping list (provider/workflow/case/action-
 * type/API key) is left to the caller -- this just evaluates one
 * scope's window given the timestamps of requests already made in it.
 * Requests older than the window don't count.
 */
export function evaluateRateLimit(
  window: RateLimitWindow,
  recentRequestTimestampsMs: readonly number[],
  nowMs: number
): RateLimitOutcome {
  const windowStart = nowMs - window.windowMs;
  const withinWindow = recentRequestTimestampsMs.filter((t) => t > windowStart).length;
  return withinWindow < window.maxRequests ? "ALLOWED" : "RATE_LIMITED";
}

// --- Cost controls + automation budgets (doc 11 §57-58) ---------------------

export type CostLimitOutcome = "WITHIN_LIMIT" | "PAUSE_AND_REQUEST_REVIEW";

/**
 * Pure: doc 11 §57 -- exceeding a configured cost ceiling (e.g.
 * MAX_AI_COST_PER_CASE, MAX_DAILY_API_COST) pauses and requests
 * operator review; it never silently keeps spending.
 */
export function evaluateCostLimit(spentCents: number, limitCents: number): CostLimitOutcome {
  return spentCents >= limitCents ? "PAUSE_AND_REQUEST_REVIEW" : "WITHIN_LIMIT";
}

export interface CaseAutomationBudget {
  aiBudgetCents?: number;
  communicationBudgetCents?: number;
  researchBudgetCents?: number;
}

export interface CaseAutomationSpend {
  aiSpentCents: number;
  communicationSpentCents: number;
  researchSpentCents: number;
}

export interface AutomationBudgetException {
  category: "AI" | "COMMUNICATION" | "RESEARCH";
  spentCents: number;
  budgetCents: number;
}

/**
 * Pure: doc 11 §58 -- per-case optional budgets across three
 * categories, checked independently (a research overrun doesn't get
 * masked by AI spend being under budget, and vice versa). Returns
 * every category that's over budget rather than stopping at the
 * first, so a caller sees the full picture in one call.
 */
export function evaluateAutomationBudget(
  budget: CaseAutomationBudget,
  spend: CaseAutomationSpend
): AutomationBudgetException[] {
  const exceptions: AutomationBudgetException[] = [];
  if (budget.aiBudgetCents !== undefined && spend.aiSpentCents >= budget.aiBudgetCents) {
    exceptions.push({ category: "AI", spentCents: spend.aiSpentCents, budgetCents: budget.aiBudgetCents });
  }
  if (budget.communicationBudgetCents !== undefined && spend.communicationSpentCents >= budget.communicationBudgetCents) {
    exceptions.push({
      category: "COMMUNICATION",
      spentCents: spend.communicationSpentCents,
      budgetCents: budget.communicationBudgetCents,
    });
  }
  if (budget.researchBudgetCents !== undefined && spend.researchSpentCents >= budget.researchBudgetCents) {
    exceptions.push({
      category: "RESEARCH",
      spentCents: spend.researchSpentCents,
      budgetCents: budget.researchBudgetCents,
    });
  }
  return exceptions;
}
