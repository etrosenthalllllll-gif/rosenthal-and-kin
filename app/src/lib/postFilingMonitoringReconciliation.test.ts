import { describe, it, expect } from "vitest";
import {
  reconcilePostFilingCaseStatus,
  classifyMonitoringCheckOutcome,
  shouldEscalateMonitoringFailure,
  computeBackoffDelayMinutes,
} from "./postFilingMonitoringReconciliation";

describe("post-filing status reconciliation (reuses filingTrackingReconciliation.ts)", () => {
  it("reports MATCH when internal and external state agree", () => {
    expect(reconcilePostFilingCaseStatus("PROCESSING", "PROCESSING").outcome).toBe("MATCH");
  });

  it("reports MISMATCH rather than assuming agreement", () => {
    expect(reconcilePostFilingCaseStatus("PROCESSING", "ADDITIONAL_INFORMATION_REQUIRED").outcome).toBe("MISMATCH");
  });
});

describe("monitoring check outcome classification", () => {
  it("is CHECKED on success", () => {
    expect(classifyMonitoringCheckOutcome(true)).toBe("CHECKED");
  });

  it("is PROVIDER_UNAVAILABLE on failure -- never silently treated as unchanged", () => {
    expect(classifyMonitoringCheckOutcome(false)).toBe("PROVIDER_UNAVAILABLE");
  });
});

describe("monitoring failure escalation", () => {
  it("does not escalate below the configured threshold", () => {
    expect(shouldEscalateMonitoringFailure({ consecutiveFailureCount: 2, failureThreshold: 3 })).toBe(false);
  });

  it("escalates once the threshold is reached", () => {
    expect(shouldEscalateMonitoringFailure({ consecutiveFailureCount: 3, failureThreshold: 3 })).toBe(true);
  });
});

describe("backoff delay computation", () => {
  it("doubles the delay with each attempt", () => {
    expect(computeBackoffDelayMinutes(0, 5, 240)).toBe(5);
    expect(computeBackoffDelayMinutes(1, 5, 240)).toBe(10);
    expect(computeBackoffDelayMinutes(2, 5, 240)).toBe(20);
  });

  it("caps the delay at the configured maximum -- never hammers the external system", () => {
    expect(computeBackoffDelayMinutes(10, 5, 240)).toBe(240);
  });
});
