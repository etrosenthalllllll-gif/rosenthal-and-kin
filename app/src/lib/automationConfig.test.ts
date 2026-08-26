import { describe, it, expect } from "vitest";
import { planNextConfigVersion, recordConfigChange } from "./automationConfig";

describe("config versioning", () => {
  it("bumps the version and never edits the prior value in place", () => {
    const current = { key: "outreach.confidenceThreshold", category: "CONFIDENCE_THRESHOLD" as const, value: 95, version: 1 };
    const next = planNextConfigVersion(current, 97);
    expect(next.version).toBe(2);
    expect(next.value).toBe(97);
    expect(current.value).toBe(95);
  });
});

describe("config change auditing", () => {
  it("records a well-formed change with the doc's own worked example", () => {
    const result = recordConfigChange({
      key: "outreach.confidenceThreshold",
      oldValue: 95,
      newValue: 97,
      reason: "Reduce false positives",
      actor: "operator-1",
      timestamp: "2026-08-26T00:00:00.000Z",
      affectedWorkflows: ["OUTREACH_WORKFLOW"],
    });
    expect(result.status).toBe("RECORDED");
  });

  it("rejects a change with no reason", () => {
    const result = recordConfigChange({
      key: "x",
      oldValue: 1,
      newValue: 2,
      reason: "",
      actor: "operator-1",
      timestamp: "2026-08-26T00:00:00.000Z",
    });
    expect(result.status).toBe("REJECTED_MISSING_AUTHORIZATION");
  });

  it("rejects a change with no actor", () => {
    const result = recordConfigChange({
      key: "x",
      oldValue: 1,
      newValue: 2,
      reason: "Reason given",
      actor: "",
      timestamp: "2026-08-26T00:00:00.000Z",
    });
    expect(result.status).toBe("REJECTED_MISSING_AUTHORIZATION");
  });

  it("defaults affectedWorkflows to an empty list when omitted", () => {
    const result = recordConfigChange({
      key: "x",
      oldValue: 1,
      newValue: 2,
      reason: "Reason",
      actor: "operator-1",
      timestamp: "2026-08-26T00:00:00.000Z",
    });
    expect(result.status).toBe("RECORDED");
    if (result.status === "RECORDED") expect(result.change.affectedWorkflows).toEqual([]);
  });
});
