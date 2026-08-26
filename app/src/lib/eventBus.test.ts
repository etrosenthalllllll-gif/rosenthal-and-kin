import { describe, it, expect, vi } from "vitest";
import {
  buildAutomationEvent,
  shouldProcessEvent,
  createInMemoryEventBus,
  EXAMPLE_EVENT_TYPES,
} from "./eventBus";

describe("building automation events", () => {
  it("stamps version 1 and the given timestamp", () => {
    const event = buildAutomationEvent(
      {
        eventId: "evt-1",
        eventType: "CLAIM_FILED",
        caseId: "RK-1842",
        sourceSystem: "Filing System",
        payload: { filingId: "f-1" },
      },
      "2026-08-26T00:00:00.000Z"
    );
    expect(event.version).toBe(1);
    expect(event.createdAt).toBe("2026-08-26T00:00:00.000Z");
    expect(event.eventType).toBe("CLAIM_FILED");
  });
});

describe("event idempotency", () => {
  it("says to process an event never seen before", () => {
    expect(shouldProcessEvent("evt-1", new Set())).toBe(true);
  });

  it("says NOT to process a duplicate-delivered event", () => {
    expect(shouldProcessEvent("evt-1", new Set(["evt-1"]))).toBe(false);
  });
});

describe("in-memory event bus", () => {
  it("delivers a published event only to subscribers of its type", async () => {
    const bus = createInMemoryEventBus();
    const claimHandler = vi.fn();
    const emailHandler = vi.fn();
    bus.subscribe("CLAIM_FILED", claimHandler);
    bus.subscribe("EMAIL_SENT", emailHandler);

    const event = buildAutomationEvent(
      { eventId: "evt-1", eventType: "CLAIM_FILED", sourceSystem: "Filing System", payload: {} },
      "2026-08-26T00:00:00.000Z"
    );
    await bus.publish(event);

    expect(claimHandler).toHaveBeenCalledWith(event);
    expect(emailHandler).not.toHaveBeenCalled();
  });

  it("supports multiple subscribers to the same event type", async () => {
    const bus = createInMemoryEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.subscribe("CASE_CLOSED", first);
    bus.subscribe("CASE_CLOSED", second);
    expect(bus.subscriberCount("CASE_CLOSED")).toBe(2);

    await bus.publish(
      buildAutomationEvent(
        { eventId: "evt-2", eventType: "CASE_CLOSED", sourceSystem: "Case System", payload: {} },
        "2026-08-26T00:00:00.000Z"
      )
    );
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it("unsubscribe stops further delivery", async () => {
    const bus = createInMemoryEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("CASE_CLOSED", handler);
    unsubscribe();

    await bus.publish(
      buildAutomationEvent(
        { eventId: "evt-3", eventType: "CASE_CLOSED", sourceSystem: "Case System", payload: {} },
        "2026-08-26T00:00:00.000Z"
      )
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("publishing an event with no subscribers is a silent no-op", async () => {
    const bus = createInMemoryEventBus();
    await expect(
      bus.publish(
        buildAutomationEvent(
          { eventId: "evt-4", eventType: "NOBODY_LISTENING", sourceSystem: "x", payload: {} },
          "2026-08-26T00:00:00.000Z"
        )
      )
    ).resolves.toBeUndefined();
  });
});

describe("example event type catalog", () => {
  it("includes the doc's own worked examples", () => {
    expect(EXAMPLE_EVENT_TYPES).toContain("CLAIM_FILED");
    expect(EXAMPLE_EVENT_TYPES).toContain("WORKFLOW_FAILED");
  });
});
