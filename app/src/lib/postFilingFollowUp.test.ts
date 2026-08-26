import { describe, it, expect } from "vitest";
import { planPostFilingFollowUp, type PostFilingFollowUpStopConditions } from "./postFilingFollowUp";

function stopConditions(overrides: Partial<PostFilingFollowUpStopConditions> = {}): PostFilingFollowUpStopConditions {
  return {
    claimantResponded: false,
    documentReceived: false,
    requestSatisfied: false,
    claimClosed: false,
    hasOptedOut: false,
    operatorDisabledAutomation: false,
    authorityProvidedResolution: false,
    deadlineChanged: false,
    caseEscalated: false,
    ...overrides,
  };
}

describe("post-filing follow-up planning", () => {
  it("sends when nothing stops it and it hasn't already been sent", () => {
    const plan = planPostFilingFollowUp({
      trigger: "NO_AUTHORITY_UPDATE",
      stopConditions: stopConditions(),
      alreadySent: false,
    });
    expect(plan).toEqual({ action: "SEND", trigger: "NO_AUTHORITY_UPDATE" });
  });

  it("stops when the claimant has responded, even if the trigger condition still holds", () => {
    const plan = planPostFilingFollowUp({
      trigger: "NO_CLAIMANT_RESPONSE",
      stopConditions: stopConditions({ claimantResponded: true }),
      alreadySent: false,
    });
    expect(plan.action).toBe("STOP");
  });

  it("stops on an opt-out", () => {
    const plan = planPostFilingFollowUp({
      trigger: "NO_AUTHORITY_UPDATE",
      stopConditions: stopConditions({ hasOptedOut: true }),
      alreadySent: false,
    });
    expect(plan.action).toBe("STOP");
  });

  it("never sends a duplicate follow-up for the same trigger", () => {
    const plan = planPostFilingFollowUp({
      trigger: "DOCUMENT_REQUEST_DEADLINE_APPROACHING",
      stopConditions: stopConditions(),
      alreadySent: true,
    });
    expect(plan.action).toBe("ALREADY_SENT");
  });

  it("a stop condition wins even when the follow-up was already sent", () => {
    const plan = planPostFilingFollowUp({
      trigger: "AUTHORITY_PROCESSING_UNUSUALLY_LONG",
      stopConditions: stopConditions({ caseEscalated: true }),
      alreadySent: true,
    });
    expect(plan.action).toBe("STOP");
  });
});
