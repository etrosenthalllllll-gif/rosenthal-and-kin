import { describe, it, expect } from "vitest";
import { nextActionForFilingStatus, buildFilingQueueRow, buildFilingQueue, type FilingQueueRowInput } from "./filingQueue";

function row(overrides: Partial<FilingQueueRowInput> = {}): FilingQueueRowInput {
  return {
    filingId: "filing-1",
    caseNumber: "RK-1842",
    claimantName: "Jane Doe",
    jurisdiction: "CA",
    packageVersion: 4,
    status: "PROCESSING",
    feeAmountCents: 5000,
    paymentStatus: "PAID",
    filingDestination: "State Controller",
    deadlineAlert: null,
    lastEventDescription: "Submitted",
    priorityScore: 50,
    ...overrides,
  };
}

describe("filing queue next action", () => {
  it("maps a known status to a specific next action", () => {
    expect(nextActionForFilingStatus("REJECTED")).toContain("correction");
  });

  it("every FilingStatus value has a mapped next action", () => {
    const statuses: FilingQueueRowInput["status"][] = [
      "NOT_READY", "READY_FOR_FILING", "AWAITING_APPROVAL", "APPROVED_TO_FILE",
      "PREPARING_SUBMISSION", "AWAITING_PAYMENT", "PAYMENT_PROCESSING", "PAYMENT_COMPLETE",
      "SUBMITTING", "SUBMITTED", "RECEIVED", "PROCESSING", "ACCEPTED", "PENDING",
      "REJECTED", "CORRECTION_REQUIRED", "RESUBMISSION_REQUIRED", "RESUBMITTED",
      "FAILED", "CANCELLED", "CLOSED",
    ];
    for (const status of statuses) {
      expect(typeof nextActionForFilingStatus(status)).toBe("string");
      expect(nextActionForFilingStatus(status).length).toBeGreaterThan(0);
    }
  });
});

describe("filing queue row assembly", () => {
  it("adds the derived next action without altering the other fields", () => {
    const result = buildFilingQueueRow(row());
    expect(result.filingId).toBe("filing-1");
    expect(result.nextAction).toBe(nextActionForFilingStatus("PROCESSING"));
  });

  it("builds a queue from multiple rows", () => {
    const queue = buildFilingQueue([row(), row({ filingId: "filing-2", status: "ACCEPTED" })]);
    expect(queue).toHaveLength(2);
    expect(queue[1].nextAction).toBe(nextActionForFilingStatus("ACCEPTED"));
  });
});
