// Communication preferences / opt-out / do-not-contact -- doc 04
// section 19. PLAN.md P3-6.
//
// "A person should have communication preferences... and:
// DO_NOT_CONTACT... Support channel-specific opt-outs. For example: SMS
// opt-out should prevent future automated SMS communications while
// potentially allowing permitted other channels... If the person
// requests no further contact: Set centralized DO_NOT_CONTACT. All
// outbound communication workflows must check this status before
// sending. Do not rely solely on the individual channel system."
//
// The per-Person preference fields already exist on the Prisma schema
// (P3-1: emailAllowed/smsAllowed/voiceAllowed/mailAllowed/doNotContact).
// This module is the enforcement + state-transition logic that sits on
// top of them -- pure, no DB access, same split as every other lib
// module this phase.

import type { CommunicationChannel } from "./communicationTimeline";

export interface PersonCommunicationPreferences {
  emailAllowed: boolean;
  smsAllowed: boolean;
  voiceAllowed: boolean;
  mailAllowed: boolean;
  doNotContact: boolean;
}

export interface SendPermissionResult {
  allowed: boolean;
  reason: string;
}

const CHANNEL_FLAG: Record<CommunicationChannel, keyof PersonCommunicationPreferences> = {
  EMAIL: "emailAllowed",
  SMS: "smsAllowed",
  VOICE: "voiceAllowed",
  MAIL: "mailAllowed",
};

/**
 * The single check every outbound communication workflow must call
 * before sending, per doc 04 section 19's explicit instruction --
 * "do not rely solely on the individual channel system." Centralized
 * DO_NOT_CONTACT always wins regardless of the per-channel flags.
 */
export function canSendOnChannel(
  prefs: PersonCommunicationPreferences,
  channel: CommunicationChannel
): SendPermissionResult {
  if (prefs.doNotContact) {
    return { allowed: false, reason: "Person has a centralized do-not-contact status." };
  }

  const flagKey = CHANNEL_FLAG[channel];
  if (!prefs[flagKey]) {
    return { allowed: false, reason: `Person has opted out of the ${channel} channel.` };
  }

  return { allowed: true, reason: `${channel} is permitted.` };
}

// The two opt-out signals doc 04 section 19 distinguishes: a full
// do-not-contact request (centralized, every channel) vs. a
// channel-specific unsubscribe (that one channel only). These map
// directly onto communicationClassification.ts's DO_NOT_CONTACT and
// UNSUBSCRIBE categories -- the classifier's output feeds straight into
// this function's `signal` argument.
export type OptOutSignal = "DO_NOT_CONTACT" | "UNSUBSCRIBE";

/**
 * Pure state transition: applies an opt-out signal to a person's
 * preferences and returns the updated preferences. Never mutates the
 * input. A DO_NOT_CONTACT signal is centralized and channel-independent
 * (the `channel` it arrived on is irrelevant to its effect); an
 * UNSUBSCRIBE signal only ever touches the one channel it arrived on,
 * per doc 04's own SMS-opt-out example -- other channels stay exactly
 * as they were.
 */
export function applyOptOutSignal(
  prefs: PersonCommunicationPreferences,
  signal: OptOutSignal,
  channel: CommunicationChannel
): PersonCommunicationPreferences {
  if (signal === "DO_NOT_CONTACT") {
    return { ...prefs, doNotContact: true };
  }

  const flagKey = CHANNEL_FLAG[channel];
  return { ...prefs, [flagKey]: false };
}
