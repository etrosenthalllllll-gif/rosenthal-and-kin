import { describe, it, expect } from "vitest";
import {
  resolveHealthStatus,
  buildSystemHealthRecord,
  isFunctionalHealthCheck,
  HEALTH_CHECK_TYPES,
} from "./healthStatus";

describe("health status resolution", () => {
  it("MAINTENANCE always wins over any computed signal", () => {
    expect(resolveHealthStatus({ inMaintenance: true, totalChecks: 100, failedChecks: 99 })).toBe("MAINTENANCE");
  });

  it("is UNKNOWN with zero observed checks -- never guessed HEALTHY", () => {
    expect(resolveHealthStatus({ inMaintenance: false, totalChecks: 0, failedChecks: 0 })).toBe("UNKNOWN");
  });

  it("is HEALTHY under the degraded threshold", () => {
    expect(resolveHealthStatus({ inMaintenance: false, totalChecks: 100, failedChecks: 1 })).toBe("HEALTHY");
  });

  it("is DEGRADED between the two thresholds", () => {
    expect(resolveHealthStatus({ inMaintenance: false, totalChecks: 100, failedChecks: 10 })).toBe("DEGRADED");
  });

  it("is DOWN at or above the down threshold", () => {
    expect(resolveHealthStatus({ inMaintenance: false, totalChecks: 100, failedChecks: 30 })).toBe("DOWN");
  });
});

describe("system health record", () => {
  it("assembles the doc's own field list with guarded rates", () => {
    const record = buildSystemHealthRecord({
      component: "Email provider",
      inMaintenance: false,
      totalChecks: 200,
      failedChecks: 4,
      responseTimeMs: 210,
      now: "2026-08-26T00:00:00.000Z",
    });
    expect(record.status).toBe("HEALTHY");
    expect(record.availabilityPercent).toBe(98);
    expect(record.errorRatePercent).toBe(2);
  });

  it("returns null rates rather than dividing by zero when no checks exist", () => {
    const record = buildSystemHealthRecord({
      component: "Filing provider",
      inMaintenance: false,
      totalChecks: 0,
      failedChecks: 0,
      now: "2026-08-26T00:00:00.000Z",
    });
    expect(record.availabilityPercent).toBeNull();
    expect(record.status).toBe("UNKNOWN");
  });
});

describe("health check types", () => {
  it("classifies FUNCTIONAL and INTEGRATION as the two 'can it actually do its job' checks", () => {
    expect(isFunctionalHealthCheck("FUNCTIONAL")).toBe(true);
    expect(isFunctionalHealthCheck("INTEGRATION")).toBe(true);
    expect(isFunctionalHealthCheck("LIVENESS")).toBe(false);
  });

  it("includes all five doc-listed check types", () => {
    expect(HEALTH_CHECK_TYPES).toEqual(["LIVENESS", "READINESS", "DEPENDENCY", "FUNCTIONAL", "INTEGRATION"]);
  });
});
