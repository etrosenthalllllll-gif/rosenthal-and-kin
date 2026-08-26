import { describe, it, expect } from "vitest";
import {
  canSendOnChannel,
  applyOptOutSignal,
  type PersonCommunicationPreferences,
} from "./communicationPreferences";

function prefs(overrides: Partial<PersonCommunicationPreferences> = {}): PersonCommunicationPreferences {
  return {
    emailAllowed: true,
    smsAllowed: true,
    voiceAllowed: true,
    mailAllowed: true,
    doNotContact: false,
    ...overrides,
  };
}

describe("canSendOnChannel", () => {
  it("allows a channel that's enabled and not globally opted out", () => {
    const result = canSendOnChannel(prefs(), "EMAIL");
    expect(result.allowed).toBe(true);
  });

  it("blocks every channel when doNotContact is set, even if the channel flag is true", () => {
    const p = prefs({ doNotContact: true });
    for (const channel of ["EMAIL", "SMS", "VOICE", "MAIL"] as const) {
      const result = canSendOnChannel(p, channel);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/do-not-contact/i);
    }
  });

  it("blocks a specific channel that's individually disabled while doNotContact is false", () => {
    const result = canSendOnChannel(prefs({ smsAllowed: false }), "SMS");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/opted out/i);
  });

  it("does not let a disabled channel's flag leak into another channel's decision", () => {
    const p = prefs({ smsAllowed: false });
    expect(canSendOnChannel(p, "EMAIL").allowed).toBe(true);
  });
});

describe("applyOptOutSignal", () => {
  it("DO_NOT_CONTACT sets the centralized flag regardless of which channel it arrived on", () => {
    const result = applyOptOutSignal(prefs(), "DO_NOT_CONTACT", "SMS");
    expect(result.doNotContact).toBe(true);
  });

  it("UNSUBSCRIBE only disables the one channel it arrived on, leaving others untouched (doc 04's own SMS example)", () => {
    const result = applyOptOutSignal(prefs(), "UNSUBSCRIBE", "SMS");
    expect(result.smsAllowed).toBe(false);
    expect(result.emailAllowed).toBe(true);
    expect(result.voiceAllowed).toBe(true);
    expect(result.mailAllowed).toBe(true);
    expect(result.doNotContact).toBe(false);
  });

  it("does not mutate the input preferences object", () => {
    const original = prefs();
    const frozenCopy = { ...original };
    applyOptOutSignal(original, "DO_NOT_CONTACT", "EMAIL");
    expect(original).toEqual(frozenCopy);
  });

  it("UNSUBSCRIBE on EMAIL disables only email", () => {
    const result = applyOptOutSignal(prefs(), "UNSUBSCRIBE", "EMAIL");
    expect(result.emailAllowed).toBe(false);
    expect(result.smsAllowed).toBe(true);
  });
});
