import { describe, it, expect } from "vitest";
import {
  buildWorkflowTrace,
  buildExecutionLogEntry,
  sortByExceptionPriority,
  type AutomationErrorRow,
} from "./automationObservability";

describe("workflow trace", () => {
  it("sorts out-of-order events into a chronological trace", () => {
    const trace = buildWorkflowTrace([
      { eventType: "SCORING_COMPLETED", timestamp: "2026-08-26T00:02:00.000Z" },
      { eventType: "CASE_CREATED", timestamp: "2026-08-26T00:00:00.000Z" },
      { eventType: "RESEARCH_STARTED", timestamp: "2026-08-26T00:01:00.000Z" },
    ]);
    expect(trace.map((t) => t.label)).toEqual(["CASE_CREATED", "RESEARCH_STARTED", "SCORING_COMPLETED"]);
  });
});

describe("execution log entry", () => {
  it("stores references, not raw payloads, and defaults retryCount to 0", () => {
    const entry = buildExecutionLogEntry({
      executionId: "exec-1",
      step: "SEND_EMAIL",
      startTime: "2026-08-26T00:00:00.000Z",
      status: "COMPLETED",
      inputRef: "doc-ref-1",
      outputRef: "doc-ref-2",
      actor: "automation",
      workflowVersion: 3,
    });
    expect(entry.inputRef).toBe("doc-ref-1");
    expect(entry.retryCount).toBe(0);
  });
});

describe("exception-first ordering", () => {
  const row = (category: AutomationErrorRow["category"]): AutomationErrorRow => ({
    workflow: "wf",
    step: "s",
    errorType: "x",
    category,
    attempts: 1,
    lastAttempt: "2026-08-26T00:00:00.000Z",
    status: "OPEN",
  });

  it("orders critical failures before everything else", () => {
    const rows = [row("SYNC_PROBLEM"), row("CRITICAL_FAILURE"), row("OTHER")];
    expect(sortByExceptionPriority(rows).map((r) => r.category)).toEqual(["CRITICAL_FAILURE", "SYNC_PROBLEM", "OTHER"]);
  });

  it("follows the doc's own full priority ladder", () => {
    const rows = [
      row("OTHER"),
      row("SYNC_PROBLEM"),
      row("PROVIDER_FAILURE"),
      row("DEADLINE_ISSUE"),
      row("LOW_CONFIDENCE"),
      row("CONFLICTING_DATA"),
      row("HUMAN_APPROVAL"),
      row("CRITICAL_FAILURE"),
    ];
    expect(sortByExceptionPriority(rows).map((r) => r.category)).toEqual([
      "CRITICAL_FAILURE",
      "HUMAN_APPROVAL",
      "CONFLICTING_DATA",
      "LOW_CONFIDENCE",
      "DEADLINE_ISSUE",
      "PROVIDER_FAILURE",
      "SYNC_PROBLEM",
      "OTHER",
    ]);
  });
});
