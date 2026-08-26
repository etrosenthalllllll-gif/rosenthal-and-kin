import { describe, it, expect } from "vitest";
import { classifyDeadlineAlertLevel, evaluateFilingDeadlineAlert } from "./filingDeadlineAlerts";

describe("deadline alert level classification", () => {
  it("is CRITICAL when due today or overdue", () => {
    expect(classifyDeadlineAlertLevel(0)).toBe("CRITICAL");
    expect(classifyDeadlineAlertLevel(-2)).toBe("CRITICAL");
  });

  it("is URGENT within 3 days", () => {
    expect(classifyDeadlineAlertLevel(3)).toBe("URGENT");
  });

  it("is HIGH within 7 days", () => {
    expect(classifyDeadlineAlertLevel(7)).toBe("HIGH");
  });

  it("is NORMAL beyond the configured thresholds", () => {
    expect(classifyDeadlineAlertLevel(30)).toBe("NORMAL");
  });
});

describe("filing deadline alert evaluation", () => {
  it("computes days remaining and flags overdue deadlines", () => {
    const alert = evaluateFilingDeadlineAlert({
      deadlineDate: "2026-08-20T00:00:00.000Z",
      source: "Configured filing rule v2",
      currentDate: "2026-08-26T00:00:00.000Z",
    });
    expect(alert.isOverdue).toBe(true);
    expect(alert.level).toBe("CRITICAL");
    expect(alert.source).toBe("Configured filing rule v2");
  });

  it("computes a non-overdue alert correctly", () => {
    const alert = evaluateFilingDeadlineAlert({
      deadlineDate: "2026-09-02T00:00:00.000Z",
      source: "Authority notice",
      currentDate: "2026-08-26T00:00:00.000Z",
    });
    expect(alert.isOverdue).toBe(false);
    expect(alert.daysRemaining).toBe(7);
    expect(alert.level).toBe("HIGH");
  });
});
