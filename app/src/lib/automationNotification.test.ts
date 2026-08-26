import { describe, it, expect } from "vitest";
import { shouldNotify, buildAutomationNotification, resolveEscalationAction, DEFAULT_APPROVAL_ESCALATION_LADDER } from "./automationNotification";

describe("notification configurability", () => {
  it("notifies by default when a trigger has no explicit config entry", () => {
    expect(shouldNotify("PROVIDER_OUTAGE", {})).toBe(true);
  });

  it("respects an explicit opt-out", () => {
    expect(shouldNotify("PROVIDER_OUTAGE", { PROVIDER_OUTAGE: false })).toBe(false);
  });
});

describe("notification building", () => {
  it("builds a notification with the trigger and timestamp", () => {
    const notification = buildAutomationNotification("APPROVAL_REQUIRED", "Approval pending review", "2026-08-26T00:00:00.000Z");
    expect(notification.trigger).toBe("APPROVAL_REQUIRED");
  });
});

describe("escalation ladder", () => {
  it("returns null before any threshold is reached", () => {
    expect(resolveEscalationAction("2026-08-26T00:00:00.000Z", "2026-08-26T10:00:00.000Z")).toBeNull();
  });

  it("returns REMINDER at the 24-hour threshold", () => {
    expect(resolveEscalationAction("2026-08-25T00:00:00.000Z", "2026-08-26T01:00:00.000Z")).toBe("REMINDER");
  });

  it("returns ESCALATION (not a repeat REMINDER) once past the 48-hour threshold", () => {
    expect(resolveEscalationAction("2026-08-24T00:00:00.000Z", "2026-08-26T01:00:00.000Z")).toBe("ESCALATION");
  });

  it("returns HIGH_PRIORITY_QUEUE once past the 72-hour threshold", () => {
    expect(resolveEscalationAction("2026-08-22T00:00:00.000Z", "2026-08-26T01:00:00.000Z")).toBe("HIGH_PRIORITY_QUEUE");
  });

  it("respects a custom, differently-configured ladder", () => {
    const ladder = [{ afterHours: 1, action: "ESCALATION" as const }];
    expect(resolveEscalationAction("2026-08-26T00:00:00.000Z", "2026-08-26T02:00:00.000Z", ladder)).toBe("ESCALATION");
  });

  it("exposes the doc's own default ladder for callers to reuse directly", () => {
    expect(DEFAULT_APPROVAL_ESCALATION_LADDER.map((s) => s.afterHours)).toEqual([24, 48, 72]);
  });
});
