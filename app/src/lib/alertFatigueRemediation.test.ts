import { describe, it, expect } from "vitest";
import {
  evaluateDebouncedSeverity,
  planAutomatedRemediation,
  buildRemediationLogEntry,
  evaluateRemediationLoopProtection,
} from "./alertFatigueRemediation";

describe("debounced alert severity", () => {
  it("does not alert on a single momentary failure", () => {
    expect(evaluateDebouncedSeverity(1000)).toBe("NONE");
  });

  it("matches the doc's own worked example: 5 minutes sustained -> WARNING", () => {
    expect(evaluateDebouncedSeverity(5 * 60 * 1000)).toBe("WARNING");
  });

  it("matches the doc's own worked example: 15 minutes sustained -> CRITICAL", () => {
    expect(evaluateDebouncedSeverity(15 * 60 * 1000)).toBe("CRITICAL");
  });
});

describe("automated remediation planning", () => {
  it("matches the doc's own worked examples for each failure type", () => {
    expect(planAutomatedRemediation("WORKER_CRASH")).toEqual({ action: "AUTO_REMEDIATE", remediation: "RESTART_WORKER" });
    expect(planAutomatedRemediation("QUEUE_STALL")).toEqual({ action: "AUTO_REMEDIATE", remediation: "RESTART_WORKER_POOL" });
    expect(planAutomatedRemediation("CIRCUIT_BREAKER_OPEN")).toEqual({ action: "AUTO_REMEDIATE", remediation: "PAUSE_CIRCUIT_BREAKER" });
  });

  it("has no safe remediation for an unmapped failure type", () => {
    expect(planAutomatedRemediation("UNKNOWN_FAILURE")).toEqual({ action: "NO_SAFE_REMEDIATION" });
  });

  it("never auto-remediates when a caller-supplied risk table marks the action HIGH/CRITICAL", () => {
    const result = planAutomatedRemediation("WORKER_CRASH", undefined, { RESTART_WORKER: "CRITICAL" });
    expect(result).toEqual({ action: "NO_SAFE_REMEDIATION" });
  });
});

describe("remediation logging", () => {
  it("always builds a log entry, never a silent action", () => {
    const entry = buildRemediationLogEntry("QUEUE_STALL", "RESTART_WORKER_POOL", "SUCCESS", "2026-08-26T00:00:00.000Z");
    expect(entry.action).toBe("RESTART_WORKER_POOL");
    expect(entry.result).toBe("SUCCESS");
  });
});

describe("remediation loop protection", () => {
  it("matches the doc's own worked example: max 3/hour", () => {
    expect(evaluateRemediationLoopProtection(2)).toBe("ALLOW");
    expect(evaluateRemediationLoopProtection(3)).toBe("ESCALATE_TO_OPERATOR");
  });
});
