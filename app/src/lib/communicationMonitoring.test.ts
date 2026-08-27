import { describe, it, expect } from "vitest";
import {
  computeEmailMetrics,
  detectAbnormalBounceRate,
  computeSmsMetrics,
  computeVoiceMetrics,
  evaluateCommunicationFailureSeverity,
  detectRepeatedProviderFailure,
} from "./communicationMonitoring";

describe("email metrics", () => {
  it("computes bounce and delivery rates", () => {
    const metrics = computeEmailMetrics({
      queued: 1000,
      sent: 1000,
      delivered: 980,
      bounced: 20,
      failed: 0,
      providerErrors: 0,
      rateLimited: 0,
      suppressions: 0,
      complaints: 0,
      unsubscribes: 5,
    });
    expect(metrics.bounceRatePercent).toBe(2);
    expect(metrics.deliveryRatePercent).toBe(98);
  });
});

describe("abnormal bounce rate detection", () => {
  it("matches the doc's own worked example (normal 2%, current 18%)", () => {
    expect(detectAbnormalBounceRate(2, 18)).toBe(true);
  });
});

describe("SMS metrics", () => {
  it("computes delivery/failure rates", () => {
    const metrics = computeSmsMetrics({ sent: 500, delivered: 490, failed: 10, carrierErrors: 2, rateLimited: 0, optOuts: 3 });
    expect(metrics.deliveryRatePercent).toBe(98);
  });
});

describe("voice metrics", () => {
  it("computes call completion rate", () => {
    const metrics = computeVoiceMetrics({
      callsInitiated: 200,
      callsConnected: 150,
      callsFailed: 50,
      transcriptionFailures: 2,
      classificationFailures: 1,
      agentFailures: 0,
      transferFailures: 0,
    });
    expect(metrics.completionRatePercent).toBe(75);
  });
});

describe("communication failure severity", () => {
  it("matches the doc's own worked example (100 attempted, 70 failures -> CRITICAL)", () => {
    expect(evaluateCommunicationFailureSeverity(100, 70)).toBe("CRITICAL");
  });

  it("is NORMAL under the critical threshold", () => {
    expect(evaluateCommunicationFailureSeverity(100, 5)).toBe("NORMAL");
  });
});

describe("repeated provider failure detection", () => {
  it("flags once the consecutive-failure threshold is reached", () => {
    expect(detectRepeatedProviderFailure(5, 5)).toBe(true);
    expect(detectRepeatedProviderFailure(4, 5)).toBe(false);
  });
});
