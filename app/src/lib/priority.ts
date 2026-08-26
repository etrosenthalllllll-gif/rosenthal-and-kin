// Decision priority engine -- doc 02 section 10 "PRIORITY SYSTEM" / section
// 11 "SMART QUEUE", extended by doc 06 section 46 "REVIEW QUEUE
// PRIORITIZATION" (PLAN.md P5-13).
//
// "Do NOT simply sort decisions by creation date." Priority is a
// configurable combination of financial value, deadline proximity, age,
// risk, and (inversely) AI confidence. The exact formula is deliberately
// isolated in one function so it can be tuned without touching anything
// that calls it.
//
// doc 06 section 46 asks for the same underlying factors (claim value,
// confidence, workflow stage/deadline, age) plus two this module didn't
// track before: "Potential competing heirs" and "Number of unresolved
// issues." Both are added below as optional fields -- `undefined`
// contributes nothing, so every existing caller (decisionQueue.ts, etc.)
// that doesn't supply them keeps producing the exact same score it did
// before this change. `riskLevel` already uses the identical
// LOW/MEDIUM/HIGH/CRITICAL vocabulary humanReviewTriggers.ts's
// `ReviewRiskLevel` does (P5-9) -- that module's
// `evaluateReviewTriggers().overallRisk` can be passed straight in as
// `riskLevel` with no translation step.

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PriorityLabel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface PriorityInput {
  potentialRecoveryCents?: number | null;
  deadline?: Date | null;
  createdAt: Date;
  now?: Date; // injectable for deterministic tests
  aiConfidence?: number | null; // 0.0-1.0
  riskLevel?: RiskLevel | null;
  highConsequence?: boolean;
  // doc 06 section 46's own CRITICAL example: "Potential competing heir
  // discovered during claim preparation." Kept as its own signal
  // (rather than folded into riskLevel) since a case can have a
  // competing heir without an operator having classified an overall
  // risk level yet.
  competingHeirsCount?: number;
  // doc 06 section 46: "Number of unresolved issues" -- distinct from
  // severity; five minor discrepancies still deserve more attention
  // than zero, even if none individually rises to HIGH/CRITICAL.
  unresolvedIssueCount?: number;
  // doc 09 section 55's own post-filing prioritization factor --
  // postFilingEscalation.ts's (P8-13) evaluateEscalation().level can be
  // passed straight in, no translation step, same "reuse the identical
  // vocabulary" pattern as riskLevel/ReviewRiskLevel. Note: this only
  // affects *ranking* -- it never overrides a hard deadline's own
  // blocking behavior (filingReadiness.ts/postFilingDeadline.ts), which
  // is enforced independently of where an item sits in the queue.
  escalationLevel?: 0 | 1 | 2 | 3 | 4;
}

const RISK_SCORE: Record<RiskLevel, number> = {
  LOW: 5,
  MEDIUM: 20,
  HIGH: 45,
  CRITICAL: 70,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Diminishing returns on recovery value -- a $2M estate isn't 20x more
// urgent than a $100k one; it's meaningfully more important, not linearly
// so. log10 scaling keeps the value component from swamping everything
// else in the formula.
function valueScore(potentialRecoveryCents?: number | null): number {
  if (!potentialRecoveryCents || potentialRecoveryCents <= 0) return 0;
  const dollars = potentialRecoveryCents / 100;
  return clamp(Math.log10(dollars + 1) * 8, 0, 40);
}

function deadlineScore(deadline: Date | null | undefined, now: Date): number {
  if (!deadline) return 0;
  const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursRemaining <= 0) return 40; // already overdue -- max urgency
  if (hoursRemaining <= 24) return 35;
  if (hoursRemaining <= 24 * 3) return 25;
  if (hoursRemaining <= 24 * 7) return 15;
  if (hoursRemaining <= 24 * 30) return 5;
  return 0;
}

// Older undecided items should surface eventually even with no deadline
// and modest value, so the queue can't starve a low-value case forever.
function ageScore(createdAt: Date, now: Date): number {
  const daysOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return clamp(daysOld * 1.5, 0, 15);
}

// Lower AI confidence means the operator needs to look more carefully,
// not less -- so confidence contributes inversely, and only when it's
// actually present (a decision with no AI recommendation gets 0 here,
// not treated as "zero confidence").
function confidenceUrgency(aiConfidence?: number | null): number {
  if (aiConfidence == null) return 0;
  return clamp((1 - aiConfidence) * 10, 0, 10);
}

// doc 06 section 46's own top example is a competing heir found
// mid-claim-prep, ranked CRITICAL -- a flat, generous bump so even one
// competing heir meaningfully outranks a routine decision, with no
// further reward for additional candidates past the first (more
// candidates doesn't make the single most urgent one more urgent).
function competingHeirScore(count?: number): number {
  return count && count > 0 ? 20 : 0;
}

// Diminishing returns, same reasoning as valueScore -- five open
// issues should rank above one, but not five times as urgent.
function unresolvedIssueScore(count?: number): number {
  if (!count || count <= 0) return 0;
  return clamp(count * 3, 0, 15);
}

// doc 09 section 55: mirrors RISK_SCORE's shape over
// postFilingEscalation.ts's (P8-13) 0-4 ladder instead of
// LOW/MEDIUM/HIGH/CRITICAL. Absent (undefined) contributes 0, same as
// every other optional signal here.
const ESCALATION_LEVEL_SCORE: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 0,
  1: 10,
  2: 25,
  3: 45,
  4: 70,
};

function escalationScore(level?: 0 | 1 | 2 | 3 | 4): number {
  return level == null ? 0 : ESCALATION_LEVEL_SCORE[level];
}

export interface PriorityScore {
  score: number; // 0-100+
  label: PriorityLabel;
  components: {
    value: number;
    deadline: number;
    age: number;
    risk: number;
    confidence: number;
    highConsequenceBonus: number;
    competingHeirs: number;
    unresolvedIssues: number;
    escalation: number;
  };
}

export function computePriorityScore(input: PriorityInput): PriorityScore {
  const now = input.now ?? new Date();
  const components = {
    value: valueScore(input.potentialRecoveryCents),
    deadline: deadlineScore(input.deadline, now),
    age: ageScore(input.createdAt, now),
    risk: RISK_SCORE[input.riskLevel ?? "LOW"],
    confidence: confidenceUrgency(input.aiConfidence),
    // High-consequence decisions (filing, financial, closing -- see
    // decisionTypes.ts) get a flat floor bump so they never quietly rank
    // below a pile of routine outreach approvals.
    highConsequenceBonus: input.highConsequence ? 10 : 0,
    competingHeirs: competingHeirScore(input.competingHeirsCount),
    unresolvedIssues: unresolvedIssueScore(input.unresolvedIssueCount),
    escalation: escalationScore(input.escalationLevel),
  };

  const score =
    components.value +
    components.deadline +
    components.age +
    components.risk +
    components.confidence +
    components.highConsequenceBonus +
    components.competingHeirs +
    components.unresolvedIssues +
    components.escalation;

  return { score, label: priorityLabel(score), components };
}

export function priorityLabel(score: number): PriorityLabel {
  if (score >= 70) return "URGENT";
  if (score >= 45) return "HIGH";
  if (score >= 20) return "MEDIUM";
  return "LOW";
}

/**
 * Sorts a list of decision-like items by priority score, highest first.
 * Never mutates the input array.
 */
export function rankByPriority<T extends PriorityInput>(
  items: readonly T[]
): Array<T & { priority: PriorityScore }> {
  return items
    .map((item) => ({ ...item, priority: computePriorityScore(item) }))
    .sort((a, b) => b.priority.score - a.priority.score);
}
