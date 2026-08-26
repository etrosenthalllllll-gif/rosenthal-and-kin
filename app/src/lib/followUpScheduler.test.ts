import { describe, it, expect } from "vitest";
import {
  planNextFollowUp,
  DEFAULT_OUTREACH_SEQUENCE,
  type FollowUpContext,
  type FollowUpStopConditions,
} from "./followUpScheduler";

function noStops(): FollowUpStopConditions {
  return {
    hasResponded: false,
    hasOptedOut: false,
    caseClosed: false,
    personInactive: false,
    operatorPaused: false,
    workflowChanged: false,
    anotherChannelTookOver: false,
  };
}

function context(overrides: Partial<FollowUpContext> = {}): FollowUpContext {
  return {
    sequence: DEFAULT_OUTREACH_SEQUENCE,
    initialSentAt: new Date("2026-01-01T00:00:00Z"),
    now: new Date("2026-01-01T00:00:00Z"),
    sentStepIndexes: [],
    stopConditions: noStops(),
    ...overrides,
  };
}

describe("planNextFollowUp", () => {
  it("sends the initial outreach (day 0) immediately when nothing has been sent yet", () => {
    const plan = planNextFollowUp(context());
    expect(plan.action).toBe("SEND");
    if (plan.action === "SEND") {
      expect(plan.stepIndex).toBe(0);
      expect(plan.step.templateKey).toBe("INITIAL_OUTREACH");
    }
  });

  it("waits for day 7 follow-up before it's due", () => {
    const plan = planNextFollowUp(
      context({ now: new Date("2026-01-05T00:00:00Z"), sentStepIndexes: [0] })
    );
    expect(plan.action).toBe("WAIT");
    if (plan.action === "WAIT") {
      expect(plan.stepIndex).toBe(1);
      expect(plan.dueAt.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    }
  });

  it("sends the day 7 follow-up exactly on its due date", () => {
    const plan = planNextFollowUp(
      context({ now: new Date("2026-01-08T00:00:00Z"), sentStepIndexes: [0] })
    );
    expect(plan.action).toBe("SEND");
    if (plan.action === "SEND") {
      expect(plan.step.templateKey).toBe("FOLLOW_UP_1");
    }
  });

  it("sends a follow-up after its due date has passed too (not just exactly on it)", () => {
    const plan = planNextFollowUp(
      context({ now: new Date("2026-01-20T00:00:00Z"), sentStepIndexes: [0, 1] })
    );
    expect(plan.action).toBe("SEND");
    if (plan.action === "SEND") {
      expect(plan.step.templateKey).toBe("FOLLOW_UP_2");
    }
  });

  it("reports SEQUENCE_COMPLETE once every step has been sent", () => {
    const plan = planNextFollowUp(
      context({ now: new Date("2026-06-01T00:00:00Z"), sentStepIndexes: [0, 1, 2, 3] })
    );
    expect(plan.action).toBe("SEQUENCE_COMPLETE");
  });

  it("stops rather than sending a follow-up after a meaningful response, even mid-sequence", () => {
    const plan = planNextFollowUp(
      context({
        now: new Date("2026-01-08T00:00:00Z"),
        sentStepIndexes: [0],
        stopConditions: { ...noStops(), hasResponded: true },
      })
    );
    expect(plan.action).toBe("STOP");
    if (plan.action === "STOP") {
      expect(plan.reason).toMatch(/responded/i);
    }
  });

  it("stops for an opt-out even when a step is otherwise due", () => {
    const plan = planNextFollowUp(
      context({ stopConditions: { ...noStops(), hasOptedOut: true } })
    );
    expect(plan.action).toBe("STOP");
  });

  it("stops when the operator paused the sequence", () => {
    const plan = planNextFollowUp(
      context({ stopConditions: { ...noStops(), operatorPaused: true } })
    );
    expect(plan.action).toBe("STOP");
  });

  it("supports a custom sequence, not just the default", () => {
    const custom = {
      key: "CUSTOM",
      steps: [
        { dayOffset: 0, templateKey: "A" },
        { dayOffset: 3, templateKey: "B" },
      ],
    };
    const plan = planNextFollowUp(
      context({ sequence: custom, now: new Date("2026-01-04T00:00:00Z"), sentStepIndexes: [0] })
    );
    expect(plan.action).toBe("SEND");
    if (plan.action === "SEND") {
      expect(plan.step.templateKey).toBe("B");
    }
  });
});
