import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FALLBACK_LOCALE,
  LanguageProvider,
  UI_LOCALES,
  resolveLocale,
  useFormat,
  useLocale,
} from './index';

/** 27 November 2026 is a Friday. */
const FRIDAY = '2026-11-27';

function LocaleProbe() {
  const locale = useLocale();
  const format = useFormat();
  return (
    <>
      <output aria-label="Yerel ayar">{locale}</output>
      <output aria-label="Gün">{dayjs(FRIDAY).format('dddd')}</output>
      <output aria-label="Biçim dili">{format.intl}</output>
    </>
  );
}

describe('resolveLocale: profil, sonra kiracı, sonra en-GB (AJA-1772)', () => {
  it('yedek yerel ayar en-GB olur (Karar 44)', () => {
    expect(FALLBACK_LOCALE).toBe('en-GB');
  });

  it.each([
    // Profile and tenant are empty: the fallback applies.
    ['', '', 'en-GB'],
    [undefined, undefined, 'en-GB'],
    [null, '   ', 'en-GB'],
    // The profile wins over the tenant.
    ['de-DE', 'tr-TR', 'de-DE'],
    // An empty profile falls back to the tenant setting.
    ['', 'tr-TR', 'tr-TR'],
    // A bare language code is matched to the offered tag.
    ['de', '', 'de-DE'],
    ['tr', '', 'tr-TR'],
    ['en', '', 'en-GB'],
    ['en-US', '', 'en-GB'],
    // An unoffered language is skipped.
    ['fr-FR', 'de-DE', 'de-DE'],
    ['fr-FR', '', 'en-GB'],
  ])('profil %j, kiracı %j ise %s olur', (profile, tenant, expected) => {
    expect(resolveLocale(profile, tenant)).toBe(expected);
  });
});

describe('dil seçenekleri kendi dilindeki adıyla görünür', () => {
  it('her seçeneğin adı kendi dilindedir', () => {
    expect(UI_LOCALES.map(({ tag, name }) => [tag, name])).toEqual([
      ['en-GB', 'English (UK)'],
      ['tr-TR', 'Türkçe'],
      ['de-DE', 'Deutsch'],
    ]);
  });
});

describe('tarayıcı dili kayıtlı seçimi ezmez', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = 'tr';
  });

  it('profil de-DE, tarayıcı tr-TR ise arayüz Almanca açılır', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('tr-TR');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['tr-TR', 'tr']);
    render(
      <LanguageProvider initialLanguage="de-DE">
        <LocaleProbe />
      </LanguageProvider>,
    );
    expect(screen.getByRole('status', { name: 'Yerel ayar' })).toHaveTextContent('de-DE');
    expect(screen.getByRole('status', { name: 'Gün' })).toHaveTextContent('Freitag');
    expect(screen.getByRole('status', { name: 'Biçim dili' })).toHaveTextContent('de-DE');
    expect(document.documentElement.lang).toBe('de-DE');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('profil boşsa tarayıcı dili kullanılmaz, arayüz en-GB açılır', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('tr-TR');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['tr-TR', 'tr']);
    render(
      <LanguageProvider initialLanguage="">
        <LocaleProbe />
      </LanguageProvider>,
    );
    expect(screen.getByRole('status', { name: 'Yerel ayar' })).toHaveTextContent('en-GB');
    expect(document.documentElement.lang).toBe('en-GB');
  });
});
