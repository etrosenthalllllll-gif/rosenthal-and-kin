import { describe, it, expect } from "vitest";
import {
  sortByAutomationPriority,
  isWithinResourceLimit,
  evaluateRateLimit,
  evaluateCostLimit,
  evaluateAutomationBudget,
} from "./automationLimits";

describe("automation priority ordering", () => {
  it("sorts CRITICAL first, LOW last", () => {
    const items = [{ id: "a", priority: "LOW" as const }, { id: "b", priority: "CRITICAL" as const }, { id: "c", priority: "NORMAL" as const }];
    expect(sortByAutomationPriority(items).map((i) => i.id)).toEqual(["b", "c", "a"]);
  });
});

describe("resource limits", () => {
  it("is within limit when usage is below the configured ceiling", () => {
    expect(isWithinResourceLimit("API_CALLS", 5, { API_CALLS: 10 })).toBe(true);
  });

  it("is not within limit once usage reaches the ceiling", () => {
    expect(isWithinResourceLimit("API_CALLS", 10, { API_CALLS: 10 })).toBe(false);
  });

  it("treats an unconfigured resource kind as unlimited", () => {
    expect(isWithinResourceLimit("VOICE_CALLS", 1_000_000, {})).toBe(true);
  });
});

describe("rate limiting", () => {
  const window = { maxRequests: 3, windowMs: 60_000 };

  it("allows a request when under the window's max", () => {
    expect(evaluateRateLimit(window, [1000, 2000], 5000)).toBe("ALLOWED");
  });

  it("rate-limits once the window's max is reached", () => {
    expect(evaluateRateLimit(window, [1000, 2000, 3000], 5000)).toBe("RATE_LIMITED");
  });

  it("ignores requests older than the window", () => {
    expect(evaluateRateLimit(window, [1000, 2000, 3000], 100_000)).toBe("ALLOWED");
  });
});

describe("cost limits", () => {
  it("pauses and requests review once spend reaches the limit", () => {
    expect(evaluateCostLimit(500, 500)).toBe("PAUSE_AND_REQUEST_REVIEW");
  });

  it("stays within limit below the ceiling", () => {
    expect(evaluateCostLimit(499, 500)).toBe("WITHIN_LIMIT");
  });
});

describe("per-case automation budgets", () => {
  it("returns no exceptions when every category is under budget", () => {
    const exceptions = evaluateAutomationBudget(
      { aiBudgetCents: 1000, communicationBudgetCents: 500, researchBudgetCents: 200 },
      { aiSpentCents: 900, communicationSpentCents: 100, researchSpentCents: 50 }
    );
    expect(exceptions).toEqual([]);
  });

  it("reports every over-budget category independently, not just the first", () => {
    const exceptions = evaluateAutomationBudget(
      { aiBudgetCents: 1000, researchBudgetCents: 200 },
      { aiSpentCents: 1000, communicationSpentCents: 0, researchSpentCents: 250 }
    );
    expect(exceptions.map((e) => e.category)).toEqual(["AI", "RESEARCH"]);
  });

  it("never flags a category with no configured budget", () => {
    const exceptions = evaluateAutomationBudget({}, { aiSpentCents: 1_000_000, communicationSpentCents: 0, researchSpentCents: 0 });
    expect(exceptions).toEqual([]);
  });
});
