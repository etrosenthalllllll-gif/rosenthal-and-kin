import { describe, it, expect } from "vitest";
import {
  planInboundEmailIngestion,
  type RawInboundEmail,
  type IngestionContext,
} from "./planInboundEmailIngestion";
import type { CaseMatchCandidate } from "./matchConversationToCase";

function email(overrides: Partial<RawInboundEmail> = {}): RawInboundEmail {
  return {
    providerMessageId: "msg-1",
    inReplyToProviderMessageId: null,
    fromEmail: "jane@example.com",
    toEmail: "outreach@rosenthalandkin.com",
    subject: "Re: Estate of John Smith",
    bodyText: "Yes, I'm interested. What do you need from me?",
    receivedAt: "2026-01-12T10:00:00Z",
    ...overrides,
  };
}

function candidate(overrides: Partial<CaseMatchCandidate> = {}): CaseMatchCandidate {
  return {
    claimantId: "claimant-1842",
    caseNumber: "RK-1842",
    personEmail: "jane@example.com",
    personPhone: null,
    personName: "Jane Smith",
    priorProviderThreadIds: [],
    ...overrides,
  };
}

function context(overrides: Partial<IngestionContext> = {}): IngestionContext {
  return {
    existingProviderMessageIds: new Set(),
    candidates: [candidate()],
    ...overrides,
  };
}

describe("planInboundEmailIngestion", () => {
  it("rejects a payload with no provider message ID", () => {
    const plan = planInboundEmailIngestion(email({ providerMessageId: "" }), context());
    expect(plan.action).toBe("REJECT_INVALID");
  });

  it("rejects a payload with an empty body", () => {
    const plan = planInboundEmailIngestion(email({ bodyText: "   " }), context());
    expect(plan.action).toBe("REJECT_INVALID");
  });

  it("skips a message whose provider ID was already ingested (doc 04 section 5 idempotency)", () => {
    const plan = planInboundEmailIngestion(
      email({ providerMessageId: "msg-1" }),
      context({ existingProviderMessageIds: new Set(["msg-1"]) })
    );
    expect(plan.action).toBe("SKIP_DUPLICATE");
  });

  it("attaches to the case when multiple strong signals clearly point to one candidate (email + case-number reference)", () => {
    const plan = planInboundEmailIngestion(
      email({ subject: "Re: Estate RK-1842" }),
      context()
    );
    expect(plan.action).toBe("ATTACH_TO_CASE");
    if (plan.action === "ATTACH_TO_CASE") {
      expect(plan.claimantId).toBe("claimant-1842");
      expect(plan.communication.body).toBe("Yes, I'm interested. What do you need from me?");
      expect(plan.communication.providerMessageId).toBe("msg-1");
    }
  });

  it("raises a match exception rather than auto-attaching on a single weak signal (email match alone)", () => {
    const plan = planInboundEmailIngestion(email(), context());
    expect(plan.action).toBe("CREATE_MATCH_EXCEPTION");
  });

  it("preserves the exact original body text on the communication draft, untouched", () => {
    const rawBody = "Weird\n\nformatting   and   spacing preserved exactly.";
    const plan = planInboundEmailIngestion(email({ bodyText: rawBody }), context());
    if (plan.action === "ATTACH_TO_CASE" || plan.action === "CREATE_MATCH_EXCEPTION") {
      expect(plan.communication.body).toBe(rawBody);
    } else {
      throw new Error(`unexpected action: ${plan.action}`);
    }
  });

  it("creates a match exception when two candidates are both plausible", () => {
    const candidates = [
      candidate({ claimantId: "claimant-1842", caseNumber: "RK-1842" }),
      candidate({ claimantId: "claimant-1917", caseNumber: "RK-1917" }),
    ];
    const plan = planInboundEmailIngestion(email(), context({ candidates }));
    expect(plan.action).toBe("CREATE_MATCH_EXCEPTION");
    if (plan.action === "CREATE_MATCH_EXCEPTION") {
      expect(plan.candidates.map((c) => c.claimantId).sort()).toEqual([
        "claimant-1842",
        "claimant-1917",
      ]);
    }
  });

  it("creates a match exception (with an empty candidate list) rather than silently dropping a message that matches nothing", () => {
    const plan = planInboundEmailIngestion(
      email({ fromEmail: "stranger@nowhere.com" }),
      context({ candidates: [candidate({ personEmail: "someone-else@example.com" })] })
    );
    expect(plan.action).toBe("CREATE_MATCH_EXCEPTION");
    if (plan.action === "CREATE_MATCH_EXCEPTION") {
      expect(plan.candidates).toEqual([]);
      // The message itself is still preserved for a human to review.
      expect(plan.communication.sender).toBe("stranger@nowhere.com");
    }
  });

  it("uses In-Reply-To as the thread signal for matching", () => {
    const candidates = [candidate({ priorProviderThreadIds: ["thread-msg-0"], personEmail: null })];
    const plan = planInboundEmailIngestion(
      email({ inReplyToProviderMessageId: "thread-msg-0", fromEmail: "unknown@nowhere.com" }),
      context({ candidates })
    );
    // Thread match alone (weight 0.6) doesn't clear AUTO_ATTACH_THRESHOLD (0.9),
    // but it's well above the ambiguous floor -- so this should raise for review,
    // not silently misattach on a thread ID alone.
    expect(plan.action).toBe("CREATE_MATCH_EXCEPTION");
  });
});
