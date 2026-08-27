// Email/SMS/voice monitoring + communication failure detection --
// doc 12 sections 29-33. PLAN.md P11-11.
//
// "Monitor: emails queued/sent/delivered, bounces, failures, provider
// errors, rate limits, delivery latency, suppressions, complaints,
// unsubscribes." / "Detect abnormal bounce rate... normal 2%, current
// 18% -> EMAIL_DELIVERY_ALERT." / SMS: sent/delivered/failed/carrier
// errors/opt-outs. / Voice: calls initiated/connected/failed/duration/
// transcription/classification/agent/transfer failures/completion
// rate. / "Detect patterns such as 100 calls attempted, 70 failures ->
// CRITICAL COMMUNICATION ALERT. Also detect repeated failure to the
// same provider."
//
// Abnormal-rate detection reuses workflowMonitoring.ts's
// `detectFailureSpike()` -- the doc's "normal 2%, current 18%" bounce-
// rate example is the same baseline-vs-current-with-floor shape
// already built for failure-rate spikes, just applied to a bounce
// rate instead of a raw failure count.

import { detectFailureSpike, type SpikeDetectionConfig } from "./workflowMonitoring";

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// --- Email monitoring (doc 12 §29-30) ---------------------------------------

export interface EmailMetricsCounts {
  queued: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  providerErrors: number;
  rateLimited: number;
  suppressions: number;
  complaints: number;
  unsubscribes: number;
}

export interface EmailMetrics extends EmailMetricsCounts {
  bounceRatePercent: number | null;
  deliveryRatePercent: number | null;
}

export function computeEmailMetrics(counts: EmailMetricsCounts): EmailMetrics {
  return {
    ...counts,
    bounceRatePercent: ratePercent(counts.bounced, counts.sent),
    deliveryRatePercent: ratePercent(counts.delivered, counts.sent),
  };
}

/**
 * Pure: doc 12 §30's own worked example (normal bounce rate 2%,
 * current 18%). Delegates to detectFailureSpike() -- same shape,
 * applied to a bounce-rate percentage instead of a raw count.
 */
export function detectAbnormalBounceRate(
  baselineBounceRatePercent: number,
  currentBounceRatePercent: number,
  config?: SpikeDetectionConfig
): boolean {
  return detectFailureSpike(baselineBounceRatePercent, currentBounceRatePercent, config);
}

// --- SMS monitoring (doc 12 §31) --------------------------------------------

export interface SmsMetricsCounts {
  sent: number;
  delivered: number;
  failed: number;
  carrierErrors: number;
  rateLimited: number;
  optOuts: number;
}

export interface SmsMetrics extends SmsMetricsCounts {
  deliveryRatePercent: number | null;
  failureRatePercent: number | null;
}

export function computeSmsMetrics(counts: SmsMetricsCounts): SmsMetrics {
  return {
    ...counts,
    deliveryRatePercent: ratePercent(counts.delivered, counts.sent),
    failureRatePercent: ratePercent(counts.failed, counts.sent),
  };
}

// --- Voice monitoring (doc 12 §32) ------------------------------------------

export interface VoiceMetricsCounts {
  callsInitiated: number;
  callsConnected: number;
  callsFailed: number;
  transcriptionFailures: number;
  classificationFailures: number;
  agentFailures: number;
  transferFailures: number;
}

export interface VoiceMetrics extends VoiceMetricsCounts {
  completionRatePercent: number | null;
}

export function computeVoiceMetrics(counts: VoiceMetricsCounts): VoiceMetrics {
  return {
    ...counts,
    completionRatePercent: ratePercent(counts.callsConnected, counts.callsInitiated),
  };
}

// --- Communication failure detection (doc 12 §33) ---------------------------

export type CommunicationAlertSeverity = "NORMAL" | "CRITICAL";

/**
 * Pure: doc 12 §33's own worked example (100 attempted, 70 failures).
 * Reuses the same warning/critical threshold shape as
 * workflowMonitoring.ts's classifyFailureRate() rather than a bespoke
 * comparison.
 */
export function evaluateCommunicationFailureSeverity(
  attempted: number,
  failed: number,
  criticalFailureRatePercent = 50
): CommunicationAlertSeverity {
  const rate = ratePercent(failed, attempted);
  return rate !== null && rate >= criticalFailureRatePercent ? "CRITICAL" : "NORMAL";
}

/**
 * Pure: doc 12 §33 -- "also detect repeated failure to the same
 * provider," independent of the overall attempt volume.
 */
export function detectRepeatedProviderFailure(consecutiveFailures: number, threshold: number): boolean {
  return consecutiveFailures >= threshold;
}
