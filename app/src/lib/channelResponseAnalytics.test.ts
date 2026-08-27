import { describe, it, expect } from "vitest";
import { computeResponseRatePercent, computeEmailChannelMetrics, computeSmsChannelMetrics, computePhoneChannelMetrics } from "./channelResponseAnalytics";

describe("generic response rate", () => {
  it("computes responses over delivered", () => {
    expect(computeResponseRatePercent(100, 1000)).toBe(10);
  });
});

describe("email channel metrics", () => {
  it("computes response/qualified-response/case-conversion rates", () => {
    const metrics = computeEmailChannelMetrics({
      sent: 1000,
      delivered: 950,
      bounced: 50,
      replies: 100,
      positiveResponses: 60,
      negativeResponses: 40,
      optOuts: 5,
      caseConversions: 20,
      revenueAttributedCents: 500_000,
    });
    expect(metrics.responseRatePercent).toBeCloseTo(10.5, 1);
    expect(metrics.caseConversionRatePercent).toBe(20);
  });
});

describe("SMS channel metrics", () => {
  it("computes response and qualified-response rates", () => {
    const metrics = computeSmsChannelMetrics({
      sent: 500,
      delivered: 480,
      replies: 50,
      positiveReplies: 30,
      negativeReplies: 20,
      optOuts: 2,
      caseConversions: 5,
      revenueAttributedCents: 100_000,
    });
    expect(metrics.responseRatePercent).toBeCloseTo(10.4, 1);
  });
});

describe("phone channel metrics", () => {
  it("computes connect/voicemail/conversation/recovery rates", () => {
    const metrics = computePhoneChannelMetrics({
      callsAttempted: 200,
      callsConnected: 150,
      voicemails: 60,
      conversations: 90,
      qualifiedConversations: 40,
      callbacks: 10,
      successfulHandoffs: 30,
      casesCreated: 20,
      recoveries: 5,
      revenueAttributedCents: 200_000,
    });
    expect(metrics.connectRatePercent).toBe(75);
    expect(metrics.recoveryRatePercent).toBe(25);
  });
});
