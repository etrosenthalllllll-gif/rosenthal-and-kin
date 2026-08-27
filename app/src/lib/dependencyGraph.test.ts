import { describe, it, expect } from "vitest";
import { findDependentWorkflows, computeBlastRadius, shouldRaiseSystemWideIncident, buildSystemWideAlertSummary } from "./dependencyGraph";

const graph = {
  CLAIM_FILING: ["Verification", "Documents", "Claim preparation", "Filing API", "Database"],
  POST_FILING_MONITORING: ["Filing API", "Database"],
  OUTREACH: ["Email provider"],
};

describe("dependency graph lookup", () => {
  it("matches the doc's own worked example: Filing API down affects the workflows that depend on it", () => {
    const dependents = findDependentWorkflows("Filing API", graph);
    expect([...dependents].sort()).toEqual(["CLAIM_FILING", "POST_FILING_MONITORING"]);
  });

  it("returns nothing for a component no workflow depends on", () => {
    expect(findDependentWorkflows("Nonexistent", graph)).toEqual([]);
  });
});

describe("blast radius computation", () => {
  it("matches the doc's own worked example shape (filing provider outage affects N cases)", () => {
    const blastRadius = computeBlastRadius("Filing API", graph, {
      CLAIM_FILING: ["RK-1", "RK-2"],
      POST_FILING_MONITORING: ["RK-2", "RK-3"],
    });
    expect(blastRadius.affectedCaseCount).toBe(3);
    expect([...blastRadius.affectedCaseIds].sort()).toEqual(["RK-1", "RK-2", "RK-3"]);
  });
});

describe("system-wide incident threshold", () => {
  it("raises a system-wide incident once the blast radius crosses the threshold", () => {
    const blastRadius = computeBlastRadius("Filing API", graph, {
      CLAIM_FILING: Array.from({ length: 15 }, (_, i) => `RK-${i}`),
    });
    expect(shouldRaiseSystemWideIncident(blastRadius)).toBe(true);
  });

  it("does not raise a system-wide incident for a small blast radius", () => {
    const blastRadius = computeBlastRadius("Filing API", graph, { CLAIM_FILING: ["RK-1"] });
    expect(shouldRaiseSystemWideIncident(blastRadius)).toBe(false);
  });
});

describe("system-wide alert summary", () => {
  it("assembles the doc's own summary fields", () => {
    const blastRadius = computeBlastRadius("Filing API", graph, { CLAIM_FILING: ["RK-1", "RK-2"] });
    const summary = buildSystemWideAlertSummary({
      rootComponent: "Filing API",
      blastRadius,
      pausedWorkflowCount: 87,
      queuedWorkflowCount: 55,
    });
    expect(summary.affectedCaseCount).toBe(2);
    expect(summary.pausedWorkflowCount).toBe(87);
  });
});
