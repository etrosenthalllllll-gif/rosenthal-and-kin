// Configuration management -- doc 11 sections 68-69. PLAN.md P10-16.
//
// "Create centralized configuration for: confidence thresholds, retry
// policies, timeouts, approval requirements, scheduling, rate limits,
// cost limits, escalation rules, notification rules. Configurations
// must be versioned and auditable." / "When changing automation
// settings: require appropriate permissions. Record: old value, new
// value, reason, actor, timestamp, affected workflows."

export type AutomationConfigCategory =
  | "CONFIDENCE_THRESHOLD"
  | "RETRY_POLICY"
  | "TIMEOUT"
  | "APPROVAL_REQUIREMENT"
  | "SCHEDULING"
  | "RATE_LIMIT"
  | "COST_LIMIT"
  | "ESCALATION_RULE"
  | "NOTIFICATION_RULE";

export interface AutomationConfigEntry {
  key: string;
  category: AutomationConfigCategory;
  value: unknown;
  version: number;
}

/**
 * Pure: doc 11 §68's own worked example verbatim ("Outreach confidence
 * threshold: Old 95%, New 97%, Reason: Reduce false positives").
 * Publishing a new value is always a new version, never an in-place
 * edit -- same append-only discipline as WorkflowVersion.
 */
export function planNextConfigVersion(current: AutomationConfigEntry, newValue: unknown): AutomationConfigEntry {
  return { ...current, value: newValue, version: current.version + 1 };
}

export interface ConfigChangeInput {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  actor: string;
  timestamp: string;
  affectedWorkflows?: readonly string[];
}

export interface ConfigChangeRecord extends ConfigChangeInput {
  affectedWorkflows: readonly string[];
}

export type ConfigChangeOutcome =
  | { status: "RECORDED"; change: ConfigChangeRecord }
  | { status: "REJECTED_MISSING_AUTHORIZATION" };

/**
 * Pure: doc 11 §69's "require appropriate permissions... record old
 * value, new value, reason, actor, timestamp, affected workflows."
 * Permission-checking itself is the caller's job (auth.ts already owns
 * that); this function enforces the structural half -- a reason and an
 * actor are always required, same "authorization is structurally
 * required" discipline as financialAdjustments.ts's createAdjustment()
 * and automationPause.ts's recordOperatorOverride().
 */
export function recordConfigChange(input: ConfigChangeInput): ConfigChangeOutcome {
  if (!input.reason.trim() || !input.actor.trim()) {
    return { status: "REJECTED_MISSING_AUTHORIZATION" };
  }
  return { status: "RECORDED", change: { ...input, affectedWorkflows: input.affectedWorkflows ?? [] } };
}
