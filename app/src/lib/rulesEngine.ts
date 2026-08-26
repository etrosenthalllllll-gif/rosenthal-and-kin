// Trigger conditions + rules engine -- doc 11 sections 11-16. PLAN.md
// P10-4.
//
// "Rules should be represented as data/configuration rather than
// scattered throughout application code." / Operators: =, !=, >, <,
// >=, <=, IN, NOT IN, CONTAINS, EXISTS, NOT EXISTS, AND, OR, NOT,
// BETWEEN, MATCHES -- "Rules should support nested logical
// conditions." / "Every rule decision must be reproducible. Store:
// input data, rule version, condition results, final decision,
// timestamp, actor/system."
//
// Config-table rule pattern, same discipline as complianceRules.ts/
// claimRules.ts/recoveryFeeRules.ts throughout this codebase: a rule
// is data (conditions + output + version + author + reason), never a
// hardcoded if/else chain baked into a workflow step.

export type RuleComparisonOperator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "IN"
  | "NOT IN"
  | "CONTAINS"
  | "EXISTS"
  | "NOT EXISTS"
  | "BETWEEN"
  | "MATCHES";

export type RuleLogicalOperator = "AND" | "OR" | "NOT";

export interface RuleComparisonCondition {
  kind: "comparison";
  field: string;
  operator: RuleComparisonOperator;
  value?: unknown;
}

export interface RuleLogicalCondition {
  kind: "logical";
  operator: RuleLogicalOperator;
  conditions: readonly RuleCondition[];
}

export type RuleCondition = RuleComparisonCondition | RuleLogicalCondition;

export interface Rule {
  id: string;
  name: string;
  version: number;
  conditions: RuleCondition;
  output: Record<string, unknown>;
  priority?: number;
  effectiveDate?: string;
  expirationDate?: string;
  enabled: boolean;
  author: string;
  reason?: string;
  approval?: string;
}

function getField(data: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, data);
}

export interface ConditionResult {
  condition: RuleCondition;
  result: boolean;
  actualValue?: unknown;
  children?: ConditionResult[];
}

function compare(operator: RuleComparisonOperator, actual: unknown, expected: unknown): boolean {
  switch (operator) {
    case "=":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "<":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case ">=":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "<=":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "IN":
      return Array.isArray(expected) && expected.includes(actual);
    case "NOT IN":
      return Array.isArray(expected) && !expected.includes(actual);
    case "CONTAINS":
      if (Array.isArray(actual)) return actual.includes(expected);
      if (typeof actual === "string" && typeof expected === "string") return actual.includes(expected);
      return false;
    case "EXISTS":
      return actual !== undefined && actual !== null;
    case "NOT EXISTS":
      return actual === undefined || actual === null;
    case "BETWEEN": {
      if (!Array.isArray(expected) || expected.length !== 2 || typeof actual !== "number") return false;
      const [low, high] = expected as [number, number];
      return actual >= low && actual <= high;
    }
    case "MATCHES":
      return typeof actual === "string" && typeof expected === "string" && new RegExp(expected).test(actual);
    default:
      // Fail closed: an operator this engine doesn't recognize is
      // never silently treated as a pass.
      return false;
  }
}

/**
 * Pure: evaluates one condition node (recursing through nested
 * AND/OR/NOT) against the supplied data, returning the full
 * child-by-child result tree so callers can produce a doc-11-§16-style
 * auditable breakdown, not just a bare boolean.
 */
export function evaluateCondition(condition: RuleCondition, data: Record<string, unknown>): ConditionResult {
  if (condition.kind === "comparison") {
    const actualValue = getField(data, condition.field);
    return { condition, result: compare(condition.operator, actualValue, condition.value), actualValue };
  }

  const children = condition.conditions.map((c) => evaluateCondition(c, data));
  let result: boolean;
  if (condition.operator === "AND") {
    result = children.every((c) => c.result);
  } else if (condition.operator === "OR") {
    result = children.some((c) => c.result);
  } else {
    // NOT: doc 11 §14 lists NOT as a unary logical operator -- applied
    // to the first (and expected only) child condition.
    result = children.length > 0 ? !children[0].result : false;
  }
  return { condition, result, children };
}

export interface RuleEvaluationRecord {
  ruleId: string;
  ruleVersion: number;
  passed: boolean;
  output: Record<string, unknown> | null;
  conditionResult: ConditionResult;
  inputData: Record<string, unknown>;
  evaluatedAt: string;
  actor?: string;
}

/**
 * doc 11 §15's evaluation steps as one function: load the rule
 * (already the caller's job -- this takes it directly), gather data
 * (caller's job, passed in), evaluate conditions, produce a
 * deterministic result, and record everything needed for §16's
 * reproducibility requirement.
 *
 * A disabled rule or one outside its effective/expiration window never
 * evaluates to a pass -- it's treated as not applicable, output null,
 * same fail-closed-on-unrecognized-input discipline used throughout
 * this codebase.
 */
export function evaluateRule(
  rule: Rule,
  data: Record<string, unknown>,
  now: string,
  actor?: string
): RuleEvaluationRecord {
  const withinWindow =
    (!rule.effectiveDate || rule.effectiveDate <= now) && (!rule.expirationDate || rule.expirationDate >= now);

  if (!rule.enabled || !withinWindow) {
    return {
      ruleId: rule.id,
      ruleVersion: rule.version,
      passed: false,
      output: null,
      conditionResult: { condition: rule.conditions, result: false },
      inputData: data,
      evaluatedAt: now,
      actor,
    };
  }

  const conditionResult = evaluateCondition(rule.conditions, data);
  return {
    ruleId: rule.id,
    ruleVersion: rule.version,
    passed: conditionResult.result,
    output: conditionResult.result ? rule.output : null,
    conditionResult,
    inputData: data,
    evaluatedAt: now,
    actor,
  };
}

/**
 * Evaluates every enabled/in-window rule in a table against the same
 * data and returns them ordered by descending priority (higher number
 * first) -- doc 11 §13 lists priority as a rule field without
 * specifying tie-break direction; higher-priority rules are treated as
 * more specific/urgent, matching every other priority ladder in this
 * codebase (exceptionQueue.ts's escalation levels, etc.).
 */
export function evaluateRuleTable(
  rules: readonly Rule[],
  data: Record<string, unknown>,
  now: string,
  actor?: string
): RuleEvaluationRecord[] {
  return rules
    .map((rule) => evaluateRule(rule, data, now, actor))
    .sort((a, b) => {
      const ruleA = rules.find((r) => r.id === a.ruleId)!;
      const ruleB = rules.find((r) => r.id === b.ruleId)!;
      return (ruleB.priority ?? 0) - (ruleA.priority ?? 0);
    });
}
