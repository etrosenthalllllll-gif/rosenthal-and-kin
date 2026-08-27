import { describe, it, expect } from "vitest";
import { applyOperatorAlertAction, requestAlertSuppression, isExpectedDowntime } from "./alertOperatorActions";
import { buildNewAlert } from "./alertEngine";

const alert = buildNewAlert({
  type: "PROVIDER_UNAVAILABLE",
  severity: "CRITICAL",
  source: "API_MONITORING",
  component: "Filing provider",
  message: "Filing provider unavailable",
  now: "2026-08-26T00:00:00.000Z",
});

describe("operator alert actions", () => {
  it("records who/when/what for every action, never a silent flip", () => {
    const result = applyOperatorAlertAction(alert, "ACKNOWLEDGE", "operator-1", "2026-08-26T00:05:00.000Z", "Looking into it");
    expect(result.status).toBe("ACKNOWLEDGED");
    expect(result.lastAction).toEqual({
      action: "ACKNOWLEDGE",
      operator: "operator-1",
      timestamp: "2026-08-26T00:05:00.000Z",
      notes: "Looking into it",
    });
  });

  it("maps RESOLVE and SUPPRESS to their own terminal statuses", () => {
    expect(applyOperatorAlertAction(alert, "RESOLVE", "operator-1", "t").status).toBe("RESOLVED");
    expect(applyOperatorAlertAction(alert, "SUPPRESS", "operator-1", "t").status).toBe("SUPPRESSED");
  });
});

describe("alert suppression", () => {
  it("suppresses a non-critical alert with a bounded duration", () => {
    const result = requestAlertSuppression("WARNING", { reason: "Known maintenance", durationMs: 2 * 60 * 60 * 1000, operator: "operator-1" }, "2026-08-26T00:00:00.000Z");
    expect(result.status).toBe("SUPPRESSED");
  });

  it("rejects suppression with no reason", () => {
    const result = requestAlertSuppression("WARNING", { reason: "", durationMs: 1000, operator: "operator-1" }, "t");
    expect(result.status).toBe("REJECTED_MISSING_AUTHORIZATION");
  });

  it("never allows an indefinite (zero-duration) suppression of an EMERGENCY alert", () => {
    const result = requestAlertSuppression("EMERGENCY", { reason: "Trust me", durationMs: 0, operator: "operator-1" }, "t");
    expect(result.status).toBe("REJECTED_INDEFINITE_CRITICAL_SUPPRESSION");
  });

  it("allows a bounded-duration suppression even for EMERGENCY", () => {
    const result = requestAlertSuppression("EMERGENCY", { reason: "Planned failover test", durationMs: 60_000, operator: "operator-1" }, "2026-08-26T00:00:00.000Z");
    expect(result.status).toBe("SUPPRESSED");
  });
});

describe("maintenance mode", () => {
  it("treats a component in MAINTENANCE as expected downtime", () => {
    expect(isExpectedDowntime("MAINTENANCE")).toBe(true);
    expect(isExpectedDowntime("NORMAL")).toBe(false);
  });
});
