import { describe, it, expect } from "vitest";
import { findMatchingOpenAlert, dedupAlertOccurrence, buildIncidentFromAlerts, isLikelyCascadeAlert } from "./incidentModel";
import { buildNewAlert, type Alert } from "./alertEngine";

const baseAlert: Alert = buildNewAlert({
  type: "PROVIDER_UNAVAILABLE",
  severity: "CRITICAL",
  source: "API_MONITORING",
  component: "Email provider",
  message: "Email provider unavailable",
  now: "2026-08-26T00:00:00.000Z",
});

describe("alert dedup", () => {
  it("finds an existing open alert with the same type+component", () => {
    const match = findMatchingOpenAlert([baseAlert], { type: "PROVIDER_UNAVAILABLE", component: "Email provider" });
    expect(match).toBeDefined();
  });

  it("does not match an alert for a different component", () => {
    const match = findMatchingOpenAlert([baseAlert], { type: "PROVIDER_UNAVAILABLE", component: "SMS provider" });
    expect(match).toBeUndefined();
  });

  it("bumps occurrenceCount instead of creating a duplicate", () => {
    const bumped = dedupAlertOccurrence(baseAlert, "2026-08-26T00:05:00.000Z");
    expect(bumped.occurrenceCount).toBe(2);
    expect(bumped.lastDetected).toBe("2026-08-26T00:05:00.000Z");
  });
});

describe("incident construction from correlated alerts", () => {
  it("matches the doc's own worked example: one incident groups every affected system", () => {
    const smsAlert = buildNewAlert({ type: "PROVIDER_DOWN", severity: "CRITICAL", source: "COMMUNICATION_FAILURE", component: "SMS workflow", workflowId: "wf-sms", message: "SMS provider outage", now: "t" });
    const followUpAlert = buildNewAlert({ type: "PROVIDER_DOWN", severity: "CRITICAL", source: "COMMUNICATION_FAILURE", component: "Follow-up workflow", workflowId: "wf-followup", message: "SMS provider outage", now: "t" });
    const incident = buildIncidentFromAlerts({
      rootComponent: "SMS provider",
      severity: "CRITICAL",
      alerts: [smsAlert, followUpAlert],
      startTime: "2026-08-26T00:00:00.000Z",
    });
    expect(incident.affectedSystems).toEqual(["SMS workflow", "Follow-up workflow"]);
    expect(incident.affectedWorkflows).toEqual(["wf-sms", "wf-followup"]);
    expect(incident.status).toBe("OPEN");
  });
});

describe("cascade correlation window", () => {
  it("treats a downstream alert within the cascade window as related", () => {
    expect(isLikelyCascadeAlert("2026-08-26T00:00:00.000Z", "2026-08-26T00:02:00.000Z", 5 * 60 * 1000)).toBe(true);
  });

  it("treats a downstream alert outside the window as unrelated", () => {
    expect(isLikelyCascadeAlert("2026-08-26T00:00:00.000Z", "2026-08-26T01:00:00.000Z", 5 * 60 * 1000)).toBe(false);
  });

  it("treats an alert detected before the root as unrelated", () => {
    expect(isLikelyCascadeAlert("2026-08-26T00:05:00.000Z", "2026-08-26T00:00:00.000Z", 5 * 60 * 1000)).toBe(false);
  });
});
