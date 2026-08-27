import { describe, it, expect } from "vitest";
import { buildNewAlert, resolveAlertSeverity } from "./alertEngine";

describe("building a new alert", () => {
  it("always starts OPEN with occurrenceCount 1", () => {
    const alert = buildNewAlert({
      type: "PROVIDER_UNAVAILABLE",
      severity: "CRITICAL",
      source: "API_MONITORING",
      component: "Filing provider",
      message: "Filing provider is unavailable",
      now: "2026-08-26T00:00:00.000Z",
    });
    expect(alert.status).toBe("OPEN");
    expect(alert.occurrenceCount).toBe(1);
    expect(alert.firstDetected).toBe(alert.lastDetected);
  });
});

describe("configurable severity resolution", () => {
  it("matches the doc's own worked examples", () => {
    expect(resolveAlertSeverity("SINGLE_FAILED_REQUEST")).toBe("INFO");
    expect(resolveAlertSeverity("REPEATED_PROVIDER_FAILURE")).toBe("ERROR");
    expect(resolveAlertSeverity("PROVIDER_UNAVAILABLE")).toBe("CRITICAL");
    expect(resolveAlertSeverity("DUPLICATE_FINANCIAL_ACTION_SUSPECTED")).toBe("EMERGENCY");
  });

  it("defaults an unconfigured alert type to WARNING, not silently INFO", () => {
    expect(resolveAlertSeverity("SOMETHING_NEW")).toBe("WARNING");
  });
});
