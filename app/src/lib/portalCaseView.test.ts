import { describe, it, expect } from "vitest";
import { buildStepperView, buildRecoverySummary, buildPortalCaseView } from "./portalCaseView";

describe("buildStepperView", () => {
  it("marks earlier steps done and the current one current", () => {
    const steps = buildStepperView("DOCUMENTS_REQUESTED");
    expect(steps[0].status).toBe("done"); // CONTACTED
    expect(steps[1].status).toBe("done"); // IDENTITY_VERIFIED
    expect(steps[2].status).toBe("current"); // DOCUMENTS
    expect(steps[3].status).toBe("upcoming"); // CLAIM_READY
  });

  it("marks every step upcoming for a LEAD who hasn't been contacted yet", () => {
    const steps = buildStepperView("LEAD");
    expect(steps.every((s) => s.status === "upcoming")).toBe(true);
  });

  it("marks every step upcoming for an exit state rather than guessing progress", () => {
    const steps = buildStepperView("WITHDRAWN");
    expect(steps.every((s) => s.status === "upcoming")).toBe(true);
  });

  it("marks the final step current once paid", () => {
    const steps = buildStepperView("PAID");
    expect(steps[5].status).toBe("current");
    expect(steps.slice(0, 5).every((s) => s.status === "done")).toBe(true);
  });
});

describe("buildRecoverySummary", () => {
  it("computes amount to claimant when both figures are known", () => {
    const summary = buildRecoverySummary(8_750_000, 875_000);
    expect(summary.estimatedToClaimantCents).toBe(7_875_000);
  });

  it("never fabricates an amount-to-claimant figure without a real fee", () => {
    const summary = buildRecoverySummary(8_750_000, null);
    expect(summary.estimatedToClaimantCents).toBeNull();
  });
});

describe("buildPortalCaseView", () => {
  it("assembles the full view from raw case facts", () => {
    const view = buildPortalCaseView({
      claimantStatus: "DOCUMENTS_REQUESTED",
      documents: [],
      estimatedRecoveryCents: 8_750_000,
      feeAmountCents: null,
    });
    expect(view.stepper).toHaveLength(6);
    expect(view.missingRequiredDocuments.length).toBeGreaterThan(0);
    expect(view.recoverySummary.estimatedRecoveryCents).toBe(8_750_000);
  });
});
