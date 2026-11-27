import { render, screen, waitFor } from '@testing-library/react';
import { Empty } from 'antd';
import dayjs from 'dayjs';
import { http } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createPlatformSession } from '@/auth';
import { SAMPLE_CSRF_TOKEN, sampleBootstrap } from '@/mocks/fixtures';
import { resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import { AppProviders } from '../AppProviders';
import { Root } from '../Root';

import { FALLBACK_LANGUAGE, localeBundle, resolveLanguage, useFormat, useLanguage } from './index';
import { LocalizedXProvider } from './LocalizedXProvider';

/** Visible text. The SVG `title` element inside the image is not counted. */
const VISIBLE = { ignore: 'title, script, style' };

/** 27 November 2026 is a Friday. The expected name comes from the calendar, not copied from the code. */
const FRIDAY = '2026-11-27';

function LanguageProbe() {
  const language = useLanguage();
  const format = useFormat();
  return (
    <>
      <output aria-label="Dil">{language}</output>
      <output aria-label="Gün">{dayjs(FRIDAY).format('dddd')}</output>
      <output aria-label="Kısa tarih">
        {new Intl.DateTimeFormat(format.intl, { timeZone: 'UTC' }).format(new Date(FRIDAY))}
      </output>
      <Empty />
    </>
  );
}

describe('resolveLanguage: açılış verisindeki dil', () => {
  it('yedek dil İngiliz İngilizcesidir: dil en, biçim en-GB', () => {
    expect(FALLBACK_LANGUAGE).toBe('en');
    expect(localeBundle(FALLBACK_LANGUAGE).intl).toBe('en-GB');
    expect(localeBundle(FALLBACK_LANGUAGE).dayjs).toBe('en-gb');
    expect(localeBundle(FALLBACK_LANGUAGE).antd.locale).toBe('en-gb');
  });

  it.each([
    ['en', 'en'],
    ['tr', 'tr'],
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['EN', 'en'],
    ['tr-TR', 'tr'],
    ['', 'en'],
    ['   ', 'en'],
    [undefined, 'en'],
    [null, 'en'],
    ['de', 'en'],
  ])('%j dili %s olur', (raw, expected) => {
    expect(resolveLanguage(raw)).toBe(expected);
  });
});

describe('AppProviders: Ant Design ve Day.js aynı dili kullanır', () => {
  it('dil en olunca Ant Design ve Day.js İngilizce çalışır', () => {
    render(
      <AppProviders engines={false} initialLanguage="en">
        <LanguageProbe />
      </AppProviders>,
    );
    expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('en');
    expect(screen.getByText('No Data', VISIBLE)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Gün' })).toHaveTextContent('Friday');
    expect(dayjs.locale()).toBe('en-gb');
  });

  it.each([
    ['boşsa', ''],
    ['desteklenmiyorsa', 'de'],
  ])('dil %s yedek dil en-GB olur', (_case, raw) => {
    render(
      <AppProviders engines={false} initialLanguage={raw}>
        <LanguageProbe />
      </AppProviders>,
    );
    expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('en');
    expect(screen.getByText('No Data', VISIBLE)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Gün' })).toHaveTextContent('Friday');
    expect(screen.getByRole('status', { name: 'Kısa tarih' })).toHaveTextContent('27/11/2026');
    expect(dayjs.locale()).toBe('en-gb');
  });

  it('dil tr ise arayüz Türkçe kalır', () => {
    render(
      <AppProviders engines={false} initialLanguage="tr">
        <LanguageProbe />
      </AppProviders>,
    );
    expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('tr');
    expect(screen.getByText('Veri Yok', VISIBLE)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Gün' })).toHaveTextContent('Cuma');
    expect(screen.getByRole('status', { name: 'Kısa tarih' })).toHaveTextContent('27.11.2026');
    expect(dayjs.locale()).toBe('tr');
  });
});

describe('Ant Design X: dil alanları antd nesnesiyle birleşir', () => {
  it('X dil nesnesi aynı dildeki antd nesnesinin bütün alanlarını taşır', () => {
    for (const language of ['tr', 'en'] as const) {
      const { antd, x } = localeBundle(language);
      expect(x).toMatchObject(antd);
      expect(x.locale).toBe(antd.locale);
    }
  });

  it('X sağlayıcısının altında antd bileşeni uygulama dilini kullanır', () => {
    render(
      <AppProviders engines={false} initialLanguage="en">
        <LocalizedXProvider>
          <Empty />
        </LocalizedXProvider>
      </AppProviders>,
    );
    expect(screen.getByText('No Data', VISIBLE)).toBeInTheDocument();
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

function bootstrapWithLanguage(language: string) {
  mockServer.use(
    http.get('*/api/method/platform_core.api.shell.get_bootstrap', () =>
      Response.json({
        message: { ...sampleBootstrap, user: { ...sampleBootstrap.user, language } },
      }),
    ),
  );
}

describe('Root: dil açılış verisinden gelir', () => {
  beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
  afterEach(() => {
    mockServer.resetHandlers();
    resetMockState();
  });
  afterAll(() => mockServer.close());

  it('kullanıcı dili en ise arayüz İngilizce olur', async () => {
    bootstrapWithLanguage('en');
    render(
      <Root session={session()} engines={false}>
        <LanguageProbe />
      </Root>,
    );
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('en'),
    );
    expect(screen.getByText('No Data', VISIBLE)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Gün' })).toHaveTextContent('Friday');
  });

  it('kullanıcı dili boşsa arayüz yedek dil en-GB ile açılır', async () => {
    bootstrapWithLanguage('');
    render(
      <Root session={session()} engines={false}>
        <LanguageProbe />
      </Root>,
    );
    expect(await screen.findByText('No Data', VISIBLE)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('en');
    expect(screen.getByRole('status', { name: 'Gün' })).toHaveTextContent('Friday');
    expect(screen.getByRole('status', { name: 'Kısa tarih' })).toHaveTextContent('27/11/2026');
  });

  it('kullanıcı dili tr ise arayüz Türkçe olur', async () => {
    bootstrapWithLanguage('tr');
    render(
      <Root session={session()} engines={false}>
        <LanguageProbe />
      </Root>,
    );
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Dil' })).toHaveTextContent('tr'),
    );
    expect(screen.getByText('Veri Yok', VISIBLE)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Gün' })).toHaveTextContent('Cuma');
  });
});
