import { describe, it, expect } from "vitest";
import {
  categorizeAttention,
  buildAttentionQueue,
  buildPostFilingDashboard,
  type PostFilingCaseSignals,
  type PostFilingDashboardRow,
} from "./postFilingAttentionQueue";

function signals(overrides: Partial<PostFilingCaseSignals> = {}): PostFilingCaseSignals {
  return {
    postFilingCaseId: "case-1",
    hasSystemError: false,
    hasEscalation: false,
    isUrgent: false,
    hasApproachingDeadline: false,
    hasUpcomingHearing: false,
    hasOpenDocumentRequest: false,
    hasUnprocessedClaimantResponse: false,
    hasUnprocessedProviderResponse: false,
    hasNewAuthorityUpdate: false,
    hasNoRecentUpdate: false,
    ...overrides,
  };
}

describe("attention categorization", () => {
  it("returns no categories when nothing is triggered", () => {
    expect(categorizeAttention(signals())).toEqual([]);
  });

  it("returns every triggered category, not just the most severe one", () => {
    const result = categorizeAttention(signals({ hasEscalation: true, hasOpenDocumentRequest: true }));
    expect(result).toContain("ESCALATION");
    expect(result).toContain("DOCUMENT_REQUEST");
  });

  it("orders triggered categories by doc 09's own priority", () => {
    const result = categorizeAttention(
      signals({ hasNoRecentUpdate: true, hasSystemError: true, hasOpenDocumentRequest: true })
    );
    expect(result).toEqual(["SYSTEM_ERROR", "DOCUMENT_REQUEST", "NO_UPDATE"]);
  });
});

describe("attention queue building", () => {
  it("builds one item per (case, category) pair across all cases", () => {
    const queue = buildAttentionQueue([
      signals({ postFilingCaseId: "case-1", hasEscalation: true }),
      signals({ postFilingCaseId: "case-2", hasOpenDocumentRequest: true, hasUpcomingHearing: true }),
    ]);
    expect(queue).toHaveLength(3);
    expect(queue.filter((i) => i.postFilingCaseId === "case-2")).toHaveLength(2);
  });

  it("sorts the whole queue by category priority across cases", () => {
    const queue = buildAttentionQueue([
      signals({ postFilingCaseId: "case-1", hasNoRecentUpdate: true }),
      signals({ postFilingCaseId: "case-2", hasSystemError: true }),
    ]);
    expect(queue[0].category).toBe("SYSTEM_ERROR");
    expect(queue[0].postFilingCaseId).toBe("case-2");
  });

  it("returns an empty queue when no case has anything outstanding", () => {
    expect(buildAttentionQueue([signals(), signals({ postFilingCaseId: "case-2" })])).toEqual([]);
  });
});

describe("post-filing dashboard", () => {
  function row(overrides: Partial<PostFilingDashboardRow> = {}): PostFilingDashboardRow {
    return {
      postFilingCaseId: "case-1",
      caseNumber: "RK-1842",
      claimantName: "Jane Doe",
      authority: "State Controller",
      jurisdiction: "CA",
      filingStatus: "PROCESSING",
      lastExternalUpdateAt: null,
      nextDeadlineAt: null,
      daysRemaining: null,
      outstandingRequest: null,
      riskLevel: null,
      priority: 10,
      nextAction: null,
      assignedOperatorId: null,
      ...overrides,
    };
  }

  it("sorts rows by priority, highest first", () => {
    const dashboard = buildPostFilingDashboard([row({ priority: 10 }), row({ postFilingCaseId: "case-2", priority: 90 })]);
    expect(dashboard[0].postFilingCaseId).toBe("case-2");
  });
});
