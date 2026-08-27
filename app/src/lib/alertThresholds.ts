// Alert thresholds + escalation + notifications -- doc 12 sections
// 49-51. PLAN.md P11-17.
//
// "All thresholds should be configurable... Do not hardcode values." /
// "Alert created -> notification -> acknowledgment -> escalation if
// unresolved. WARNING: dashboard notification. CRITICAL: dashboard +
// email/SMS. EMERGENCY: dashboard + immediate operator notification +
// escalation." / "Support notifications through in-app dashboard,
// email, SMS, other channels. Avoid using a failing communication
// provider as the sole notification mechanism for failures involving
// that provider."

import type { AlertSeverity } from "./alertEngine";

export type ConfigurableThresholdTable = Readonly<Record<string, number>>;

/**
 * Pure: doc 12 §49's own list (API error rate, queue depth, workflow
 * failure rate, etc.) reduced to one generic lookup -- every one of
 * those checks is "does this metric exceed its configured threshold,"
 * so callers configure a table rather than this module hardcoding any
 * of the doc's example numbers.
 */
export function getConfiguredThreshold(
  metricKey: string,
  table: ConfigurableThresholdTable,
  fallback: number
): number {
  return table[metricKey] ?? fallback;
}

// --- Notification channels by severity (doc 12 §50) -------------------------

export type NotificationChannel = "DASHBOARD" | "EMAIL" | "SMS" | "IMMEDIATE_OPERATOR" | "ESCALATION";

export type NotificationChannelTable = Readonly<Record<AlertSeverity, readonly NotificationChannel[]>>;

// doc 12 §50's own worked example, verbatim -- configurable, not
// hardcoded into the escalation logic itself.
export const DEFAULT_NOTIFICATION_CHANNELS: NotificationChannelTable = {
  INFO: ["DASHBOARD"],
  WARNING: ["DASHBOARD"],
  ERROR: ["DASHBOARD"],
  CRITICAL: ["DASHBOARD", "EMAIL", "SMS"],
  EMERGENCY: ["DASHBOARD", "IMMEDIATE_OPERATOR", "ESCALATION"],
};

export function resolveNotificationChannels(
  severity: AlertSeverity,
  table: NotificationChannelTable = DEFAULT_NOTIFICATION_CHANNELS
): readonly NotificationChannel[] {
  return table[severity];
}

// --- Safe channel selection (doc 12 §51) ------------------------------------

const CHANNEL_PROVIDER: Readonly<Partial<Record<NotificationChannel, string>>> = {
  EMAIL: "EMAIL_PROVIDER",
  SMS: "SMS_PROVIDER",
};

/**
 * Pure: doc 12 §51 -- "avoid using a failing communication provider as
 * the sole notification mechanism for failures involving that
 * provider." Strips any channel whose own underlying provider is in
 * the failing set; DASHBOARD/IMMEDIATE_OPERATOR/ESCALATION have no
 * provider dependency and are never stripped, so there's always at
 * least one channel left even if every external provider is down.
 */
export function selectSafeNotificationChannels(
  channels: readonly NotificationChannel[],
  failingProviders: ReadonlySet<string>
): NotificationChannel[] {
  return channels.filter((channel) => {
    const provider = CHANNEL_PROVIDER[channel];
    return !provider || !failingProviders.has(provider);
  });
}
