import { describe, it, expect } from "vitest";
import { buildMonitoringCenterView } from "./monitoringCenter";

describe("monitoring center view assembly", () => {
  it("matches the doc's own final mockup shape", () => {
    const view = buildMonitoringCenterView({
      systemHealth: [
        { component: "Filing", status: "DEGRADED", failureCount: 5, failureRatePercent: 5, errorRatePercent: 5, availabilityPercent: 95, lastUpdated: "t" },
      ],
      topLevelSummary: {
        overallStatus: "DEGRADED",
        criticalCount: 2,
        warningCount: 7,
        stuckCasesCount: 14,
        failedWorkflowsCount: 8,
        queueBacklogCount: 1240,
        providerIssuesCount: 1,
      },
      activeIncidents: [{ severity: "CRITICAL", description: "Filing provider degraded", affectedCases: 37, affectedWorkflows: 21 }],
      attentionRequired: { failedWorkflows: 8, stuckCases: 14, syncConflicts: 3, pendingCriticalApprovals: 5 },
      queues: [{ queueName: "Filing", depth: 240 }],
      systemMetrics: {
        automationSuccessRatePercent: 98.4,
        apiSuccessRatePercent: 99.2,
        queueProcessingPerHour: 1240,
        aiSuccessRatePercent: 99.1,
        slaCompliancePercent: 97.8,
      },
    });
    expect(view.activeIncidents[0].affectedCases).toBe(37);
    expect(view.systemMetrics.automationSuccessRatePercent).toBe(98.4);
  });
});
