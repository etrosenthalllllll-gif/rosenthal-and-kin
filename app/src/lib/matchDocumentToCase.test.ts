import { describe, it, expect } from "vitest";
import {
  scoreDocumentCandidate,
  matchDocumentToCase,
  type CaseMatchCandidate,
} from "./matchDocumentToCase";

function candidate(overrides: Partial<CaseMatchCandidate> = {}): CaseMatchCandidate {
  return {
    claimantId: "claimant-1",
    caseNumber: "RK-1842",
    decedentName: "John Doe",
    claimantName: "Jane Smith",
    claimantEmail: "jane@example.com",
    knownCommunicationIds: [],
    ...overrides,
  };
}

describe("scoreDocumentCandidate", () => {
  it("scores a communication-linked document near-certainly", () => {
    const score = scoreDocumentCandidate(
      { sourceCommunicationId: "comm-1" },
      candidate({ knownCommunicationIds: ["comm-1"] })
    );
    expect(score.confidence).toBeGreaterThanOrEqual(0.6);
    expect(score.reasons[0]).toMatch(/communication already linked/i);
  });

  it("scores an uploader-email match", () => {
    const score = scoreDocumentCandidate(
      { uploaderEmail: "JANE@example.com" },
      candidate()
    );
    expect(score.confidence).toBe(0.5);
  });

  it("scores a case-number reference found in extracted text", () => {
    const score = scoreDocumentCandidate(
      { extractedText: "Please file under case RK-1842 for the estate." },
      candidate()
    );
    expect(score.confidence).toBeCloseTo(0.45);
  });

  it("stacks multiple signals and clamps at 1.0", () => {
    const score = scoreDocumentCandidate(
      {
        sourceCommunicationId: "comm-1",
        uploaderEmail: "jane@example.com",
        extractedText: "RK-1842, decedent John Doe, claimant Jane Smith",
      },
      candidate({ knownCommunicationIds: ["comm-1"] })
    );
    expect(score.confidence).toBe(1);
  });

  it("scores zero confidence when nothing matches", () => {
    const score = scoreDocumentCandidate({ uploaderEmail: "stranger@example.com" }, candidate());
    expect(score.confidence).toBe(0);
  });
});

describe("matchDocumentToCase", () => {
  it("auto-attaches a single clear high-confidence match", () => {
    const decision = matchDocumentToCase(
      { sourceCommunicationId: "comm-1", uploaderEmail: "jane@example.com" },
      [candidate({ knownCommunicationIds: ["comm-1"] })]
    );
    expect(decision.outcome).toBe("AUTO_ATTACH");
  });

  it("never auto-attaches when two candidates are both plausible -- creates an ambiguous match instead", () => {
    const decision = matchDocumentToCase(
      { extractedText: "RK-1842 RK-1917 Jane Smith" },
      [
        candidate({ claimantId: "claimant-1", caseNumber: "RK-1842" }),
        candidate({ claimantId: "claimant-2", caseNumber: "RK-1917" }),
      ]
    );
    expect(decision.outcome).toBe("AMBIGUOUS");
    if (decision.outcome === "AMBIGUOUS") {
      expect(decision.candidates.map((c) => c.claimantId).sort()).toEqual([
        "claimant-1",
        "claimant-2",
      ]);
    }
  });

  it("returns NO_MATCH when no candidate scores above zero", () => {
    const decision = matchDocumentToCase({ uploaderEmail: "nobody@nowhere.com" }, [candidate()]);
    expect(decision.outcome).toBe("NO_MATCH");
  });

  it("returns NO_MATCH with no candidates at all", () => {
    expect(matchDocumentToCase({ sourceCommunicationId: "comm-1" }, [])).toEqual({
      outcome: "NO_MATCH",
    });
  });
});
