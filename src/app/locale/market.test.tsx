/**
 * AJA-1770: language, market and measurement fields of the boot data (AJA-1732).
 * Money, time zone and measurement system come from the boot data's own `locale` fields, never from the language.
 * The `locale` contract is in `metafrappe/backend` (`contracts/platform_core-shell.openapi.yaml`, schema `Locale`).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createPlatformSession } from '@/auth';
import { SAMPLE_CSRF_TOKEN, sampleBootstrap } from '@/mocks/fixtures';
import { resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { AppProviders } from '../AppProviders';
import { Root } from '../Root';

import {
  createFormatter,
  distanceUnit,
  useFormat,
  useLanguage,
  useSetLanguage,
  type BootLocale,
} from './index';

const AMOUNT = 1234.5;
const ROAD_KM = 42.195;
/** Closing instant. 22:30 UTC on Friday 27 November 2026. */
const CLOSES_AT = '2026-11-27T22:30:00Z';
/** Due day. A calendar day carries no time zone. */
const DUE_DAY = '2026-11-27';

/** Expected text is built with `Intl`, not copied from the code under test. */
const eur = (intl: string) =>
  new Intl.NumberFormat(intl, { style: 'currency', currency: 'EUR' }).format(AMOUNT);

function Probe() {
  const language = useLanguage();
  const setLanguage = useSetLanguage();
  const format = useFormat();
  const [draft, setDraft] = useState('');
  return (
    <>
      <output aria-label="Dil">{language}</output>
      <output aria-label="Tutar">{format.currency(AMOUNT)}</output>
      <output aria-label="Uzaklık">{format.distance(ROAD_KM)}</output>
      <output aria-label="Kapanış">{format.frappeDateTime(CLOSES_AT)}</output>
      <output aria-label="Son gün">{format.date(DUE_DAY)}</output>
      <label>
        Taslak
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />
      </label>
      <button type="button" onClick={() => setLanguage('tr')}>
        Türkçe
      </button>
      <button type="button" onClick={() => setLanguage('en')}>
        English
      </button>
    </>
  );
}

describe('1. Yalnız dil değişince tutar ve taslak aynı kalır', () => {
  it('avro tutarı ve yazılan taslak dil değişiminden sonra korunur', () => {
    render(
      <AppProviders
        engines={false}
        initialLanguage="en"
        initialFormatting={{ currency: 'EUR', region: 'DE' }}
      >
        <Probe />
      </AppProviders>,
    );
    const draft = screen.getByRole('textbox', { name: 'Taslak' });
    fireEvent.change(draft, { target: { value: 'Teklif taslağı: 3 kalem' } });
    expect(screen.getByRole('status', { name: 'Tutar' })).toHaveTextContent(eur('en-GB'));

    fireEvent.click(screen.getByRole('button', { name: 'Türkçe' }));

    expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('tr');
    // Only the number format follows the language. The currency stays the euro; it does not become the lira.
    expect(screen.getByRole('status', { name: 'Tutar' })).toHaveTextContent(eur('tr-TR'));
    expect(screen.getByRole('status', { name: 'Tutar' })).not.toHaveTextContent('₺');
    expect(screen.getByRole('textbox', { name: 'Taslak' })).toBe(draft);
    expect(draft).toHaveValue('Teklif taslağı: 3 kalem');

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('status', { name: 'Tutar' })).toHaveTextContent(eur('en-GB'));
    expect(draft).toHaveValue('Teklif taslağı: 3 kalem');
  });
});

describe('2. Yol uzaklığı bölgeye göre görünür', () => {
  it('bölge GB ise mil, TR ise kilometre olur', () => {
    expect(distanceUnit({ region: 'GB' })).toBe('mile');
    expect(distanceUnit({ region: 'TR' })).toBe('kilometer');

    const gb = createFormatter({ language: 'en', region: 'GB' });
    const tr = createFormatter({ language: 'en', region: 'TR' });
    expect(gb.distance(ROAD_KM)).toBe(
      new Intl.NumberFormat('en-GB', {
        style: 'unit',
        unit: 'mile',
        maximumFractionDigits: 1,
      }).format(ROAD_KM / 1.609344),
    );
    expect(tr.distance(ROAD_KM)).toBe(
      new Intl.NumberFormat('en-GB', {
        style: 'unit',
        unit: 'kilometer',
        maximumFractionDigits: 1,
      }).format(ROAD_KM),
    );
  });

  it('dil değişse de birim değişmez: Türkçe arayüzde bölge GB ise mil kalır', () => {
    const format = createFormatter({ language: 'tr', region: 'GB' });
    expect(format.distanceUnit).toBe('mile');
  });
});

describe('3. Kullanıcının ölçü seçimi bölgenin önüne geçer', () => {
  it('kullanıcı metrik seçerse bölge GB olsa da kilometre görünür', () => {
    expect(distanceUnit({ region: 'GB', measurementSystem: 'metric' })).toBe('kilometer');
    expect(distanceUnit({ region: 'TR', measurementSystem: 'imperial' })).toBe('mile');
    const format = createFormatter({ language: 'en', region: 'GB', measurementSystem: 'metric' });
    expect(format.distance(ROAD_KM)).toContain('km');
  });
});

const SITE = 'https://kiraci.example.test';

function session() {
  return createPlatformSession({
    env: { VITE_SITE_URL: SITE },
    origin: SITE,
    document,
    navigate: vi.fn(),
    currentPath: () => '/',
    csrfToken: SAMPLE_CSRF_TOKEN,
  });
}

function serveBootstrap(message: unknown) {
  mockServer.use(
    http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
      Response.json({ message }),
    ),
  );
}

const LONDON_EUR: BootLocale = {
  language_tag: 'en-GB',
  language: 'en',
  region: 'GB',
  time_zone: 'Pacific/Auckland',
  transaction_currency: 'EUR',
  billing_country: 'GB',
  measurement_system: 'imperial',
  selected_market: 'TR',
  open_markets: ['TR'],
};

describe('Root: açılış verisinin locale alanı', () => {
  beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => {
    mockServer.resetHandlers();
    resetMockState();
  });
  afterAll(() => mockServer.close());

  it('para, ölçü ve saat dilimi dilden değil locale alanından gelir', async () => {
    serveBootstrap({
      ...sampleBootstrap,
      // The old fields say lira and Istanbul. The new `locale` field wins.
      user: { ...sampleBootstrap.user, language: 'tr' },
      locale: LONDON_EUR,
    });
    render(
      <Root session={session()} engines={false}>
        <Probe />
      </Root>,
    );
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Tutar' })).toHaveTextContent(eur('en-GB')),
    );
    expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('en');
    expect(screen.getByRole('status', { name: 'Uzaklık' })).toHaveTextContent('mi');
  });

  it('4. kapanış anı kullanıcının saat diliminde görünür, takvim günü kaymaz', async () => {
    serveBootstrap({ ...sampleBootstrap, locale: LONDON_EUR });
    render(
      <Root session={session()} engines={false}>
        <Probe />
      </Root>,
    );
    // 22:30 UTC is 11:30 on Saturday 28 November in Auckland (+13:00, summer time).
    const expected = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Pacific/Auckland',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(CLOSES_AT));
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Kapanış' })).toHaveTextContent(expected),
    );
    expect(screen.getByRole('status', { name: 'Kapanış' })).toHaveTextContent('28 November');
    expect(screen.getByRole('status', { name: 'Kapanış' })).toHaveTextContent('11:30');
    // The due day is a calendar day. It stays Friday 27 November in every time zone.
    expect(screen.getByRole('status', { name: 'Son gün' })).toHaveTextContent(
      'Friday 27 November 2026',
    );
  });

  it('5. yeni alanlar yoksa arayüz en-GB ile açılır ve bozulmaz', async () => {
    serveBootstrap({ ...sampleBootstrap, user: { ...sampleBootstrap.user, language: '' } });
    render(
      <Root session={session()} engines={false}>
        <Probe />
      </Root>,
    );
    // The old fields still apply: lira and Istanbul.
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Tutar' })).toHaveTextContent(
        new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'TRY' }).format(AMOUNT),
      ),
    );
    expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('en');
    // Without a region the unit is the kilometre.
    expect(screen.getByRole('status', { name: 'Uzaklık' })).toHaveTextContent('km');
    expect(screen.getByRole('status', { name: 'Kapanış' })).toHaveTextContent('28 November');
    expect(screen.getByRole('status', { name: 'Kapanış' })).toHaveTextContent('01:30');
  });

  it('bozuk locale alanı ekranı çökertmez, eski alanlar kullanılır', async () => {
    serveBootstrap({
      ...sampleBootstrap,
      user: { ...sampleBootstrap.user, language: 'en' },
      locale: { region: 42, time_zone: 'Mars/Base', transaction_currency: 'XX' },
    });
    render(
      <Root session={session()} engines={false}>
        <Probe />
      </Root>,
    );
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Tutar' })).toHaveTextContent(
        new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'TRY' }).format(AMOUNT),
      ),
    );
    expect(screen.getByRole('status', { name: 'Uzaklık' })).toHaveTextContent('km');
  });
});
