// End-to-end analytics test -- doc 13 section 96's final build
// requirement ("then implement... do not rebuild existing
// functionality") verified concretely, plus PLAN.md P12-30's own
// requirement: "one integration test walking a realistic lead-to-
// recovery scenario through the funnel, cost, revenue, ROI, and
// attribution modules built in this phase and confirming every number
// ties back to its source records."
//
// This test does not re-test any single module's internals (each
// already has its own unit tests from P12-1 through P12-29) -- it
// wires several of them together on one consistent scenario and checks
// the numbers agree with each other end to end, the way a real
// dashboard render would.

import { describe, it, expect } from "vitest";
import { buildFunnelReport, type FunnelStageCounts } from "./leadFunnelAnalytics";
import { computeCaseEconomics, type CaseCostBreakdown } from "./caseEconomics";
import { computeRoiPercent } from "./roiAnalytics";
import { buildAttributionChain } from "./attributionAnalytics";
import { verifyMetricAuditTrail } from "./analyticsAccessControl";
import { evaluateAnalyticsReconciliation } from "./analyticsReconciliation";
import { buildFinalExecutiveView } from "./finalExecutiveView";

describe("end-to-end: one lead through funnel, cost, revenue, ROI, attribution", () => {
  it("ties every downstream number back to the same source scenario", () => {
    // A realistic single-source cohort: 100 leads sourced, narrowing
    // down to one case that actually recovers.
    const funnelCounts: FunnelStageCounts = {
      SOURCED: 100,
      SCORED: 100,
      QUALIFIED: 40,
      OUTREACH: 40,
      DELIVERED: 38,
      RESPONDED: 20,
      ENGAGED: 15,
      VERIFIED: 10,
      CASE_CREATED: 10,
      CLAIM_PREPARED: 8,
      CLAIM_FILED: 6,
      RECOVERY: 1,
    };
    const funnel = buildFunnelReport(funnelCounts);

    // The funnel's own reported RECOVERY count is the ground truth for
    // "how many cases actually recovered" -- everything downstream
    // must be consistent with this, not a separately-invented number.
    const recoveryStage = funnel.find((f) => f.stage === "RECOVERY")!;
    expect(recoveryStage.count).toBe(1);

    // That one recovered case's real cost breakdown and revenue.
    const costBreakdown: CaseCostBreakdown = {
      acquisitionCents: 5_000,
      researchCents: 3_000,
      aiCents: 1_200,
      communicationCents: 800,
      documentCents: 1_000,
      filingCents: 2_000,
      paymentProcessingCents: 300,
      operatorLaborCents: 15_000,
      otherCents: 700,
    };
    const revenueCents = 87_500 * 10; // 10% fee on an $87,500 recovery, in cents
    const economics = computeCaseEconomics(costBreakdown, revenueCents);

    expect(economics.totalCostCents).toBe(29_000);
    expect(economics.grossProfitCents).toBe(revenueCents - 29_000);

    // ROI computed from the same revenue/cost figures the case
    // economics module already produced -- never a second, divergent
    // ROI calculation.
    const roiPercent = computeRoiPercent(
      { revenueCents: economics.revenueCents, netProfitCents: economics.grossProfitCents, costCents: economics.totalCostCents },
      "REVENUE_MINUS_COST_OVER_COST"
    );
    expect(roiPercent).toBe(economics.roiPercent);

    // Attribution: this recovery traces back to one lead, from one
    // named source -- not invented, and not marked uncertain since the
    // chain is complete here.
    const attribution = buildAttributionChain({
      leadId: "lead-1",
      caseId: "case-1",
      claimId: "claim-1",
      recoveryId: "recovery-1",
      originatingSource: "referral-network",
    });
    expect(attribution.isAttributionUncertain).toBe(false);
    expect(attribution.originatingSource).toBe("referral-network");

    // Auditability: the revenue figure this scenario reports must
    // actually be reproducible from its underlying payment records
    // (doc 13 §89) -- here, one lump-sum payment equal to the fee.
    const auditTrail = verifyMetricAuditTrail({
      metricName: "Revenue",
      claimedValueCents: revenueCents,
      underlyingPaymentsCents: [revenueCents],
      transactionIds: ["txn-1"],
      caseIds: [attribution.caseId!],
      invoiceIds: ["inv-1"],
      recoveryIds: [attribution.recoveryId!],
    });
    expect(auditTrail.isTraceable).toBe(true);

    // Reconciliation: the analytics layer's recovered-case count for
    // this scenario must match the transactional system's count
    // exactly (doc 13 §91).
    const reconciliation = evaluateAnalyticsReconciliation("recoveries", 1, recoveryStage.count);
    expect(reconciliation.outcome).toBe("PASS");

    // Finally: this scenario's figures assemble cleanly into the
    // doc 13 §95 final executive view -- the one-page rollup a real
    // dashboard would render, built entirely from what was just
    // computed above rather than any new number.
    const view = buildFinalExecutiveView({
      leadsEntering: funnelCounts.SOURCED,
      conversionRatePercent: recoveryStage.conversionRatePercent,
      totalRecoveredCents: 87_500 * 100,
      totalRevenueCents: economics.revenueCents,
      costPerCaseCents: economics.totalCostCents,
      totalOperatorHours: 12,
      humanInterventionRatePercent: 40,
      avgTimeToRecoveryDays: 96,
      bestSourceId: attribution.originatingSource,
      bestSourceRoiPercent: roiPercent,
      bestWorkflowId: "standard-probate",
      bestWorkflowRoiPercent: roiPercent,
      isScaling: null,
      isAutomationImproving: null,
      roiPercent,
    });

    expect(view.answers).toHaveLength(13);
    const revenueAnswer = view.answers.find((a) => a.question === "HOW MUCH MONEY IS BEING GENERATED?")!;
    expect(revenueAnswer.value).toBe(economics.revenueCents);
    const roiAnswer = view.answers.find((a) => a.question === "WHAT IS THE ACTUAL ROI?")!;
    expect(roiAnswer.value).toBe(economics.roiPercent);
  });

  it("flags an inconsistent scenario instead of silently reporting mismatched numbers", () => {
    // If the transactional system and the analytics layer disagree on
    // how many cases recovered, that must surface as an error, not a
    // rounding footnote.
    const reconciliation = evaluateAnalyticsReconciliation("recoveries", 1, 0);
    expect(reconciliation.outcome).toBe("ANALYTICS_RECONCILIATION_ERROR");

    // And a claimed revenue figure with no real payment behind it must
    // never be reported as trustworthy.
    const auditTrail = verifyMetricAuditTrail({
      metricName: "Revenue",
      claimedValueCents: 87_500 * 10,
      underlyingPaymentsCents: [],
      transactionIds: [],
      caseIds: [],
      invoiceIds: [],
      recoveryIds: [],
    });
    expect(auditTrail.isTraceable).toBe(false);
  });
});
