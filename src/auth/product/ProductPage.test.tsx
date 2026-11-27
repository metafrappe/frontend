// AtonotA Login product page (G-165, G-166, G-167, G-157).
import { render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createPlatformSession } from '@/auth';
import { Root } from '@/app/Root';
import { SAMPLE_CSRF_TOKEN } from '@/mocks/fixtures';
import { resetMockState } from '@/mocks/handlers';
import { mockServer } from '@/mocks/node';

import messages from './messages.json';
import ProductPage from './ProductPage';
import { valueProps } from './content';
import { PRODUCT_PATH, isPublicPath } from './path';

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));
afterEach(() => resetMockState());
afterAll(() => mockServer.close());

describe('ProductPage', () => {
  it('marka adını tam yazar', () => {
    render(<ProductPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AtonotA Login');
  });

  it('var olan yetenekler ile yakında gelenler ayrı bölümdedir', () => {
    render(<ProductPage />);
    const ready = screen.getByRole('region', { name: 'Bugün neler var?' });
    const soon = screen.getByRole('region', { name: 'Yakında' });
    expect(within(ready).getByText('AtonotA Login ile giriş')).toBeVisible();
    expect(within(soon).getByText('Geçiş anahtarıyla güçlü giriş')).toBeVisible();
    expect(within(ready).queryByText('Geçiş anahtarıyla güçlü giriş')).not.toBeInTheDocument();
  });

  it('canlıda doğrulanmamış özellikler "Yakında" bölümündedir (inceleme 1, bulgu 1)', () => {
    render(<ProductPage />);
    const ready = screen.getByRole('region', { name: 'Bugün neler var?' });
    const soon = screen.getByRole('region', { name: 'Yakında' });
    for (const title of [
      'Birçok platformla giriş',
      'Bağlı hesaplar',
      "Platform verisi Hetzner'de",
    ]) {
      expect(within(soon).getByText(title)).toBeVisible();
      expect(within(ready).queryByText(title)).not.toBeInTheDocument();
    }
  });

  it('"bugün var" denen her öneri kanıt taşır', () => {
    for (const item of valueProps.filter((value) => value.status === 'ready')) {
      expect(item.evidence?.trim()).toBeTruthy();
    }
  });

  it('giriş metni kurulmamış yeteneği bugün varmış gibi anlatmaz (inceleme 2, bulgu 1)', () => {
    // The intro text describes the product. Capability claims appear only in the "What's available today?" section (`ready_title`).
    const intro = [messages.tr.lead, messages.tr.lead_more].join(' ');
    for (const claim of ['girer', 'eklenir', 'desteklenir', 'bağlar', 'durur', 'yapılır']) {
      expect(intro).not.toMatch(new RegExp(`\\b${claim}\\b`));
    }
    // Present-tense forms of the "Coming soon" (`soon_title`) items do not appear in the intro text.
    expect(intro).not.toContain('tek hesapla birçok uygulamaya girer');
  });

  it('"Tek giriş kapısı" önerisi "Yakında" bölümündedir', () => {
    render(<ProductPage />);
    const soon = screen.getByRole('region', { name: 'Yakında' });
    expect(within(soon).getByText('Tek giriş kapısı')).toBeVisible();
  });

  it('durum metinleri "Yakında" önerilerinde gelecek zamanla yazılır', () => {
    for (const item of valueProps.filter((value) => value.status === 'soon')) {
      expect(messages.tr.values[item.key].body).toMatch(/(ecek|acak)(tır|tir)?\./);
    }
  });

  it('her değer önerisi bir gereksinime bağlıdır', () => {
    expect(valueProps.length).toBeGreaterThan(0);
    for (const item of valueProps) {
      expect(item.requirement).toMatch(/^G-\d+$/);
      expect(messages.tr.values).toHaveProperty(item.key);
    }
  });

  it('fiyat yazmaz (G-166)', () => {
    const { container } = render(<ProductPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Fiyat henüz açıklanmadı.');
    expect(text).not.toMatch(/[₺$€]|\bTL\b|\bTRY\b|\bUSD\b|\bEUR\b|\d+\s*(lira|dolar|avro)/i);
  });

  it('lisans sınırını yazar (G-157)', () => {
    render(<ProductPage />);
    const license = screen.getByRole('region', { name: 'Lisans' });
    expect(license).toHaveTextContent('MIT');
    expect(license).toHaveTextContent('Apache-2.0');
  });

  it('sayfa dış adrese istek ya da bağlantı içermez (G-134)', () => {
    const { container } = render(<ProductPage />);
    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('href')).toMatch(/^\//);
    }
    expect(container.querySelector('script, iframe, img[src^="http"]')).toBeNull();
  });
});

describe('oturumsuz adres', () => {
  it('tanıtım adresi oturum istemez', () => {
    expect(PRODUCT_PATH).toBe('/atonota-login');
    expect(isPublicPath('/atonota-login')).toBe(true);
    expect(isPublicPath('/atonota-login/')).toBe(true);
    expect(isPublicPath('/atonota-login-x')).toBe(false);
    expect(isPublicPath('/account')).toBe(false);
  });

  it('Root tanıtım sayfasını oturum sormadan çizer', async () => {
    const get = vi.fn();
    mockServer.events.on('request:start', ({ request }) => {
      if (request.url.includes('get_logged_user')) get();
    });
    const session = createPlatformSession({
      env: { VITE_SITE_URL: 'https://kiraci.example.test' },
      origin: 'https://kiraci.example.test',
      document,
      navigate: vi.fn(),
      currentPath: () => '/atonota-login',
      csrfToken: SAMPLE_CSRF_TOKEN,
    });
    render(<Root session={session} engines={false} pathname="/atonota-login" />);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('AtonotA Login');
    expect(get).not.toHaveBeenCalled();
    mockServer.events.removeAllListeners();
  });
});
