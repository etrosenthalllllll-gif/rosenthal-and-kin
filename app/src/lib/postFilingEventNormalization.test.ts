import { describe, it, expect } from "vitest";
import {
  detectStatusChange,
  shouldCreateStatusChangeEvent,
  normalizeExternalEvent,
  type ExternalEventMapping,
} from "./postFilingEventNormalization";

describe("status change detection", () => {
  it("reports unchanged when the status is the same", () => {
    const result = detectStatusChange("PROCESSING", "PROCESSING");
    expect(result.changed).toBe(false);
    expect(shouldCreateStatusChangeEvent(result)).toBe(false);
  });

  it("reports changed and creates an event only when the status actually differs", () => {
    const result = detectStatusChange("PROCESSING", "ADDITIONAL_INFORMATION_REQUIRED");
    expect(result.changed).toBe(true);
    expect(shouldCreateStatusChangeEvent(result)).toBe(true);
  });
});

describe("external event normalization", () => {
  const MAPPINGS: ExternalEventMapping[] = [
    { connectorId: "authority-a", rawEventType: "info_request", normalizedEventType: "DOCUMENT_REQUESTED" },
    { connectorId: "authority-a", rawEventType: "hearing_set", normalizedEventType: "HEARING_SCHEDULED" },
  ];

  it("maps a configured raw event type to its normalized type", () => {
    const result = normalizeExternalEvent("authority-a", "info_request", "Please provide documentation.", MAPPINGS);
    expect(result.normalizedEventType).toBe("DOCUMENT_REQUESTED");
    expect(result.requiresHumanReview).toBe(false);
  });

  it("preserves the original raw wording regardless of recognition", () => {
    const result = normalizeExternalEvent("authority-a", "hearing_set", "A hearing has been scheduled for Sept 10.", MAPPINGS);
    expect(result.rawEventText).toBe("A hearing has been scheduled for Sept 10.");
  });

  it("fails closed to UNKNOWN_EVENT for an unrecognized raw event type, never guessing", () => {
    const result = normalizeExternalEvent("authority-a", "some_new_event_type", "Unusual notice text.", MAPPINGS);
    expect(result.normalizedEventType).toBe("UNKNOWN_EVENT");
    expect(result.requiresHumanReview).toBe(true);
    expect(result.rawEventText).toBe("Unusual notice text.");
  });

  it("fails closed to UNKNOWN_EVENT for an unrecognized connector too", () => {
    const result = normalizeExternalEvent("authority-z", "info_request", "text", MAPPINGS);
    expect(result.normalizedEventType).toBe("UNKNOWN_EVENT");
  });
});
