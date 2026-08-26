import { describe, it, expect } from "vitest";
import {
  canTransitionExecutionStatus,
  assertValidExecutionTransition,
  isTerminalExecutionStatus,
  InvalidExecutionTransitionError,
  planNewWorkflowExecution,
  isKnownWorkflowStepType,
  WORKFLOW_STEP_TYPES,
} from "./workflowExecution";

describe("workflow execution status transitions", () => {
  it("allows QUEUED -> RUNNING", () => {
    expect(canTransitionExecutionStatus("QUEUED", "RUNNING")).toBe(true);
  });

  it("allows a FAILED execution to move to RETRYING (not terminal)", () => {
    expect(canTransitionExecutionStatus("FAILED", "RETRYING")).toBe(true);
    expect(isTerminalExecutionStatus("FAILED")).toBe(false);
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(isTerminalExecutionStatus("COMPLETED")).toBe(true);
    expect(isTerminalExecutionStatus("CANCELLED")).toBe(true);
    expect(canTransitionExecutionStatus("COMPLETED", "RUNNING")).toBe(false);
  });

  it("rejects a no-op transition", () => {
    expect(canTransitionExecutionStatus("RUNNING", "RUNNING")).toBe(false);
  });

  it("throws on an invalid transition", () => {
    expect(() => assertValidExecutionTransition("COMPLETED", "RUNNING")).toThrow(InvalidExecutionTransitionError);
  });

  it("allows RUNNING -> WAITING_FOR_APPROVAL and back to RUNNING after decision", () => {
    expect(canTransitionExecutionStatus("RUNNING", "WAITING_FOR_APPROVAL")).toBe(true);
    expect(canTransitionExecutionStatus("WAITING_FOR_APPROVAL", "RUNNING")).toBe(true);
  });
});

describe("new workflow execution planning", () => {
  it("always starts QUEUED with retryCount 0, pinned to the given version", () => {
    const execution = planNewWorkflowExecution({
      workflowId: "wf-1",
      workflowVersion: 4,
      caseId: "RK-1842",
      correlationId: "corr-1",
    });
    expect(execution.status).toBe("QUEUED");
    expect(execution.retryCount).toBe(0);
    expect(execution.workflowVersion).toBe(4);
  });
});

describe("workflow step type vocabulary", () => {
  it("recognizes every doc-11-listed step type", () => {
    for (const type of WORKFLOW_STEP_TYPES) {
      expect(isKnownWorkflowStepType(type)).toBe(true);
    }
  });

  it("rejects an unrecognized step type", () => {
    expect(isKnownWorkflowStepType("TELEPORT")).toBe(false);
  });
});
