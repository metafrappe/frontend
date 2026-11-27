// Pins the copy of the backend contract (AJA-1776) and the request shapes (AJA-1785).
import { describe, expect, it } from 'vitest';
import {
  ADDRESS_FORMATS,
  acceptanceInput,
  addressFormat,
  buildBillingInput,
  validateDraft,
} from './model';
import css from './billing.css?raw';

describe('billing model', () => {
  it('copies x-address-formats of billing_identity.schema.json', () => {
    expect(ADDRESS_FORMATS).toEqual({
      TR: {
        fields: ['line1', 'line2', 'district', 'province', 'postal_code'],
        required: ['line1', 'district', 'province'],
      },
      default: {
        fields: ['line1', 'line2', 'city', 'region', 'postal_code'],
        required: ['line1', 'city'],
      },
    });
    expect(addressFormat('ZZ')).toBe(ADDRESS_FORMATS.default);
  });

  it('accepts a one-part name and sends only the fields of the format', () => {
    const draft = {
      kind: 'person' as const,
      name: ' Madonna ',
      taxId: '',
      country: 'GB',
      address: { line1: '1 Example Street', city: 'London', province: 'left over' },
    };
    expect(validateDraft(draft)).toEqual({});
    const input = buildBillingInput(draft);
    expect(input.party).toEqual({ kind: 'person', name: 'Madonna', tax_id: null });
    expect(input.billing_address).not.toHaveProperty('province');
  });

  it('builds the acceptance from the shown text', () => {
    expect(
      acceptanceInput({
        terms_id: 'terms-of-use',
        terms_version: '2026-11-01',
        locale: 'tr',
        title: 'x',
        body: 'y',
      }),
    ).toEqual({ terms_id: 'terms-of-use', terms_version: '2026-11-01', shown_locale: 'tr' });
  });

  it('does not use overflow-wrap: anywhere', () => {
    expect(css).not.toMatch(/overflow-wrap:\s*anywhere|word-break:\s*break-all/);
  });
});
