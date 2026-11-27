/**
 * Billing party, address and tax number check, and terms acceptance (AJA-1785, AJA-1733).
 *
 * Source contracts are in the `metafrappe/backend` repository (AJA-1776):
 * - `contracts/billing_identity.schema.json`: the billing country selects the address format.
 *   The screen language never selects it.
 * - `contracts/terms_acceptance.schema.json`: an acceptance is a new record. It keeps the version
 *   and the language of the text that the user saw.
 *
 * The backend has no OpenAPI path for these screens yet. `BillingClient` is the screen's view of
 * the calls. The shared API client wires it once the backend publishes the paths.
 */
import type { RequestOptions } from '../runtime';

/** Copy of `x-address-formats` in `billing_identity.schema.json`. `model.test.ts` pins it. */
export const ADDRESS_FORMATS = {
  TR: {
    fields: ['line1', 'line2', 'district', 'province', 'postal_code'],
    required: ['line1', 'district', 'province'],
  },
  default: {
    fields: ['line1', 'line2', 'city', 'region', 'postal_code'],
    required: ['line1', 'city'],
  },
} as const satisfies Record<
  string,
  { fields: readonly AddressField[]; required: readonly AddressField[] }
>;

export type AddressField =
  'line1' | 'line2' | 'district' | 'province' | 'city' | 'region' | 'postal_code';

export interface AddressFormat {
  fields: readonly AddressField[];
  required: readonly AddressField[];
}

/** The address format of a billing country. Unknown countries use the default format. */
export function addressFormat(country: string): AddressFormat {
  return country === 'TR' ? ADDRESS_FORMATS.TR : ADDRESS_FORMATS.default;
}

/**
 * Billing countries on the screen. The open market is `TR` only (A Takımı PO). Other countries
 * use the default format; they show that the form follows the billing country.
 */
export const BILLING_COUNTRIES = ['TR', 'GB', 'DE', 'US'] as const;
export type BillingCountry = (typeof BILLING_COUNTRIES)[number];

export type PartyKind = 'person' | 'company';

export interface BillingDraft {
  kind: PartyKind;
  name: string;
  taxId: string;
  country: string;
  address: Partial<Record<AddressField, string>>;
}

export interface BillingInput {
  party: { kind: PartyKind; name: string; tax_id: string | null };
  billing_address: { billing_country: string } & Partial<Record<AddressField, string | null>>;
}

export type TaxIdResult = 'valid' | 'invalid' | 'unavailable';

export interface TaxIdCheck {
  result: TaxIdResult;
  checked_at: string;
  billing_country?: string;
}

export interface SavedBilling {
  tax_id_check?: TaxIdCheck | null;
}

/** Languages of the terms text. The open languages are `en` and `tr` (A Takımı PO). */
export type TermsLocale = 'en' | 'tr';

export interface TermsText {
  terms_id: string;
  terms_version: string;
  locale: TermsLocale;
  title: string;
  body: string;
}

export interface TermsAcceptanceInput {
  terms_id: string;
  terms_version: string;
  shown_locale: string;
}

export interface TermsAcceptance extends TermsAcceptanceInput {
  acceptance_id: string;
  user: string;
  accepted_at: string;
}

export interface BillingClient {
  /** A refused draft throws. A silent tax service gives `unavailable`, the draft is still saved. */
  saveBillingDraft: (input: BillingInput, options: RequestOptions) => Promise<SavedBilling>;
  getTerms: (termsId: string, locale: TermsLocale, options: RequestOptions) => Promise<TermsText>;
  acceptTerms: (input: TermsAcceptanceInput, options: RequestOptions) => Promise<TermsAcceptance>;
}

export const TERMS_ID = 'terms-of-use';

/** Error keys are the backend's English source sentences (`billing_identity.py`, `MESSAGE_KEYS`). */
export const FIELD_ERRORS = {
  name: 'Enter the name or the company title.',
  country: 'Choose the billing country.',
  line1: 'Enter the street address.',
  district: 'Enter the district.',
  province: 'Enter the province.',
  city: 'Enter the city.',
  region: 'Enter the region.',
  postal_code: 'Enter the postal code.',
} as const;

export type FieldErrorKey = (typeof FIELD_ERRORS)[keyof typeof FIELD_ERRORS];
export type DraftField = 'name' | 'country' | AddressField;

/**
 * Checks the draft before it is sent. The server checks it again.
 * A name is one field. A one-part name such as "Madonna" is valid.
 */
export function validateDraft(draft: BillingDraft): Partial<Record<DraftField, FieldErrorKey>> {
  const errors: Partial<Record<DraftField, FieldErrorKey>> = {};
  if (!draft.name.trim()) errors.name = FIELD_ERRORS.name;
  if (!/^[A-Z]{2}$/.test(draft.country)) {
    errors.country = FIELD_ERRORS.country;
    return errors;
  }
  for (const field of addressFormat(draft.country).required) {
    if (!draft.address[field]?.trim())
      errors[field] = FIELD_ERRORS[field as keyof typeof FIELD_ERRORS];
  }
  return errors;
}

/** Only the fields of the country's format are sent. A hidden field never reaches the server. */
export function buildBillingInput(draft: BillingDraft): BillingInput {
  const address: BillingInput['billing_address'] = { billing_country: draft.country };
  for (const field of addressFormat(draft.country).fields) {
    address[field] = draft.address[field]?.trim() || null;
  }
  return {
    party: { kind: draft.kind, name: draft.name.trim(), tax_id: draft.taxId.trim() || null },
    billing_address: address,
  };
}

/** The acceptance carries the version and language of the text on the screen, not the account language. */
export function acceptanceInput(shown: TermsText): TermsAcceptanceInput {
  return {
    terms_id: shown.terms_id,
    terms_version: shown.terms_version,
    shown_locale: shown.locale,
  };
}
