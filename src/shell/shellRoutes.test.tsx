import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sparkle } from '@phosphor-icons/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ant-design/x', () => import('./testing/antdXMock'));
vi.mock('./pages/reloadPage', () => ({ reloadPage: vi.fn() }));

import { reloadPage } from './pages/reloadPage';
import type { RouteEntry } from './routes';
import { aiStudioRoute, collectionRoutes, lazyRoutes, shellFeatures } from './routes';
import { buildShellRoutes } from './shellRoutes';

function page(text: string) {
  return () => Promise.resolve({ default: () => <p>{text}</p> });
}

function mount(path: string, lazy: RouteEntry[], collection: RouteEntry[] = []) {
  const router = createMemoryRouter(buildShellRoutes(lazy, collection), {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

const listSpy = vi.fn(page('Koleksiyon sayfası'));
const recordSpy = vi.fn(page('Kayıt sayfası'));
const collection: RouteEntry[] = [
  { path: '/:module/:doctype', label: 'Kayıtlar', icon: Sparkle, load: listSpy },
  { path: '/:module/:doctype/:name', label: 'Kayıt', icon: Sparkle, load: recordSpy },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe('buildShellRoutes: hata ekranı', () => {
  it('sayfa dosyası yüklenemezse "Sayfa yüklenemedi" ve "Yeniden dene" görünür', async () => {
    const broken: RouteEntry = {
      path: '/bozuk',
      label: 'Bozuk',
      icon: Sparkle,
      load: () => Promise.reject(new Error('Failed to fetch dynamically imported module')),
    };
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mount('/bozuk', [broken]);
    expect(await screen.findByRole('heading', { name: 'Sayfa yüklenemedi' })).toBeInTheDocument();
    expect(screen.queryByText('Sayfa bulunamadı')).not.toBeInTheDocument();
    // The shell stays in place. Only the content area shows the error.
    expect(screen.getByRole('navigation', { name: 'Ana gezinme' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('bilinmeyen adres "Sayfa bulunamadı" gösterir', async () => {
    mount('/a/b/c/d', [{ path: '/', label: 'Ana', icon: Sparkle, load: page('Ana') }]);
    expect(await screen.findByRole('heading', { name: 'Sayfa bulunamadı' })).toBeInTheDocument();
  });
});

describe('buildShellRoutes: rota sırası', () => {
  it('tembel rota listesi koleksiyon yolundan önce gelir ve kazanır', async () => {
    const own: RouteEntry = {
      path: '/satis/ozet',
      label: 'Özet',
      icon: Sparkle,
      load: page('Özet'),
    };
    mount('/satis/ozet', [own], collection);
    expect(await screen.findByText('Özet')).toBeInTheDocument();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('ShellApp rota listesinde tembel satırlar koleksiyon yollarından öncedir', () => {
    const routes = buildShellRoutes(lazyRoutes, collectionRoutes);
    const paths = (routes[0]?.children ?? []).map((r) => r.path);
    const lastLazy = Math.max(...lazyRoutes.map((r) => paths.indexOf(r.path)));
    const firstCollection = Math.min(...collectionRoutes.map((r) => paths.indexOf(r.path)));
    expect(lastLazy).toBeLessThan(firstCollection);
  });

  it.each(['/_demo/tablo', '/_demo/tablo/satir', '/_demo/a/b/c'])(
    '%s koleksiyon ya da kayıt sayfasına düşmez',
    async (path) => {
      mount(path, [], collection);
      expect(await screen.findByRole('heading', { name: 'Sayfa bulunamadı' })).toBeInTheDocument();
      expect(listSpy).not.toHaveBeenCalled();
      expect(recordSpy).not.toHaveBeenCalled();
    },
  );

  it('/_demo/ altındaki kendi satırı olan sayfa açılır', async () => {
    const demo: RouteEntry = {
      path: '/_demo/tablo',
      label: 'Tablo örneği',
      icon: Sparkle,
      load: page('Tablo örneği'),
    };
    mount('/_demo/tablo', [demo], collection);
    expect(await screen.findByText('Tablo örneği')).toBeInTheDocument();
    expect(listSpy).not.toHaveBeenCalled();
  });
});

describe('AI Studio satırı', () => {
  it('ayar açıktır ve satır listededir', () => {
    expect(shellFeatures.aiStudio).toBe(true);
    expect(aiStudioRoute.path).toBe('/panel/ai');
    expect(lazyRoutes.map((r) => r.path)).toContain('/panel/ai');
  });

  it('satırı olmayan /panel/ adresi koleksiyon sayfasına düşmez', async () => {
    mount('/panel/baska', lazyRoutes, collection);
    expect(await screen.findByRole('heading', { name: 'Sayfa bulunamadı' })).toBeInTheDocument();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('satır /panel/ai sayfasını açar', async () => {
    mount('/panel/ai', [{ ...aiStudioRoute, load: page('AI Studio') }], collection);
    expect(await screen.findByText('AI Studio')).toBeInTheDocument();
    expect(listSpy).not.toHaveBeenCalled();
  });
});
