// Escalation engine -- doc 09 sections 41-44. PLAN.md P8-13.
//
// "Escalation triggers: deadline approaching, deadline overdue, hearing
// scheduled, hearing within threshold, authority rejection, unknown
// authority event, conflicting status, missing claimant response,
// missing critical document, failed automated submission, provider
// outage, repeated unsuccessful follow-ups, high-risk case, system
// error, low-confidence AI classification. Levels: 0 Normal, 1 Operator
// attention, 2 High priority, 3 Urgent, 4 Critical. An escalation has:
// UNACKNOWLEDGED, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED. If an
// escalation remains unacknowledged, escalate to the next level
// according to configured rules."
//
// Same config-table + fail-closed discipline as humanReviewTriggers.ts
// (P5-9): every trigger maps to a level, an unconfigured trigger fails
// closed to the highest level (CRITICAL/4) rather than being
// under-flagged, and the overall result is the single highest level
// among everything that fired.

// doc 09 section 41's own trigger list, verbatim.
export type EscalationTriggerType =
  | "DEADLINE_APPROACHING"
  | "DEADLINE_OVERDUE"
  | "HEARING_SCHEDULED"
  | "HEARING_WITHIN_THRESHOLD"
  | "AUTHORITY_REJECTION"
  | "UNKNOWN_AUTHORITY_EVENT"
  | "CONFLICTING_STATUS"
  | "MISSING_CLAIMANT_RESPONSE"
  | "MISSING_CRITICAL_DOCUMENT"
  | "FAILED_AUTOMATED_SUBMISSION"
  | "PROVIDER_OUTAGE"
  | "REPEATED_UNSUCCESSFUL_FOLLOW_UPS"
  | "HIGH_RISK_CASE"
  | "SYSTEM_ERROR"
  | "LOW_CONFIDENCE_AI_CLASSIFICATION";

// doc 09 section 42's own 5-level ladder, verbatim.
export type EscalationLevel = 0 | 1 | 2 | 3 | 4;

export const ESCALATION_LEVEL_DESCRIPTIONS: Record<EscalationLevel, string> = {
  0: "Normal",
  1: "Operator attention",
  2: "High priority",
  3: "Urgent",
  4: "Critical",
};

// A trigger not in this table fails closed to level 4 (CRITICAL) in
// getTriggerEscalationLevel() below -- same discipline as
// humanReviewTriggers.ts's getTriggerRisk().
export const ESCALATION_TRIGGER_LEVEL: Record<EscalationTriggerType, EscalationLevel> = {
  DEADLINE_APPROACHING: 1,
  HEARING_SCHEDULED: 1,
  LOW_CONFIDENCE_AI_CLASSIFICATION: 1,
  HEARING_WITHIN_THRESHOLD: 2,
  UNKNOWN_AUTHORITY_EVENT: 2,
  CONFLICTING_STATUS: 2,
  MISSING_CLAIMANT_RESPONSE: 2,
  PROVIDER_OUTAGE: 2,
  REPEATED_UNSUCCESSFUL_FOLLOW_UPS: 2,
  DEADLINE_OVERDUE: 3,
  AUTHORITY_REJECTION: 3,
  MISSING_CRITICAL_DOCUMENT: 3,
  FAILED_AUTOMATED_SUBMISSION: 3,
  HIGH_RISK_CASE: 3,
  SYSTEM_ERROR: 4,
};

export function getTriggerEscalationLevel(type: EscalationTriggerType): EscalationLevel {
  return ESCALATION_TRIGGER_LEVEL[type] ?? 4;
}

export interface FiredEscalationTrigger {
  type: EscalationTriggerType;
  level: EscalationLevel;
}

export interface EscalationEvaluationResult {
  level: EscalationLevel;
  firedTriggers: FiredEscalationTrigger[];
}

/**
 * Pure: doc 09 sections 41-43. The overall level is the single highest
 * level among every trigger that fired -- Normal (0) only when nothing
 * fired at all.
 */
export function evaluateEscalation(triggers: readonly EscalationTriggerType[]): EscalationEvaluationResult {
  const firedTriggers = triggers.map((type) => ({ type, level: getTriggerEscalationLevel(type) }));
  const level = firedTriggers.reduce<EscalationLevel>((highest, t) => (t.level > highest ? t.level : highest), 0);
  return { level, firedTriggers };
}

// --- Escalation acknowledgment (doc 09 section 44) ---------------------

export type EscalationAcknowledgmentStatus = "UNACKNOWLEDGED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

/**
 * Pure: doc 09 section 44. An unacknowledged escalation climbs one
 * level (capped at 4/CRITICAL) -- any other acknowledgment status
 * leaves the level unchanged, since escalating further only makes
 * sense while nobody has taken ownership of it yet.
 */
export function nextEscalationLevelIfUnacknowledged(
  currentLevel: EscalationLevel,
  status: EscalationAcknowledgmentStatus
): EscalationLevel {
  if (status !== "UNACKNOWLEDGED") return currentLevel;
  return Math.min(currentLevel + 1, 4) as EscalationLevel;
}
