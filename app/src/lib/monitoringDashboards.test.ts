import { describe, it, expect } from "vitest";
import {
  METRICS_RETENTION_WINDOWS,
  buildPerformanceDashboard,
  buildThroughputDashboard,
  buildAutomationReliabilityDashboard,
} from "./monitoringDashboards";

describe("metrics retention windows", () => {
  it("includes 24h/7d/30d/long-term-trend per the doc", () => {
    expect(METRICS_RETENTION_WINDOWS).toEqual(["24h", "7d", "30d", "LONG_TERM_TREND"]);
  });
});

describe("performance dashboard", () => {
  it("assembles the doc's own stage-by-stage fields", () => {
    const dashboard = buildPerformanceDashboard({
      avgWorkflowDurationMs: 4000,
      p95WorkflowDurationMs: 9000,
      queueProcessingTimeMs: 1200,
      apiLatencyMs: 210,
      aiLatencyMs: 800,
      documentProcessingTimeMs: 3000,
      filingProcessingTimeMs: 5000,
      communicationDeliveryTimeMs: 600,
      caseCycleTimeMs: 86_400_000,
    });
    expect(dashboard.apiLatencyMs).toBe(210);
  });
});

describe("throughput dashboard", () => {
  it("assembles counts tagged with a period", () => {
    const dashboard = buildThroughputDashboard(
      {
        leadsProcessed: 100,
        documentsProcessed: 50,
        aiRequests: 300,
        emailsSent: 80,
        smsSent: 20,
        callsCompleted: 5,
        claimsPrepared: 10,
        claimsFiled: 8,
        paymentsReconciled: 4,
        casesClosed: 2,
      },
      "DAY"
    );
    expect(dashboard.period).toBe("DAY");
    expect(dashboard.leadsProcessed).toBe(100);
  });
});

describe("automation reliability dashboard", () => {
  it("composes automationAnalytics.ts and workflowReconciliation.ts rather than recomputing", () => {
    const dashboard = buildAutomationReliabilityDashboard({
      healthCounts: { jobsExecuted: 1000, jobsCompleted: 980, jobsFailed: 20, jobsRetried: 50 },
      interventionCounts: { totalExecutions: 1000, fullyAutomated: 820, humanAssisted: 150, humanBlocked: 0, failed: 30 },
      slaOutcomes: ["MET", "MET", "BREACHED"],
      duplicatePreventionCount: 12,
      averageRecoveryTimeMs: 45 * 60 * 1000,
    });
    expect(dashboard.successRatePercent).toBe(98);
    expect(dashboard.humanInterventionRatePercent).toBe(15);
    expect(dashboard.slaCompliancePercent).toBeCloseTo(66.7, 0);
    expect(dashboard.duplicatePreventionCount).toBe(12);
  });
});
