import { describe, it, expect } from "vitest";
import { computePriorityScore, priorityLabel, rankByPriority } from "./priority";

const NOW = new Date("2026-08-26T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const hoursFromNow = (n: number) => new Date(NOW.getTime() + n * 60 * 60 * 1000);

describe("computePriorityScore", () => {
  it("gives a near-zero score to a fresh, low-value, no-deadline decision", () => {
    const result = computePriorityScore({ createdAt: NOW, now: NOW });
    expect(result.score).toBeLessThan(20);
    expect(result.label).toBe("LOW");
  });

  it("scores an overdue deadline as more urgent than a distant one", () => {
    const overdue = computePriorityScore({
      createdAt: daysAgo(1),
      deadline: hoursFromNow(-2),
      now: NOW,
    });
    const distant = computePriorityScore({
      createdAt: daysAgo(1),
      deadline: hoursFromNow(24 * 60),
      now: NOW,
    });
    expect(overdue.score).toBeGreaterThan(distant.score);
  });

  it("gives diminishing, not linear, weight to potential recovery value", () => {
    const small = computePriorityScore({
      createdAt: NOW,
      now: NOW,
      potentialRecoveryCents: 10_000_00, // $10k
    });
    const large = computePriorityScore({
      createdAt: NOW,
      now: NOW,
      potentialRecoveryCents: 1_000_000_00, // $1M, 100x larger
    });
    expect(large.components.value).toBeGreaterThan(small.components.value);
    // 100x the money should NOT mean 100x the score component.
    expect(large.components.value).toBeLessThan(small.components.value * 100);
  });

  it("increases score as AI confidence decreases", () => {
    const highConfidence = computePriorityScore({
      createdAt: NOW,
      now: NOW,
      aiConfidence: 0.98,
    });
    const lowConfidence = computePriorityScore({
      createdAt: NOW,
      now: NOW,
      aiConfidence: 0.4,
    });
    expect(lowConfidence.score).toBeGreaterThan(highConfidence.score);
  });

  it("treats a missing AI confidence as neutral, not as zero confidence", () => {
    const noConfidence = computePriorityScore({ createdAt: NOW, now: NOW });
    const zeroConfidence = computePriorityScore({
      createdAt: NOW,
      now: NOW,
      aiConfidence: 0,
    });
    expect(noConfidence.components.confidence).toBe(0);
    expect(zeroConfidence.components.confidence).toBeGreaterThan(0);
  });

  it("older undecided decisions score higher than brand-new ones, all else equal", () => {
    const fresh = computePriorityScore({ createdAt: NOW, now: NOW });
    const old = computePriorityScore({ createdAt: daysAgo(10), now: NOW });
    expect(old.score).toBeGreaterThan(fresh.score);
  });

  it("high-consequence decisions get a floor bump over routine ones", () => {
    const routine = computePriorityScore({ createdAt: NOW, now: NOW, highConsequence: false });
    const consequential = computePriorityScore({ createdAt: NOW, now: NOW, highConsequence: true });
    expect(consequential.score).toBeGreaterThan(routine.score);
  });

  it("risk level orders LOW < MEDIUM < HIGH < CRITICAL", () => {
    const scores = (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map(
      (riskLevel) => computePriorityScore({ createdAt: NOW, now: NOW, riskLevel }).score
    );
    expect(scores[0]).toBeLessThan(scores[1]);
    expect(scores[1]).toBeLessThan(scores[2]);
    expect(scores[2]).toBeLessThan(scores[3]);
  });
});

describe("priorityLabel", () => {
  it("buckets scores into LOW/MEDIUM/HIGH/URGENT", () => {
    expect(priorityLabel(0)).toBe("LOW");
    expect(priorityLabel(19)).toBe("LOW");
    expect(priorityLabel(20)).toBe("MEDIUM");
    expect(priorityLabel(44)).toBe("MEDIUM");
    expect(priorityLabel(45)).toBe("HIGH");
    expect(priorityLabel(69)).toBe("HIGH");
    expect(priorityLabel(70)).toBe("URGENT");
  });
});

describe("rankByPriority", () => {
  it("sorts highest priority first without mutating the input", () => {
    const items = [
      { id: "low", createdAt: NOW, now: NOW },
      { id: "urgent", createdAt: daysAgo(1), deadline: hoursFromNow(-1), now: NOW, riskLevel: "CRITICAL" as const },
      { id: "medium", createdAt: daysAgo(5), now: NOW },
    ];
    const original = [...items];

    const ranked = rankByPriority(items);

    expect(ranked[0].id).toBe("urgent");
    expect(ranked[ranked.length - 1].id).toBe("low");
    expect(items).toEqual(original); // not mutated
  });
});
