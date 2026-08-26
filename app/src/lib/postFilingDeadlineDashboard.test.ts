import { describe, it, expect } from "vitest";
import {
  classifyPostFilingDeadlineEscalation,
  groupDeadline,
  buildDeadlineDashboard,
  emptyDeadlineDashboard,
} from "./postFilingDeadlineDashboard";

describe("post-filing deadline escalation (reuses filingDeadlineAlerts.ts)", () => {
  it("escalates to CRITICAL when overdue", () => {
    expect(classifyPostFilingDeadlineEscalation(-1)).toBe("CRITICAL");
  });

  it("escalates to URGENT within 3 days", () => {
    expect(classifyPostFilingDeadlineEscalation(3)).toBe("URGENT");
  });
});

describe("deadline grouping", () => {
  it("groups a resolved deadline as COMPLETED regardless of its date", () => {
    expect(groupDeadline(-30, "COMPLETED")).toBe("COMPLETED");
    expect(groupDeadline(100, "WAIVED")).toBe("COMPLETED");
  });

  it("groups an outstanding deadline by days remaining", () => {
    expect(groupDeadline(-1, "OVERDUE")).toBe("OVERDUE");
    expect(groupDeadline(0, "DUE_TODAY")).toBe("TODAY");
    expect(groupDeadline(2, "DUE_SOON")).toBe("NEXT_3_DAYS");
    expect(groupDeadline(5, "UPCOMING")).toBe("NEXT_7_DAYS");
    expect(groupDeadline(20, "UPCOMING")).toBe("NEXT_30_DAYS");
    expect(groupDeadline(60, "UPCOMING")).toBe("OTHER");
  });
});

describe("deadline dashboard assembly", () => {
  it("distributes deadlines into their groups", () => {
    const dashboard = buildDeadlineDashboard([
      { deadlineId: "d1", daysRemaining: -1, status: "OVERDUE" },
      { deadlineId: "d2", daysRemaining: 0, status: "DUE_TODAY" },
      { deadlineId: "d3", daysRemaining: 100, status: "COMPLETED" },
    ]);
    expect(dashboard.OVERDUE).toEqual(["d1"]);
    expect(dashboard.TODAY).toEqual(["d2"]);
    expect(dashboard.COMPLETED).toEqual(["d3"]);
  });

  it("never shares array references across separate empty-dashboard calls", () => {
    const first = emptyDeadlineDashboard();
    first.OVERDUE.push("leaked");
    const second = emptyDeadlineDashboard();
    expect(second.OVERDUE).toEqual([]);
  });
});
