// Currency + rounding + adjustments -- doc 10 sections 59-63. PLAN.md
// P9-18.
//
// "Support currency explicitly -- every financial amount must have an
// amount and a currency. Do not assume USD. If currency conversion is
// required, store: original amount, original currency, converted
// amount, conversion rate, rate timestamp, rate source -- never
// overwrite the original transaction amount. Define deterministic
// financial rounding: precision, rounding method, rule version -- the
// same calculation must produce the same result. Create an Adjustment
// model (CREDIT/DEBIT/CORRECTION/REFUND/OTHER); all adjustments require
// appropriate authorization. Never allow silent fee/balance/payment/
// recovery/distribution changes."
//
// AI financial assistance (section 63 -- explaining variances,
// classifying references, drafting reminders) itself needs an
// AIProvider (blocked, no vendor account exists yet); by design it
// must never independently change a fee, approve a distribution, issue
// a refund, or move money regardless of whether AI assistance is ever
// wired in -- those stay deterministic-rule-and/or-human-approval-only,
// which is exactly what createAdjustment() below enforces structurally
// (an adjustment is never created without an authorized approver).

export interface MoneyAmount {
  amountCents: number;
  currency: string;
}

export interface CurrencyConversion {
  originalAmountCents: number;
  originalCurrency: string;
  convertedAmountCents: number;
  convertedCurrency: string;
  conversionRate: number;
  rateTimestamp: string;
  rateSource: string;
}

/**
 * Pure: doc 10 section 59. Returns a new record -- the original
 * amount/currency are preserved on the result itself, never mutated or
 * discarded, so a later reader can always see both the original figure
 * and what it converted to.
 */
export function convertCurrency(
  original: MoneyAmount,
  targetCurrency: string,
  conversionRate: number,
  rateTimestamp: string,
  rateSource: string
): CurrencyConversion {
  return {
    originalAmountCents: original.amountCents,
    originalCurrency: original.currency,
    convertedAmountCents: Math.round(original.amountCents * conversionRate),
    convertedCurrency: targetCurrency,
    conversionRate,
    rateTimestamp,
    rateSource,
  };
}

// --- Deterministic rounding (doc 10 section 60) -------------------------

export type RoundingMethod = "UP" | "DOWN" | "HALF_UP" | "HALF_EVEN";

export interface RoundingRule {
  version: string;
  method: RoundingMethod;
}

/**
 * Pure: doc 10 section 60. Rounds a fractional-cents value (e.g. the
 * raw result of a percentage calculation) to a whole number of cents
 * per the configured method -- the same input and rule always produce
 * the same output, no randomness, no floating-point-order dependence.
 */
export function applyRounding(fractionalCents: number, rule: RoundingRule): number {
  switch (rule.method) {
    case "UP":
      return Math.ceil(fractionalCents);
    case "DOWN":
      return Math.floor(fractionalCents);
    case "HALF_UP":
      return Math.round(fractionalCents);
    case "HALF_EVEN": {
      const floor = Math.floor(fractionalCents);
      const remainder = fractionalCents - floor;
      if (remainder < 0.5) return floor;
      if (remainder > 0.5) return floor + 1;
      return floor % 2 === 0 ? floor : floor + 1;
    }
  }
}

// --- Adjustments (doc 10 section 61) -------------------------------------

export type AdjustmentType = "CREDIT" | "DEBIT" | "CORRECTION" | "REFUND" | "OTHER";

export interface AdjustmentRecord {
  type: AdjustmentType;
  amountCents: number;
  reason: string;
  approvedBy: string;
  createdAt: string;
}

export interface CreateAdjustmentResult {
  status: "CREATED" | "REJECTED_MISSING_AUTHORIZATION";
  adjustment?: AdjustmentRecord;
}

/**
 * Pure: doc 10 section 61. "All adjustments require appropriate
 * authorization" is enforced structurally -- an adjustment is never
 * created without a non-empty reason AND a non-empty approver, no
 * exceptions for any AdjustmentType including OTHER.
 */
export function createAdjustment(
  type: AdjustmentType,
  amountCents: number,
  reason: string,
  approvedBy: string,
  createdAt: string
): CreateAdjustmentResult {
  if (!reason.trim() || !approvedBy.trim()) {
    return { status: "REJECTED_MISSING_AUTHORIZATION" };
  }

  return { status: "CREATED", adjustment: { type, amountCents, reason, approvedBy, createdAt } };
}
