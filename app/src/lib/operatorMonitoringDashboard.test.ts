import { describe, it, expect } from "vitest";
import { buildTopLevelHealthSummary, sortOperatorQueue, buildAlertDetailView } from "./operatorMonitoringDashboard";

describe("top-level health summary", () => {
  it("matches the doc's own worked example fields", () => {
    const summary = buildTopLevelHealthSummary({
      overallStatus: "DEGRADED",
      criticalCount: 2,
      warningCount: 7,
      stuckCasesCount: 14,
      failedWorkflowsCount: 8,
      queueBacklogCount: 1240,
      providerIssuesCount: 1,
    });
    expect(summary.stuckCasesCount).toBe(14);
    expect(summary.queueBacklogCount).toBe(1240);
  });
});

describe("prioritized operator queue", () => {
  it("sorts by the doc's own 8-level priority ladder", () => {
    const items = [
      { priority: "WARNING" as const, description: "minor" },
      { priority: "SAFETY_FINANCIAL_RISK" as const, description: "critical" },
      { priority: "FILING_ISSUE" as const, description: "filing" },
    ];
    const sorted = sortOperatorQueue(items);
    expect(sorted.map((i) => i.priority)).toEqual(["SAFETY_FINANCIAL_RISK", "FILING_ISSUE", "WARNING"]);
  });
});

describe("alert detail view", () => {
  it("assembles all of the doc's own required fields", () => {
    const view = buildAlertDetailView({
      whatHappened: "Filing provider unavailable",
      when: "2026-08-26T00:00:00.000Z",
      whyFlagged: "5 consecutive API errors",
      affectedComponent: "Filing provider",
      affectedWorkflows: ["CLAIM_FILING"],
      affectedCases: ["RK-1842"],
      recentEvents: ["API_TIMEOUT", "API_TIMEOUT"],
      errors: ["Connection refused"],
      retries: 3,
      relatedAlertTypes: ["QUEUE_BACKLOG_ALERT"],
      likelyRootCause: "Filing provider outage",
      recommendedAction: "Wait for provider recovery",
    });
    expect(view.affectedCases).toEqual(["RK-1842"]);
    expect(view.likelyRootCause).toBe("Filing provider outage");
  });
});
