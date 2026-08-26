import { describe, it, expect } from "vitest";
import {
  decideAutomationAction,
  type AutomationRuleInput,
} from "./communicationAutomationRules";
import type { ClassificationResult } from "./communicationClassification";
import type { PersonCommunicationPreferences } from "./communicationPreferences";

function prefs(overrides: Partial<PersonCommunicationPreferences> = {}): PersonCommunicationPreferences {
  return {
    emailAllowed: true,
    smsAllowed: true,
    voiceAllowed: true,
    mailAllowed: true,
    doNotContact: false,
    ...overrides,
  };
}

function classification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return { category: "INTERESTED", confidence: 0.95, modelVersion: "test-v1", ...overrides };
}

function input(overrides: Partial<AutomationRuleInput> = {}): AutomationRuleInput {
  return {
    classification: classification(),
    preferences: prefs(),
    channel: "EMAIL",
    humanHandling: false,
    ...overrides,
  };
}

describe("decideAutomationAction", () => {
  it("responds automatically for a high-confidence routine classification with no opt-out", () => {
    const decision = decideAutomationAction(input());
    expect(decision.action).toBe("RESPOND_AUTOMATICALLY");
  });

  it("does nothing when a human already owns the conversation, even for an otherwise-automatable message", () => {
    const decision = decideAutomationAction(input({ humanHandling: true }));
    expect(decision.action).toBe("DO_NOTHING");
  });

  it("takes DO_NOTHING precedence over everything else, including an opt-out signal", () => {
    const decision = decideAutomationAction(
      input({ humanHandling: true, classification: classification({ category: "DO_NOT_CONTACT" }) })
    );
    expect(decision.action).toBe("DO_NOTHING");
  });

  it("processes DO_NOT_CONTACT as an automated stop, not a human decision", () => {
    const decision = decideAutomationAction(
      input({ classification: classification({ category: "DO_NOT_CONTACT", confidence: 0.9 }) })
    );
    expect(decision.action).toBe("STOP_COMMUNICATIONS");
  });

  it("processes UNSUBSCRIBE as an automated stop as well", () => {
    const decision = decideAutomationAction(
      input({ classification: classification({ category: "UNSUBSCRIBE", confidence: 0.9 }) })
    );
    expect(decision.action).toBe("STOP_COMMUNICATIONS");
  });

  it("creates a decision when the classifier requires human review (e.g. LEGAL_QUESTION)", () => {
    const decision = decideAutomationAction(
      input({ classification: classification({ category: "LEGAL_QUESTION", confidence: 0.99 }) })
    );
    expect(decision.action).toBe("CREATE_DECISION");
  });

  it("creates a decision when confidence is below the category's threshold", () => {
    const decision = decideAutomationAction(input({ classification: classification({ confidence: 0.2 }) }));
    expect(decision.action).toBe("CREATE_DECISION");
  });

  it("escalates rather than sending when classification allows automation but the channel is opted out", () => {
    const decision = decideAutomationAction(
      input({ preferences: prefs({ emailAllowed: false }) })
    );
    expect(decision.action).toBe("ESCALATE");
  });

  it("escalates rather than sending when doNotContact is set even though classification allows automation", () => {
    const decision = decideAutomationAction(input({ preferences: prefs({ doNotContact: true }) }));
    expect(decision.action).toBe("ESCALATE");
  });

  it("never sends an automated response on a channel that's blocked, regardless of classification confidence", () => {
    const decision = decideAutomationAction(
      input({
        classification: classification({ confidence: 1.0 }),
        preferences: prefs({ smsAllowed: false }),
        channel: "SMS",
      })
    );
    expect(decision.action).not.toBe("RESPOND_AUTOMATICALLY");
  });
});
