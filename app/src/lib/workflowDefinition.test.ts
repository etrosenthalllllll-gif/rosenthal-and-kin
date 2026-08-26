import { describe, it, expect } from "vitest";
import {
  canTransitionWorkflowStatus,
  assertValidWorkflowTransition,
  isTerminalWorkflowStatus,
  InvalidWorkflowTransitionError,
  planNextWorkflowVersion,
  validateWorkflowDefinition,
  resolveExecutionVersion,
  type WorkflowDefinitionInput,
} from "./workflowDefinition";

describe("workflow status transitions", () => {
  it("allows DRAFT -> ACTIVE", () => {
    expect(canTransitionWorkflowStatus("DRAFT", "ACTIVE")).toBe(true);
  });

  it("allows ACTIVE -> PAUSED -> ACTIVE (reversible pause)", () => {
    expect(canTransitionWorkflowStatus("ACTIVE", "PAUSED")).toBe(true);
    expect(canTransitionWorkflowStatus("PAUSED", "ACTIVE")).toBe(true);
  });

  it("rejects a transition out of the terminal ARCHIVED state", () => {
    expect(canTransitionWorkflowStatus("ARCHIVED", "ACTIVE")).toBe(false);
    expect(isTerminalWorkflowStatus("ARCHIVED")).toBe(true);
  });

  it("rejects a no-op transition", () => {
    expect(canTransitionWorkflowStatus("ACTIVE", "ACTIVE")).toBe(false);
  });

  it("throws InvalidWorkflowTransitionError on an invalid transition", () => {
    expect(() => assertValidWorkflowTransition("ARCHIVED", "DRAFT")).toThrow(InvalidWorkflowTransitionError);
  });
});

const baseDefinition: WorkflowDefinitionInput = {
  name: "Lead Outreach Workflow",
  triggerType: "LEAD_CREATED",
  steps: [
    { stepId: "score", type: "AI_ANALYSIS" },
    { stepId: "draft", type: "EMAIL" },
    { stepId: "done", type: "END" },
  ],
};

describe("workflow versioning", () => {
  it("plans the next version as currentVersion + 1, never overwriting the prior version", () => {
    const next = planNextWorkflowVersion({
      workflowId: "wf-1",
      currentVersion: 1,
      definition: baseDefinition,
      author: "operator-1",
      reason: "Add a follow-up step",
      now: "2026-08-26T00:00:00.000Z",
    });
    expect(next.version).toBe(2);
    expect(next.workflowId).toBe("wf-1");
    expect(next.triggerType).toBe("LEAD_CREATED");
  });

  it("pins execution to the workflow's currentVersion at start time", () => {
    expect(resolveExecutionVersion({ currentVersion: 3 })).toBe(3);
  });
});

describe("workflow definition structural validation", () => {
  it("passes a well-formed definition with no issues", () => {
    expect(validateWorkflowDefinition(baseDefinition)).toEqual([]);
  });

  it("flags a definition with zero steps", () => {
    const issues = validateWorkflowDefinition({ ...baseDefinition, steps: [] });
    expect(issues.map((i) => i.code)).toContain("NO_STEPS");
  });

  it("flags duplicate step ids", () => {
    const issues = validateWorkflowDefinition({
      ...baseDefinition,
      steps: [
        { stepId: "score", type: "AI_ANALYSIS" },
        { stepId: "score", type: "EMAIL" },
        { stepId: "done", type: "END" },
      ],
    });
    expect(issues.map((i) => i.code)).toContain("DUPLICATE_STEP_ID");
  });

  it("flags a missing trigger type", () => {
    const issues = validateWorkflowDefinition({ ...baseDefinition, triggerType: "" });
    expect(issues.map((i) => i.code)).toContain("NO_TRIGGER_TYPE");
  });

  it("flags a definition with no terminating END step", () => {
    const issues = validateWorkflowDefinition({
      ...baseDefinition,
      steps: [{ stepId: "score", type: "AI_ANALYSIS" }],
    });
    expect(issues.map((i) => i.code)).toContain("MISSING_END_STEP");
  });
});
