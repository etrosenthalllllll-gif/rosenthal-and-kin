import { describe, it, expect } from "vitest";
import {
  getTriggerEscalationLevel,
  evaluateEscalation,
  nextEscalationLevelIfUnacknowledged,
} from "./postFilingEscalation";

describe("escalation trigger levels", () => {
  it("matches the doc's own severity groupings", () => {
    expect(getTriggerEscalationLevel("DEADLINE_APPROACHING")).toBe(1);
    expect(getTriggerEscalationLevel("PROVIDER_OUTAGE")).toBe(2);
    expect(getTriggerEscalationLevel("DEADLINE_OVERDUE")).toBe(3);
    expect(getTriggerEscalationLevel("SYSTEM_ERROR")).toBe(4);
  });
});

describe("escalation evaluation", () => {
  it("is level 0 when nothing fired", () => {
    expect(evaluateEscalation([]).level).toBe(0);
  });

  it("takes the single highest level among every fired trigger", () => {
    const result = evaluateEscalation(["DEADLINE_APPROACHING", "SYSTEM_ERROR", "PROVIDER_OUTAGE"]);
    expect(result.level).toBe(4);
    expect(result.firedTriggers).toHaveLength(3);
  });
});

describe("escalation acknowledgment", () => {
  it("climbs one level when unacknowledged", () => {
    expect(nextEscalationLevelIfUnacknowledged(1, "UNACKNOWLEDGED")).toBe(2);
  });

  it("caps at level 4 (CRITICAL)", () => {
    expect(nextEscalationLevelIfUnacknowledged(4, "UNACKNOWLEDGED")).toBe(4);
  });

  it("leaves the level unchanged once acknowledged", () => {
    expect(nextEscalationLevelIfUnacknowledged(2, "ACKNOWLEDGED")).toBe(2);
    expect(nextEscalationLevelIfUnacknowledged(2, "IN_PROGRESS")).toBe(2);
  });
});
