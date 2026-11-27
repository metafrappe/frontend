import { render, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createPlatformSession } from '@/auth';
import { SAMPLE_CSRF_TOKEN, sampleBootstrap } from '@/mocks/fixtures';
import { resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';
import { formatMoment, pendingMeta } from '@/shell/pages/homeFormat';
import { displayCell } from '@/views/collection/presentation';
import type { CollectionField } from '@/views/collection/types';

import { AppProviders } from '../AppProviders';
import { Root } from '../Root';

import { createFormatter } from './format';
import { useFormat } from './index';

/** 06:05 UTC. That is 09:05 in Istanbul and 01:05 in New York. */
const INSTANT = new Date('2026-11-27T06:05:00Z');

function FormatProbe() {
  const format = useFormat();
  return (
    <>
      <output aria-label="Saat dilimi">{format.timeZone}</output>
      <output aria-label="Sayı">{format.number(1234.5)}</output>
      <output aria-label="Tarih">{format.date('2026-11-27')}</output>
      <output aria-label="Saat">{format.time(INSTANT)}</output>
      <output aria-label="Biçim dili">{format.intl}</output>
      <output aria-label="Para">{format.currency(1234.5)}</output>
      <output aria-label="Kısa tarih">
        {new Intl.DateTimeFormat(format.intl, { timeZone: 'UTC' }).format(new Date('2026-11-27'))}
      </output>
    </>
  );
}

describe('useFormat: biçim dil bağlamından gelir', () => {
  it('dil en olunca tarih ve sayı en-GB biçiminde görünür', () => {
    render(
      <AppProviders
        engines={false}
        initialLanguage="en"
        initialFormatting={{ time_zone: 'America/New_York', currency: 'USD' }}
      >
        <FormatProbe />
      </AppProviders>,
    );
    expect(screen.getByRole('status', { name: 'Sayı' })).toHaveTextContent('1,234.5');
    expect(screen.getByRole('status', { name: 'Tarih' })).toHaveTextContent(
      'Friday, 27 November 2026',
    );
    expect(screen.getByRole('status', { name: 'Saat dilimi' })).toHaveTextContent(
      'America/New_York',
    );
    expect(screen.getByRole('status', { name: 'Saat' })).toHaveTextContent(/^01:05$/);
  });

  it.each([
    ['boşsa', ''],
    ['desteklenmiyorsa', 'de'],
  ])('dil %s biçim yedek dil en-GB ile yapılır', (_case, raw) => {
    render(
      <AppProviders
        engines={false}
        initialLanguage={raw}
        initialFormatting={{ time_zone: 'Europe/London', currency: 'GBP' }}
      >
        <FormatProbe />
      </AppProviders>,
    );
    expect(screen.getByRole('status', { name: 'Biçim dili' })).toHaveTextContent('en-GB');
    expect(screen.getByRole('status', { name: 'Sayı' })).toHaveTextContent('1,234.5');
    expect(screen.getByRole('status', { name: 'Para' })).toHaveTextContent('£1,234.50');
    expect(screen.getByRole('status', { name: 'Tarih' })).toHaveTextContent(
      'Friday, 27 November 2026',
    );
    expect(screen.getByRole('status', { name: 'Kısa tarih' })).toHaveTextContent('27/11/2026');
    expect(screen.getByRole('status', { name: 'Saat' })).toHaveTextContent(/^06:05$/);
  });

  it('dil tr ise biçim Türkçe kalır', () => {
    render(
      <AppProviders engines={false} initialLanguage="tr" initialFormatting={{ currency: 'TRY' }}>
        <FormatProbe />
      </AppProviders>,
    );
    expect(screen.getByRole('status', { name: 'Biçim dili' })).toHaveTextContent('tr-TR');
    expect(screen.getByRole('status', { name: 'Sayı' })).toHaveTextContent('1.234,5');
    expect(screen.getByRole('status', { name: 'Para' })).toHaveTextContent('1.234,50');
    expect(screen.getByRole('status', { name: 'Tarih' })).toHaveTextContent('27 Kasım 2026 Cuma');
    expect(screen.getByRole('status', { name: 'Kısa tarih' })).toHaveTextContent('27.11.2026');
  });
});

describe('ekran biçimleri kullanıcının dilini kullanır', () => {
  const en = createFormatter({ language: 'en', timeZone: 'Europe/Istanbul', currency: 'TRY' });

  it('ana sayfanın tarihi ve saati İngilizce biçimde yazılır', () => {
    expect(formatMoment('2026-11-27 09:05:00', en)).toContain('Friday, 27 November 2026');
    expect(formatMoment('2026-11-27 09:05:00', en)).toContain('09:05');
    expect(formatMoment('2026-11-27 09:05:00', en)).not.toMatch(/AM|PM/);
    expect(
      pendingMeta(
        {
          name: 'HR-LAP-1',
          employee: 'E-1',
          employee_name: 'Örnek',
          leave_type: null,
          from_date: '2026-12-08',
          to_date: '2026-12-08',
          total_leave_days: 1234.5,
          leave_balance: null,
          posting_date: null,
          modified: '2026-11-27 09:05:00',
        } as never,
        en,
      ),
    ).toContain('1,234.5');
  });

  it('liste hücresinde tarih ve sayı İngilizce biçimde yazılır', () => {
    const field = (fieldtype: string, component: string) =>
      ({
        fieldname: 'v',
        fieldtype,
        component,
        label: 'V',
        choices: [],
      }) as never as CollectionField;
    expect(displayCell({ name: 'A', v: '2026-11-27' }, field('Date', 'date'), en)).toContain(
      'Friday, 27 November 2026',
    );
    expect(displayCell({ name: 'A', v: 1234.5 }, field('Float', 'number'), en)).toBe('1,234.5');
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

describe('Root: saat dilimi ve para birimi açılış verisinden gelir', () => {
  beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => {
    mockServer.resetHandlers();
    resetMockState();
  });
  afterAll(() => mockServer.close());

  it('açılış verisindeki saat dilimi biçime geçer', async () => {
    mockServer.use(
      http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
        Response.json({
          message: {
            ...sampleBootstrap,
            user: { ...sampleBootstrap.user, language: 'en' },
            formatting: { ...sampleBootstrap.formatting, time_zone: 'America/New_York' },
          },
        }),
      ),
    );
    render(
      <Root session={session()} engines={false}>
        <FormatProbe />
      </Root>,
    );
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Saat dilimi' })).toHaveTextContent(
        'America/New_York',
      ),
    );
    expect(screen.getByRole('status', { name: 'Saat' })).toHaveTextContent(/^01:05$/);
    expect(screen.getByRole('status', { name: 'Sayı' })).toHaveTextContent('1,234.5');
  });
});
