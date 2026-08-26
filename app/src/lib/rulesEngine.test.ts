import { describe, it, expect } from "vitest";
import { evaluateCondition, evaluateRule, evaluateRuleTable, type Rule, type RuleCondition } from "./rulesEngine";

describe("comparison operators", () => {
  const cases: Array<[RuleCondition, Record<string, unknown>, boolean]> = [
    [{ kind: "comparison", field: "score", operator: ">=", value: 85 }, { score: 90 }, true],
    [{ kind: "comparison", field: "score", operator: ">=", value: 85 }, { score: 80 }, false],
    [{ kind: "comparison", field: "status", operator: "IN", value: ["A", "B"] }, { status: "B" }, true],
    [{ kind: "comparison", field: "status", operator: "NOT IN", value: ["A", "B"] }, { status: "C" }, true],
    [{ kind: "comparison", field: "tags", operator: "CONTAINS", value: "urgent" }, { tags: ["urgent", "x"] }, true],
    [{ kind: "comparison", field: "optOut", operator: "EXISTS" }, { optOut: false }, true],
    [{ kind: "comparison", field: "optOut", operator: "NOT EXISTS" }, {}, true],
    [{ kind: "comparison", field: "amount", operator: "BETWEEN", value: [10, 20] }, { amount: 15 }, true],
    [{ kind: "comparison", field: "amount", operator: "BETWEEN", value: [10, 20] }, { amount: 25 }, false],
    [{ kind: "comparison", field: "email", operator: "MATCHES", value: "^[a-z]+@" }, { email: "abc@x.com" }, true],
  ];

  it.each(cases)("evaluates %j against %j -> %s", (condition, data, expected) => {
    expect(evaluateCondition(condition, data).result).toBe(expected);
  });

  it("fails closed on an unrecognized operator rather than passing", () => {
    const bogus = { kind: "comparison", field: "x", operator: "WEIRD" as never, value: 1 } as RuleCondition;
    expect(evaluateCondition(bogus, { x: 1 }).result).toBe(false);
  });
});

describe("nested logical conditions", () => {
  it("AND requires every child to pass", () => {
    const condition: RuleCondition = {
      kind: "logical",
      operator: "AND",
      conditions: [
        { kind: "comparison", field: "score", operator: ">=", value: 80 },
        { kind: "comparison", field: "confidence", operator: ">=", value: 0.9 },
      ],
    };
    expect(evaluateCondition(condition, { score: 85, confidence: 0.95 }).result).toBe(true);
    expect(evaluateCondition(condition, { score: 85, confidence: 0.5 }).result).toBe(false);
  });

  it("OR requires only one child to pass", () => {
    const condition: RuleCondition = {
      kind: "logical",
      operator: "OR",
      conditions: [
        { kind: "comparison", field: "score", operator: ">=", value: 95 },
        { kind: "comparison", field: "manualOverride", operator: "=", value: true },
      ],
    };
    expect(evaluateCondition(condition, { score: 50, manualOverride: true }).result).toBe(true);
  });

  it("NOT inverts its single child", () => {
    const condition: RuleCondition = {
      kind: "logical",
      operator: "NOT",
      conditions: [{ kind: "comparison", field: "optOut", operator: "=", value: true }],
    };
    expect(evaluateCondition(condition, { optOut: false }).result).toBe(true);
    expect(evaluateCondition(condition, { optOut: true }).result).toBe(false);
  });

  it("supports arbitrarily nested combinations", () => {
    const condition: RuleCondition = {
      kind: "logical",
      operator: "AND",
      conditions: [
        {
          kind: "logical",
          operator: "OR",
          conditions: [
            { kind: "comparison", field: "score", operator: ">=", value: 90 },
            { kind: "comparison", field: "vip", operator: "=", value: true },
          ],
        },
        { kind: "comparison", field: "optOut", operator: "=", value: false },
      ],
    };
    expect(evaluateCondition(condition, { score: 50, vip: true, optOut: false }).result).toBe(true);
    expect(evaluateCondition(condition, { score: 50, vip: true, optOut: true }).result).toBe(false);
  });
});

const outreachRule: Rule = {
  id: "OUTREACH_ELIGIBILITY_v4",
  name: "Outreach eligibility",
  version: 4,
  enabled: true,
  author: "operator-1",
  priority: 10,
  conditions: {
    kind: "logical",
    operator: "AND",
    conditions: [
      { kind: "comparison", field: "lead.score", operator: ">=", value: 80 },
      { kind: "comparison", field: "verification.confidence", operator: ">=", value: 0.9 },
      { kind: "comparison", field: "optOut", operator: "=", value: false },
    ],
  },
  output: { eligible_for_outreach: true },
};

describe("rule evaluation + auditability", () => {
  it("passes and returns the configured output when all conditions hold, using dotted-path fields", () => {
    const record = evaluateRule(
      outreachRule,
      { lead: { score: 85 }, verification: { confidence: 0.94 }, optOut: false },
      "2026-08-26T00:00:00.000Z",
      "automation"
    );
    expect(record.passed).toBe(true);
    expect(record.output).toEqual({ eligible_for_outreach: true });
    expect(record.ruleVersion).toBe(4);
    expect(record.conditionResult.children).toHaveLength(3);
  });

  it("fails (output null) when one condition doesn't hold", () => {
    const record = evaluateRule(
      outreachRule,
      { lead: { score: 85 }, verification: { confidence: 0.5 }, optOut: false },
      "2026-08-26T00:00:00.000Z"
    );
    expect(record.passed).toBe(false);
    expect(record.output).toBeNull();
  });

  it("never passes a disabled rule regardless of the data", () => {
    const record = evaluateRule(
      { ...outreachRule, enabled: false },
      { lead: { score: 100 }, verification: { confidence: 1 }, optOut: false },
      "2026-08-26T00:00:00.000Z"
    );
    expect(record.passed).toBe(false);
  });

  it("never passes a rule outside its effective/expiration window", () => {
    const expired: Rule = { ...outreachRule, expirationDate: "2026-01-01T00:00:00.000Z" };
    const record = evaluateRule(
      expired,
      { lead: { score: 100 }, verification: { confidence: 1 }, optOut: false },
      "2026-08-26T00:00:00.000Z"
    );
    expect(record.passed).toBe(false);
  });
});

describe("rule table evaluation", () => {
  it("orders results by descending priority", () => {
    const low: Rule = { ...outreachRule, id: "low", priority: 1 };
    const high: Rule = { ...outreachRule, id: "high", priority: 99 };
    const results = evaluateRuleTable(
      [low, high],
      { lead: { score: 85 }, verification: { confidence: 0.94 }, optOut: false },
      "2026-08-26T00:00:00.000Z"
    );
    expect(results[0].ruleId).toBe("high");
    expect(results[1].ruleId).toBe("low");
  });
});
