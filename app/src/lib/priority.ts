// Decision priority engine -- doc 02 section 10 "PRIORITY SYSTEM" / section
// 11 "SMART QUEUE".
//
// "Do NOT simply sort decisions by creation date." Priority is a
// configurable combination of financial value, deadline proximity, age,
// risk, and (inversely) AI confidence. The exact formula is deliberately
// isolated in one function so it can be tuned without touching anything
// that calls it.

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
  };

  const score =
    components.value +
    components.deadline +
    components.age +
    components.risk +
    components.confidence +
    components.highConsequenceBonus;

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
