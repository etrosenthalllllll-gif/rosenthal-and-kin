import { describe, it, expect } from "vitest";
import {
  scoreCandidate,
  matchConversationToCase,
  type CaseMatchCandidate,
  type IncomingCommunicationSignals,
} from "./matchConversationToCase";

function candidate(overrides: Partial<CaseMatchCandidate> = {}): CaseMatchCandidate {
  return {
    claimantId: "claimant-1842",
    caseNumber: "RK-1842",
    personEmail: "jane@example.com",
    personPhone: "555-123-4567",
    personName: "Jane Smith",
    priorProviderThreadIds: ["thread-abc"],
    ...overrides,
  };
}

describe("scoreCandidate", () => {
  it("scores every matching signal from doc 04's own example (thread + email + name + phone)", () => {
    const signals: IncomingCommunicationSignals = {
      fromEmail: "jane@example.com",
      fromPhone: "555-123-4567",
      providerThreadId: "thread-abc",
      rawSenderName: "Jane Smith",
      text: "Yes I'm interested",
    };
    const score = scoreCandidate(signals, candidate());
    expect(score.confidence).toBeGreaterThanOrEqual(0.9);
    expect(score.reasons.length).toBe(4);
  });

  it("matches email case-insensitively", () => {
    const score = scoreCandidate({ fromEmail: "JANE@EXAMPLE.COM" }, candidate());
    expect(score.reasons).toContain("Email matches known claimant");
  });

  it("matches phone regardless of formatting", () => {
    const score = scoreCandidate({ fromPhone: "(555) 123-4567" }, candidate());
    expect(score.reasons).toContain("Phone matches known claimant");
  });

  it("matches an explicit case-number reference in the message text", () => {
    const score = scoreCandidate({ text: "Re: Estate RK-1842, question about documents" }, candidate());
    expect(score.reasons.some((r) => r.includes("RK-1842"))).toBe(true);
  });

  it("caps confidence at 1.0 even if every signal matches", () => {
    const signals: IncomingCommunicationSignals = {
      fromEmail: "jane@example.com",
      fromPhone: "555-123-4567",
      providerThreadId: "thread-abc",
      rawSenderName: "Jane Smith",
      text: "RK-1842",
    };
    const score = scoreCandidate(signals, candidate());
    expect(score.confidence).toBeLessThanOrEqual(1);
  });

  it("scores zero when nothing matches", () => {
    const score = scoreCandidate({ fromEmail: "nobody@nowhere.com" }, candidate());
    expect(score.confidence).toBe(0);
    expect(score.reasons).toEqual([]);
  });
});

describe("matchConversationToCase", () => {
  it("auto-attaches a single clearly-leading high-confidence match", () => {
    const signals: IncomingCommunicationSignals = {
      fromEmail: "jane@example.com",
      providerThreadId: "thread-abc",
      rawSenderName: "Jane Smith",
    };
    const result = matchConversationToCase(signals, [candidate()]);
    expect(result.outcome).toBe("AUTO_ATTACH");
    if (result.outcome === "AUTO_ATTACH") {
      expect(result.match.claimantId).toBe("claimant-1842");
    }
  });

  it("does not guess: two candidates both clearing the threshold become AMBIGUOUS, not an auto-attach to either (doc 04's own RK-1842/RK-1917 example)", () => {
    const signals: IncomingCommunicationSignals = {
      fromEmail: "jane@example.com",
      providerThreadId: "thread-abc",
      rawSenderName: "Jane Smith",
      fromPhone: "555-123-4567",
    };
    const candidates = [
      candidate({ claimantId: "claimant-1842", caseNumber: "RK-1842" }),
      candidate({
        claimantId: "claimant-1917",
        caseNumber: "RK-1917",
        priorProviderThreadIds: ["thread-abc"], // shared thread -- genuinely ambiguous
      }),
    ];
    const result = matchConversationToCase(signals, candidates);
    expect(result.outcome).toBe("AMBIGUOUS");
    if (result.outcome === "AMBIGUOUS") {
      expect(result.candidates.map((c) => c.claimantId).sort()).toEqual([
        "claimant-1842",
        "claimant-1917",
      ]);
    }
  });

  it("returns AMBIGUOUS for a mid-confidence match (above the ambiguous floor, below auto-attach) rather than auto-attaching", () => {
    const result = matchConversationToCase(
      { fromPhone: "555-123-4567" }, // phone-only match, weight 0.4 -- between the two thresholds
      [candidate()]
    );
    expect(result.outcome).toBe("AMBIGUOUS");
  });

  it("returns NO_MATCH for a weak name-only match that doesn't even clear the ambiguous floor", () => {
    const result = matchConversationToCase(
      { rawSenderName: "Jane Smith" }, // name-only match, weight 0.2 -- below AMBIGUOUS_THRESHOLD
      [candidate()]
    );
    expect(result.outcome).toBe("NO_MATCH");
  });

  it("returns NO_MATCH when no candidate has any matching signal", () => {
    const result = matchConversationToCase(
      { fromEmail: "stranger@nowhere.com" },
      [candidate()]
    );
    expect(result.outcome).toBe("NO_MATCH");
  });

  it("returns NO_MATCH for an empty candidate list", () => {
    const result = matchConversationToCase({ fromEmail: "jane@example.com" }, []);
    expect(result.outcome).toBe("NO_MATCH");
  });

  it("auto-attaches the clear leader even when a weaker second candidate also partially matches", () => {
    const signals: IncomingCommunicationSignals = {
      fromEmail: "jane@example.com",
      providerThreadId: "thread-abc",
      rawSenderName: "Jane Smith",
      fromPhone: "555-123-4567",
    };
    const candidates = [
      candidate({ claimantId: "claimant-1842" }),
      candidate({
        claimantId: "claimant-9999",
        caseNumber: "RK-9999",
        personEmail: "someone-else@example.com",
        personPhone: "555-999-9999",
        priorProviderThreadIds: [],
        personName: "Jane Smith", // only the weak name signal matches
      }),
    ];
    const result = matchConversationToCase(signals, candidates);
    expect(result.outcome).toBe("AUTO_ATTACH");
    if (result.outcome === "AUTO_ATTACH") {
      expect(result.match.claimantId).toBe("claimant-1842");
    }
  });
});
