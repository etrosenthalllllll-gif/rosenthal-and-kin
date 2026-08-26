import { describe, it, expect } from "vitest";
import {
  takeoverConversation,
  resumeAutomation,
  availableOperatorActions,
  checkRepeatedFailureEscalation,
  createDraftHistory,
  applyOperatorRevision,
  recordFinalSend,
  type ConversationHandlingState,
} from "./humanHandoff";

function state(overrides: Partial<ConversationHandlingState> = {}): ConversationHandlingState {
  return { humanHandling: false, attentionStatus: "AUTOMATED", ...overrides };
}

describe("takeoverConversation / resumeAutomation", () => {
  it("sets humanHandling to true on takeover", () => {
    const result = takeoverConversation(state());
    expect(result.humanHandling).toBe(true);
  });

  it("is idempotent -- taking over an already-human-owned conversation is a no-op, not an error", () => {
    const result = takeoverConversation(takeoverConversation(state()));
    expect(result.humanHandling).toBe(true);
  });

  it("sets humanHandling back to false on resume", () => {
    const result = resumeAutomation(takeoverConversation(state()));
    expect(result.humanHandling).toBe(false);
  });

  it("does not clear attentionStatus on resume -- whatever flagged it needs its own resolution", () => {
    const result = resumeAutomation(
      takeoverConversation(state({ attentionStatus: "EXCEPTION" }))
    );
    expect(result.attentionStatus).toBe("EXCEPTION");
  });
});

describe("availableOperatorActions", () => {
  it("returns no actions when a human doesn't own the conversation", () => {
    expect(availableOperatorActions(state())).toEqual([]);
  });

  it("returns the full doc 04 section 30 action set once a human owns it", () => {
    const actions = availableOperatorActions(state({ humanHandling: true }));
    expect(actions).toContain("REPLY");
    expect(actions).toContain("RESUME_AUTOMATION");
    expect(actions.length).toBe(6);
  });
});

describe("checkRepeatedFailureEscalation", () => {
  it("does not escalate below the default threshold", () => {
    expect(checkRepeatedFailureEscalation(2).shouldEscalate).toBe(false);
  });

  it("escalates at the default threshold of 3", () => {
    const result = checkRepeatedFailureEscalation(3);
    expect(result.shouldEscalate).toBe(true);
    expect(result.reason).toMatch(/3 consecutive/);
  });

  it("respects a custom threshold", () => {
    expect(checkRepeatedFailureEscalation(2, 2).shouldEscalate).toBe(true);
    expect(checkRepeatedFailureEscalation(1, 2).shouldEscalate).toBe(false);
  });
});

describe("draft revision history (doc 04 section 8)", () => {
  it("creates a history record with only the original draft set", () => {
    const history = createDraftHistory("Hi, thanks for reaching out.");
    expect(history.originalAiDraft).toBe("Hi, thanks for reaching out.");
    expect(history.operatorRevision).toBeNull();
    expect(history.finalSentVersion).toBeNull();
  });

  it("never overwrites the original draft when a revision is applied", () => {
    const history = createDraftHistory("original text");
    const revised = applyOperatorRevision(history, "revised text");
    expect(revised.originalAiDraft).toBe("original text");
    expect(revised.operatorRevision).toBe("revised text");
  });

  it("preserves both the original draft and the revision once a final version is sent", () => {
    const history = recordFinalSend(
      applyOperatorRevision(createDraftHistory("original"), "revised"),
      "final sent text"
    );
    expect(history.originalAiDraft).toBe("original");
    expect(history.operatorRevision).toBe("revised");
    expect(history.finalSentVersion).toBe("final sent text");
  });

  it("allows sending the original draft unrevised (finalSentVersion set, operatorRevision stays null)", () => {
    const history = recordFinalSend(createDraftHistory("original"), "original");
    expect(history.operatorRevision).toBeNull();
    expect(history.finalSentVersion).toBe("original");
  });
});
