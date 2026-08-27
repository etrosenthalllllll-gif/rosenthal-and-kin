// Response-rate + channel analytics -- doc 13 sections 10-13.
// PLAN.md P12-6.
//
// "Track response rates by: email, SMS, phone, campaign, lead source,
// jurisdiction, letter type, outreach sequence, day/time, demographic/
// category where legally and ethically appropriate, message/template
// version. Avoid using protected characteristics or sensitive
// attributes for inappropriate optimization." / Email/SMS/phone
// analytics: full per-channel funnels through to revenue attributed.

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// doc 13 §10's own dimension list -- deliberately excludes any
// "demographic/category" dimension. The doc's own caveat ("where
// legally and ethically appropriate... avoid using protected
// characteristics") is honored here by simply never including one:
// this codebase doesn't optimize outreach on demographic attributes,
// so no such dimension exists to misuse.
export type ResponseRateDimension =
  | "EMAIL"
  | "SMS"
  | "PHONE"
  | "CAMPAIGN"
  | "LEAD_SOURCE"
  | "JURISDICTION"
  | "LETTER_TYPE"
  | "OUTREACH_SEQUENCE"
  | "DAY_OF_WEEK"
  | "TEMPLATE_VERSION";

export function computeResponseRatePercent(responses: number, delivered: number): number | null {
  return ratePercent(responses, delivered);
}

// --- Email analytics (doc 13 §11) -------------------------------------------

export interface EmailChannelCounts {
  sent: number;
  delivered: number;
  bounced: number;
  opened?: number;
  replies: number;
  positiveResponses: number;
  negativeResponses: number;
  optOuts: number;
  caseConversions: number;
  revenueAttributedCents: number;
}

export interface EmailChannelMetrics extends EmailChannelCounts {
  responseRatePercent: number | null;
  qualifiedResponseRatePercent: number | null;
  caseConversionRatePercent: number | null;
}

export function computeEmailChannelMetrics(counts: EmailChannelCounts): EmailChannelMetrics {
  return {
    ...counts,
    responseRatePercent: ratePercent(counts.replies, counts.delivered),
    qualifiedResponseRatePercent: ratePercent(counts.positiveResponses, counts.delivered),
    caseConversionRatePercent: ratePercent(counts.caseConversions, counts.replies),
  };
}

// --- SMS analytics (doc 13 §12) ----------------------------------------------

export interface SmsChannelCounts {
  sent: number;
  delivered: number;
  replies: number;
  positiveReplies: number;
  negativeReplies: number;
  optOuts: number;
  caseConversions: number;
  revenueAttributedCents: number;
}

export interface SmsChannelMetrics extends SmsChannelCounts {
  responseRatePercent: number | null;
  qualifiedResponseRatePercent: number | null;
}

export function computeSmsChannelMetrics(counts: SmsChannelCounts): SmsChannelMetrics {
  return {
    ...counts,
    responseRatePercent: ratePercent(counts.replies, counts.delivered),
    qualifiedResponseRatePercent: ratePercent(counts.positiveReplies, counts.delivered),
  };
}

// --- Phone analytics (doc 13 §13) --------------------------------------------

export interface PhoneChannelCounts {
  callsAttempted: number;
  callsConnected: number;
  voicemails: number;
  conversations: number;
  qualifiedConversations: number;
  callbacks: number;
  successfulHandoffs: number;
  casesCreated: number;
  recoveries: number;
  revenueAttributedCents: number;
}

export interface PhoneChannelMetrics extends PhoneChannelCounts {
  connectRatePercent: number | null;
  voicemailRatePercent: number | null;
  conversationRatePercent: number | null;
  recoveryRatePercent: number | null;
}

export function computePhoneChannelMetrics(counts: PhoneChannelCounts): PhoneChannelMetrics {
  return {
    ...counts,
    connectRatePercent: ratePercent(counts.callsConnected, counts.callsAttempted),
    voicemailRatePercent: ratePercent(counts.voicemails, counts.callsConnected),
    conversationRatePercent: ratePercent(counts.conversations, counts.callsConnected),
    recoveryRatePercent: ratePercent(counts.recoveries, counts.casesCreated),
  };
}
