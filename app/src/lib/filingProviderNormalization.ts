// Provider response normalization + confirmation verification -- doc
// 08 sections 31-33. PLAN.md P7-14.
//
// "Different providers will use different statuses. Normalize them
// into: SUBMITTED, RECEIVED, PROCESSING, PENDING, ACCEPTED, REJECTED,
// FAILED, UNKNOWN. Store both the normalized status AND the raw
// provider status -- never discard the provider's original response.
// Do not treat a network response alone as proof of successful filing.
// Where possible verify: provider confirmation, external filing ID,
// submission status, receipt, provider portal/API status. If
// uncertain: FILING_STATUS = UNKNOWN and create human review."

// doc 08 section 31's own normalized vocabulary, verbatim.
export type NormalizedProviderStatus =
  | "SUBMITTED"
  | "RECEIVED"
  | "PROCESSING"
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "FAILED"
  | "UNKNOWN";

export interface ProviderStatusMapping {
  connectorId: string;
  rawStatus: string;
  normalizedStatus: NormalizedProviderStatus;
}

export interface NormalizedProviderResponse {
  normalizedStatus: NormalizedProviderStatus;
  rawStatus: string;
  // Never discarded -- doc 08 section 31's explicit instruction.
  rawResponse: unknown;
}

/**
 * Pure: doc 08 section 31. Looks up a configured mapping for this
 * connector's exact raw status string; an unrecognized raw status
 * fails closed to UNKNOWN rather than being guessed into one of the
 * known outcomes -- same discipline as classifyConflictSeverity()'s
 * (P5-6) fail-closed-to-CRITICAL for an unconfigured field. The raw
 * response is always preserved on the result regardless of whether the
 * status was recognized.
 */
export function normalizeProviderStatus(
  connectorId: string,
  rawStatus: string,
  rawResponse: unknown,
  mappings: readonly ProviderStatusMapping[]
): NormalizedProviderResponse {
  const mapping = mappings.find((m) => m.connectorId === connectorId && m.rawStatus === rawStatus);
  return {
    normalizedStatus: mapping?.normalizedStatus ?? "UNKNOWN",
    rawStatus,
    rawResponse,
  };
}

// --- Confirmation verification (doc 08 section 33) --------------------

export interface ConfirmationVerificationInput {
  networkResponseReceived: boolean;
  externalFilingIdPresent: boolean;
  confirmationNumberPresent: boolean;
  receiptAvailable: boolean;
  // e.g. the provider's own portal/API separately confirms the
  // submission exists, independent of the immediate response.
  providerStatusConfirmedIndependently: boolean;
}

export type ConfirmationVerificationResult = "VERIFIED" | "UNCERTAIN_REQUIRES_REVIEW";

/**
 * Pure: doc 08 section 33. A bare network response is never
 * sufficient on its own -- verification requires an external filing ID
 * plus at least one independent corroborating signal (a confirmation
 * number, a receipt, or an independently-confirmed provider status).
 * Anything short of that is UNCERTAIN_REQUIRES_REVIEW, which a caller
 * maps directly to FILING_STATUS = UNKNOWN + human review, per the
 * doc's own instruction.
 */
export function verifyFilingConfirmation(
  input: ConfirmationVerificationInput
): ConfirmationVerificationResult {
  const hasCorroboratingSignal =
    input.confirmationNumberPresent || input.receiptAvailable || input.providerStatusConfirmedIndependently;

  if (input.externalFilingIdPresent && hasCorroboratingSignal) {
    return "VERIFIED";
  }

  return "UNCERTAIN_REQUIRES_REVIEW";
}
