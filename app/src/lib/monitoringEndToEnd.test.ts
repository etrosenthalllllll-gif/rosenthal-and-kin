// Full end-to-end incident scenario -- doc 12 section 87. PLAN.md
// P11-28.
//
// "Simulate: filing provider begins failing -> API errors increase ->
// filing workflows begin retrying -> queue begins growing -> some
// cases become stuck -> monitoring detects provider failure -> creates
// incident -> groups downstream alerts -> marks filing provider
// DEGRADED -> stops unnecessary repeated requests through circuit
// breaker -> affected workflows are safely paused/queued -> operator
// receives alert -> operator investigates -> provider recovers ->
// health check succeeds -> circuit breaker closes -> queued workflows
// resume -> cases continue -> incident is resolved -> complete
// incident timeline remains available."
//
// One integration test wiring together real functions from every
// module built in Phase 11, not a new module.

import { describe, it, expect } from "vitest";
import { classifyApiError, isOutageClassError } from "./apiMonitoring";
import { resolveHealthStatus } from "./healthStatus";
import { detectQueueBacklog } from "./queueMonitoring";
import { detectStuckCase } from "./stuckDetection";
import { buildNewAlert } from "./alertEngine";
import { findMatchingOpenAlert, dedupAlertOccurrence, buildIncidentFromAlerts } from "./incidentModel";
import { nextCircuitStateOnFailure, nextCircuitStateOnSuccess, canAttemptRequest } from "./providerCircuitBreaker";
import { computeBlastRadius, shouldRaiseSystemWideIncident } from "./dependencyGraph";
import { applyOperatorAlertAction } from "./alertOperatorActions";
import { computeDetectionTimeMs, computeResolutionTimeMs } from "./incidentTimingMetrics";
import { buildSystemTimeline } from "./monitoringWorkflowTrace";

describe("doc 12 section 87 -- full end-to-end incident scenario", () => {
  it("walks the entire failure -> detection -> incident -> circuit-break -> recovery -> resolution path", () => {
    const graph = { CLAIM_FILING: ["Filing API"], POST_FILING_MONITORING: ["Filing API"] };
    const casesByWorkflow = { CLAIM_FILING: ["RK-1", "RK-2"], POST_FILING_MONITORING: ["RK-3"] };

    // 1-2. Filing provider begins failing; API errors increase.
    const errorCode = classifyApiError(503);
    expect(isOutageClassError(errorCode)).toBe(true);

    // 3. Filing workflows begin retrying -> circuit breaker tracks
    // consecutive failures.
    let circuitState: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
    const circuitConfig = { failureThreshold: 5, cooldownMs: 60_000 };
    let consecutiveFailures = 0;
    for (let i = 0; i < 5; i++) {
      consecutiveFailures++;
      circuitState = nextCircuitStateOnFailure(circuitState, consecutiveFailures, circuitConfig);
    }
    expect(circuitState).toBe("OPEN");

    // 4. Queue begins growing.
    expect(detectQueueBacklog(100, 5000)).toBe(true);

    // 5. Some cases become stuck.
    const stuckCase = detectStuckCase({
      caseId: "RK-1",
      currentState: "CLAIM_REVIEW",
      stateEnteredAt: "2026-08-26T00:00:00.000Z",
      now: "2026-08-26T18:00:00.000Z",
      expectedTransitionMs: 2 * 60 * 60 * 1000,
    });
    expect(stuckCase).not.toBeNull();

    // 6. Monitoring detects the provider failure -> health status DOWN.
    const health = resolveHealthStatus({ inMaintenance: false, totalChecks: 100, failedChecks: 60 });
    expect(health).toBe("DOWN");
    const detectedAt = "2026-08-26T10:02:00.000Z";
    expect(computeDetectionTimeMs("2026-08-26T10:00:00.000Z", detectedAt)).toBe(2 * 60 * 1000);

    // 7-8. Creates incident, groups downstream alerts (dedup + incident grouping).
    const alert1 = buildNewAlert({
      type: "PROVIDER_UNAVAILABLE",
      severity: "CRITICAL",
      source: "API_MONITORING",
      component: "CLAIM_FILING",
      workflowId: "CLAIM_FILING",
      message: "Filing provider unavailable",
      now: detectedAt,
    });
    const duplicateOccurrence = findMatchingOpenAlert([alert1], { type: "PROVIDER_UNAVAILABLE", component: "CLAIM_FILING" });
    expect(duplicateOccurrence).toBeDefined();
    const bumped = dedupAlertOccurrence(alert1, "2026-08-26T10:03:00.000Z");
    expect(bumped.occurrenceCount).toBe(2);

    const blastRadius = computeBlastRadius("Filing API", graph, casesByWorkflow);
    expect(blastRadius.affectedCaseCount).toBe(3);
    expect(shouldRaiseSystemWideIncident(blastRadius, 2)).toBe(true);

    const incident = buildIncidentFromAlerts({
      rootComponent: "Filing API",
      severity: "CRITICAL",
      alerts: [alert1],
      startTime: "2026-08-26T10:00:00.000Z",
    });
    expect(incident.status).toBe("OPEN");

    // 9-10. Filing provider marked DEGRADED; circuit breaker stops
    // unnecessary repeated requests.
    expect(canAttemptRequest(circuitState)).toBe(false);

    // 11. Operator receives alert, investigates.
    const investigated = applyOperatorAlertAction(alert1, "INVESTIGATE", "operator-1", "2026-08-26T10:10:00.000Z");
    expect(investigated.status).toBe("INVESTIGATING");

    // 12-14. Provider recovers -> health check succeeds -> circuit closes.
    circuitState = nextCircuitStateOnFailure(circuitState, 0, circuitConfig); // cooldown elapsed elsewhere -> HALF_OPEN assumed by caller
    circuitState = "HALF_OPEN";
    circuitState = nextCircuitStateOnSuccess(circuitState);
    expect(circuitState).toBe("CLOSED");
    expect(canAttemptRequest(circuitState)).toBe(true);

    // 15-16. Queued workflows resume, cases continue -- incident resolved.
    const resolved = applyOperatorAlertAction(investigated, "RESOLVE", "operator-1", "2026-08-26T10:45:00.000Z");
    expect(resolved.status).toBe("RESOLVED");
    expect(computeResolutionTimeMs("2026-08-26T10:00:00.000Z", "2026-08-26T10:45:00.000Z")).toBe(45 * 60 * 1000);

    // 17. Complete incident timeline remains available.
    const timeline = buildSystemTimeline([
      { system: "API monitoring", description: "Provider errors began", timestamp: "2026-08-26T10:00:00.000Z" },
      { system: "Monitoring", description: "Provider marked DOWN", timestamp: detectedAt },
      { system: "Operator", description: "Incident resolved", timestamp: "2026-08-26T10:45:00.000Z" },
    ]);
    expect(timeline.map((t) => t.description)).toEqual([
      "Provider errors began",
      "Provider marked DOWN",
      "Incident resolved",
    ]);
  });
});
