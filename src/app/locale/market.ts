/**
 * Language, market and measurement fields of the boot data (AJA-1732).
 * The contract is the `Locale` schema in `platform_core-shell.openapi.yaml` (metafrappe/backend, AJA-1766).
 * Money, time zone and measurement system come from these fields, never from the UI language.
 * Old servers do not send the `locale` field. Then the old `user.language` and `formatting` fields apply.
 */

export type MeasurementSystem = 'metric' | 'imperial';

/** The `locale` field of the boot data. Every value is a separate field. */
export interface BootLocale {
  /** Full language tag. Example: `en-GB`. */
  language_tag: string;
  /** Language. Example: `en`. */
  language: string;
  /** Region. Example: `GB`. */
  region: string;
  /** The user's IANA time zone. Example: `Europe/London`. */
  time_zone: string;
  /** ISO 4217 currency code of the transaction. `null` if none is set. */
  transaction_currency: string | null;
  /** Billing country. `null` if there is no billing address. */
  billing_country: string | null;
  measurement_system: MeasurementSystem;
  /** Selected market. `null` if the market is not open. */
  selected_market: string | null;
  /** Open markets. Today only `TR`. */
  open_markets: string[];
}

export type DistanceUnit = 'kilometer' | 'mile';

/**
 * Regions whose road distances are written in miles.
 * Used only when the boot data carries no measurement system. Example: an old server with a region.
 */
const MILE_REGIONS: ReadonlySet<string> = new Set(['GB', 'US', 'LR', 'MM']);

/**
 * Unit of a road distance.
 * 1. The user's measurement system wins. Example: region `GB` and `metric` gives the kilometre.
 * 2. Without a measurement system the region decides. Example: region `GB` gives the mile.
 * 3. Without either the unit is the kilometre.
 */
export function distanceUnit(input: {
  region?: string | null | undefined;
  measurementSystem?: MeasurementSystem | null | undefined;
}): DistanceUnit {
  if (input.measurementSystem === 'metric') return 'kilometer';
  if (input.measurementSystem === 'imperial') return 'mile';
  const region = (input.region ?? '').trim().toUpperCase();
  return MILE_REGIONS.has(region) ? 'mile' : 'kilometer';
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** `true` if `Intl` recognises the time zone. Example: `Mars/Base` is not recognised. */
function knownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the `locale` field of the boot data. Wrong or unknown values are dropped one by one.
 * A dropped value falls back to its old field. Example: `transaction_currency: 'XX'` keeps `formatting.currency`.
 * A missing or broken field yields an empty result; the screen does not crash.
 */
export function readBootLocale(raw: unknown): Partial<BootLocale> {
  if (!raw || typeof raw !== 'object') return {};
  const value = raw as Record<string, unknown>;
  const out: Partial<BootLocale> = {};
  const languageTag = text(value['language_tag']);
  if (languageTag) out.language_tag = languageTag;
  const language = text(value['language']);
  if (language) out.language = language;
  const region = text(value['region']);
  if (region) out.region = region.toUpperCase();
  const timeZone = text(value['time_zone']);
  if (timeZone && knownTimeZone(timeZone)) out.time_zone = timeZone;
  const currency = text(value['transaction_currency'])?.toUpperCase();
  if (currency && /^[A-Z]{3}$/.test(currency)) out.transaction_currency = currency;
  const system = value['measurement_system'];
  if (system === 'metric' || system === 'imperial') out.measurement_system = system;
  return out;
}
