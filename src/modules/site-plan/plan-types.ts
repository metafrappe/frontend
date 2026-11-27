/**
 * Shape of the plan detail data (AJA-1744).
 * The server contract is not ready yet (AJA-1731, AJA-1732). The fixture in `plan-fixture.ts` uses this shape.
 */

/** A feature value. Numbers and units are formatted with `Intl` in the user's language. */
export type PlanFeatureValue =
  | { kind: 'text'; text: string }
  | { kind: 'quantity'; amount: number; unit: string }
  | { kind: 'range'; min: number; max: number; unit: string };

export interface PlanFeature {
  /** Stable key. The label may change with the language; the key does not. */
  key: string;
  label: string;
  /** Language of the label, if it differs from the page. Example: `de`. */
  lang?: string;
  value: PlanFeatureValue;
}

/**
 * Tax status of the price. `unknown` until AJA-1731 delivers it.
 * The screen never shows "0.00" tax for an unknown status.
 */
export type PlanTaxStatus = 'included' | 'excluded' | 'unknown';

export interface PlanDetailData {
  /** Stable plan identity. The selection stores this value, never the display name. */
  id: string;
  /** Full display name. */
  name: string;
  /** Language of the name. Example: `de`. Long words are hyphenated with this language's rules. */
  nameLang?: string;
  /** Distinguishing last part of the name. Example: "Plus 10". It is never shortened. */
  variant: string;
  /** Distinguishing detail. Example: "10 users". */
  summary: string;
  price: { amount: number; currency: string; period: 'month' | 'year' };
  tax: PlanTaxStatus;
  features: readonly PlanFeature[];
  /** True for test data. The screen marks it so it is not mistaken for real data. */
  sample?: boolean;
}
