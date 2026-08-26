import { describe, it, expect } from "vitest";
import { buildDecisionQueue, type DecisionQueueRow } from "./decisionQueue";

const NOW = new Date("2026-08-26T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function makeRow(overrides: Partial<DecisionQueueRow> = {}): DecisionQueueRow {
  return {
    id: "dec-1",
    decisionType: "APPROVE_OUTREACH",
    status: "PENDING",
    deadline: null,
    aiConfidence: null,
    createdAt: NOW,
    claimant: {
      id: "claimant-1",
      status: "POTENTIAL_HEIR",
      person: { firstName: "Jane", lastName: "Doe" },
      estate: {
        id: "estate-1",
        caseNumber: "RK-1",
        decedentName: "John Doe",
        estimatedValueCents: 10_000_00,
      },
    },
    ...overrides,
  };
}

describe("buildDecisionQueue", () => {
  it("maps a row into a view model with a computed priority", () => {
    const items = buildDecisionQueue([makeRow()], NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "dec-1",
      decisionTypeKey: "APPROVE_OUTREACH",
      decisionTypeDisplayName: "Approve Outreach",
      claimantName: "Jane Doe",
      caseNumber: "RK-1",
      decedentName: "John Doe",
    });
    expect(items[0].priority.score).toBeGreaterThan(0);
  });

  it("ranks a high-consequence, older decision above a fresh routine one", () => {
    const routine = makeRow({ id: "routine", createdAt: NOW });
    const consequential = makeRow({
      id: "consequential",
      decisionType: "APPROVE_CLAIM_PACKAGE", // highConsequence: true
      createdAt: daysAgo(5),
    });

    const items = buildDecisionQueue([routine, consequential], NOW);

    expect(items[0].id).toBe("consequential");
  });

  it("threads the estate's estimated value into the priority's value component", () => {
    const smallEstate = makeRow({
      id: "small",
      claimant: {
        ...makeRow().claimant,
        estate: { ...makeRow().claimant.estate, estimatedValueCents: 10_000_00 },
      },
    });
    const largeEstate = makeRow({
      id: "large",
      claimant: {
        ...makeRow().claimant,
        estate: { ...makeRow().claimant.estate, estimatedValueCents: 2_000_000_00 },
      },
    });

    const items = buildDecisionQueue([smallEstate, largeEstate], NOW);
    const large = items.find((i) => i.id === "large")!;
    const small = items.find((i) => i.id === "small")!;

    expect(large.priority.components.value).toBeGreaterThan(small.priority.components.value);
  });

  it("throws for an unknown decision type rather than silently defaulting", () => {
    expect(() =>
      buildDecisionQueue([makeRow({ decisionType: "NOT_A_REAL_TYPE" })], NOW)
    ).toThrow();
  });

  it("returns an empty array for an empty queue, not an error", () => {
    expect(buildDecisionQueue([], NOW)).toEqual([]);
  });
});
