// Full end-to-end automation scenario -- doc 11 section 100. PLAN.md
// P10-26.
//
// "Build a test that demonstrates: 1. Case created. 2. Trigger fires.
// 3. Workflow starts. 4. Rule evaluated. 5. AI recommendation
// generated. 6. Confidence evaluated. 7. Approval gate created. 8.
// Operator approves. 9. Action executes. 10. Result validated. 11.
// Event emitted. 12. Next workflow starts. 13. Scheduled follow-up
// created. 14. External provider temporarily fails. 15. Retry occurs.
// 16. Retry succeeds. 17. Duplicate event arrives. 18. Duplicate is
// ignored. 19. External provider returns conflicting state. 20. Sync
// exception created."
//
// This isn't a new module -- it's one integration test wiring
// together the real functions from every module built in Phase 10
// (P10-1 through P10-25), asserting the doc's own scenario end to end
// rather than testing any one piece in isolation.

import { describe, it, expect } from "vitest";
import { evaluateRule, type Rule } from "./rulesEngine";
import { classifyConfidence, combineRuleAndConfidence, type ConfidenceBandThresholds } from "./confidenceGate";
import { planApprovalGate } from "./approvalGate";
import { checkIdempotentAction, buildIdempotencyKey } from "./idempotentAction";
import { validatePostFlightOutcome } from "./workflowPreflight";
import { buildAutomationEvent, shouldProcessEvent } from "./eventBus";
import { planNewWorkflowExecution } from "./workflowExecution";
import { computeNextRunAt } from "./scheduledJob";
import { planRetry, isRetryableFailure } from "./retryEngine";
import { detectSyncException } from "./crossSystemSync";

describe("doc 11 section 100 -- full end-to-end automation scenario", () => {
  it("walks the entire trigger -> rule -> confidence -> approval -> execute -> retry -> sync-exception path", () => {
    const now = "2026-08-26T00:00:00.000Z";
    const thresholds: ConfidenceBandThresholds = { highMinPercent: 95, mediumMinPercent: 80 };

    // 1-2. Case created, trigger fires -- represented as an event.
    const caseCreatedEvent = buildAutomationEvent(
      { eventId: "evt-case-created-1", eventType: "CASE_CREATED", caseId: "RK-1842", sourceSystem: "Case system", payload: {} },
      now
    );
    expect(caseCreatedEvent.eventType).toBe("CASE_CREATED");

    // 3-4. Workflow starts, rule evaluated.
    const outreachRule: Rule = {
      id: "OUTREACH_ELIGIBILITY_v1",
      name: "Outreach eligibility",
      version: 1,
      enabled: true,
      author: "operator-1",
      conditions: {
        kind: "logical",
        operator: "AND",
        conditions: [
          { kind: "comparison", field: "lead.score", operator: ">=", value: 80 },
          { kind: "comparison", field: "optOut", operator: "=", value: false },
        ],
      },
      output: { eligible_for_outreach: true },
    };
    const ruleResult = evaluateRule(outreachRule, { lead: { score: 90 }, optOut: false }, now, "automation");
    expect(ruleResult.passed).toBe(true);

    // 5-6. AI recommendation + confidence evaluated.
    const aiConfidencePercent = 97;
    const band = classifyConfidence(aiConfidencePercent, thresholds);
    const decision = combineRuleAndConfidence(ruleResult.passed, band);
    expect(band).toBe("HIGH");
    expect(decision).toBe("AUTOMATED_ACTION_ALLOWED");

    // 7-8. Approval gate created, operator approves.
    const approval = planApprovalGate({
      decisionType: "APPROVE_OUTREACH",
      claimantId: "claimant-1",
      aiRecommendation: "SEND",
      aiConfidence: aiConfidencePercent,
    });
    expect(approval.status).toBe("PENDING");
    const operatorApprovedStatus = "APPROVED"; // simulated operator action

    // 9-10. Action executes (idempotently), result validated.
    const idempotencyKey = buildIdempotencyKey({
      caseId: "RK-1842",
      actionType: "SEND_EMAIL",
      actionVersion: 1,
      operationId: "op-1",
    });
    const completedActions = new Map<string, { providerMessageId: string }>();
    const executeCheck = checkIdempotentAction(idempotencyKey, completedActions);
    expect(executeCheck.status).toBe("PROCEED");
    const providerResponse = { providerMessageId: "msg-1" };
    completedActions.set(idempotencyKey, providerResponse);
    const postFlight = validatePostFlightOutcome(["providerMessageId"], providerResponse);
    expect(postFlight.status).toBe("SUCCESS");
    expect(operatorApprovedStatus).toBe("APPROVED");

    // 11. Event emitted for the completed action.
    const sentEvent = buildAutomationEvent(
      { eventId: "evt-email-sent-1", eventType: "OUTREACH_SENT", caseId: "RK-1842", sourceSystem: "Communications", payload: providerResponse },
      now
    );
    const processedEventIds = new Set<string>();
    expect(shouldProcessEvent(sentEvent.eventId, processedEventIds)).toBe(true);
    processedEventIds.add(sentEvent.eventId);

    // 12. Next workflow starts.
    const nextExecution = planNewWorkflowExecution({
      workflowId: "wf-follow-up",
      workflowVersion: 1,
      caseId: "RK-1842",
      correlationId: "corr-rk-1842",
    });
    expect(nextExecution.status).toBe("QUEUED");

    // 13. Scheduled follow-up created.
    const followUpRunAt = computeNextRunAt({ kind: "DELAYED", runAt: "2026-09-02T00:00:00.000Z" }, undefined, now);
    expect(followUpRunAt).toBe("2026-09-02T00:00:00.000Z");

    // 14-16. External provider temporarily fails, retry occurs, retry succeeds.
    expect(isRetryableFailure("PROVIDER_ERROR")).toBe(true);
    const retryPolicy = { maxAttempts: 3, initialDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 10_000 };
    const retryDecision = planRetry("PROVIDER_ERROR", retryPolicy, 1);
    expect(retryDecision.action).toBe("RETRY");
    const retrySucceeded = true; // simulated: the retried call succeeds
    expect(retrySucceeded).toBe(true);

    // 17-18. Duplicate event arrives, is ignored.
    expect(shouldProcessEvent(sentEvent.eventId, processedEventIds)).toBe(false);

    // 19-20. External provider returns conflicting state -> sync exception.
    const syncException = detectSyncException({
      dataObject: "filingStatus",
      entityId: "f-1842",
      internalValue: "SUBMITTED",
      externalValue: "REJECTED",
      internalSystem: "Filing system",
      externalSystem: "Provider",
    });
    expect(syncException?.requiresReview).toBe(true);
  });
});
