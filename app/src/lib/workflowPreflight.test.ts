import { describe, it, expect } from "vitest";
import { evaluateWorkflowDependencies, evaluatePreFlightCheck, validatePostFlightOutcome, type PreFlightCheckInput } from "./workflowPreflight";

describe("workflow dependency check", () => {
  it("is ready when every dependency is available", () => {
    const result = evaluateWorkflowDependencies(["Document system", "Filing provider"], new Set(["Document system", "Filing provider"]));
    expect(result.ready).toBe(true);
  });

  it("lists every missing dependency, not just the first", () => {
    const result = evaluateWorkflowDependencies(["Document system", "Filing provider", "Rules engine"], new Set(["Document system"]));
    expect(result.ready).toBe(false);
    expect(result.missingDependencies).toEqual(["Filing provider", "Rules engine"]);
  });
});

const readyInput: PreFlightCheckInput = {
  hasRequiredData: true,
  hasRequiredDocuments: true,
  hasRequiredPermissions: true,
  providerAvailable: true,
  caseStateValid: true,
  hasConflictingWorkflow: false,
  withinBudget: true,
};

describe("pre-flight check", () => {
  it("is READY when everything checks out", () => {
    expect(evaluatePreFlightCheck(readyInput)).toEqual({ status: "READY", blockers: [] });
  });

  it("collects every blocker rather than stopping at the first", () => {
    const result = evaluatePreFlightCheck({
      ...readyInput,
      hasRequiredData: false,
      providerAvailable: false,
      hasConflictingWorkflow: true,
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.blockers).toEqual(["MISSING_REQUIRED_DATA", "PROVIDER_UNAVAILABLE", "CONFLICTING_WORKFLOW"]);
  });
});

describe("post-flight validation", () => {
  it("succeeds when every expected key is present in the response", () => {
    const result = validatePostFlightOutcome(["providerMessageId"], { providerMessageId: "msg-1" });
    expect(result.status).toBe("SUCCESS");
  });

  it("fails when the expected outcome is missing, even though nothing threw", () => {
    const result = validatePostFlightOutcome(["providerMessageId"], { httpStatus: 200 });
    expect(result.status).toBe("FAILED_MISSING_EXPECTED_OUTCOME");
    expect(result.missingKeys).toEqual(["providerMessageId"]);
  });
});
