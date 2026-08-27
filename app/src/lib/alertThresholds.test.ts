import { describe, it, expect } from "vitest";
import { getConfiguredThreshold, resolveNotificationChannels, selectSafeNotificationChannels } from "./alertThresholds";

describe("configurable threshold lookup", () => {
  it("returns the configured value when present", () => {
    expect(getConfiguredThreshold("apiErrorRatePercent", { apiErrorRatePercent: 10 }, 5)).toBe(10);
  });

  it("falls back to the caller-supplied default when unconfigured", () => {
    expect(getConfiguredThreshold("apiErrorRatePercent", {}, 5)).toBe(5);
  });
});

describe("notification channels by severity", () => {
  it("matches the doc's own worked example for each severity", () => {
    expect(resolveNotificationChannels("WARNING")).toEqual(["DASHBOARD"]);
    expect(resolveNotificationChannels("CRITICAL")).toEqual(["DASHBOARD", "EMAIL", "SMS"]);
    expect(resolveNotificationChannels("EMERGENCY")).toEqual(["DASHBOARD", "IMMEDIATE_OPERATOR", "ESCALATION"]);
  });
});

describe("safe channel selection", () => {
  it("strips a channel whose provider is failing", () => {
    const channels = selectSafeNotificationChannels(["DASHBOARD", "EMAIL", "SMS"], new Set(["EMAIL_PROVIDER"]));
    expect(channels).toEqual(["DASHBOARD", "SMS"]);
  });

  it("never strips channels with no provider dependency, even if every external provider fails", () => {
    const channels = selectSafeNotificationChannels(
      ["DASHBOARD", "EMAIL", "SMS", "IMMEDIATE_OPERATOR"],
      new Set(["EMAIL_PROVIDER", "SMS_PROVIDER"])
    );
    expect(channels).toEqual(["DASHBOARD", "IMMEDIATE_OPERATOR"]);
  });
});
