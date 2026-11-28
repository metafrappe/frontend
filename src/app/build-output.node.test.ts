// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { E2E_ENV } from '../../vite/e2e-env.ts';
import { DEFAULT_KEYCLOAK_URL } from '../api/config';

/** Deneme sayfasının yalnız orada geçen metni. Üretim paketinde bulunmamalıdır. */
const DEMO_PAGE_MARKER = 'Arayüz temeli hazır';

/** MSW kitaplığının paketteki izleri: kayıt çağrısı, günlük öneki ve işçi dosya adı. */
const MSW_MARKERS = ['setupWorker', '[MSW]', 'mockServiceWorker'];

/** Deneme rotası: `/_demo/<iş>`. Önekin kendisi (`/_demo/`) yönlendiricide kalabilir. */
const DEMO_ROUTE = /\/_demo\/[\w-]+/;

/** Deneme sayfalarının parça adları. Üretim çıktısında bu adlarla dosya bulunmamalıdır. */
const DEMO_CHUNK = /^(DemoPage|ControlsDemoPage)-/;

/**
 * Örnek alan adları (`*.example.test`). Sahte sunucu ve e2e değerleri bunları kullanır.
 * Üretim paketine girmezler.
 */
const SAMPLE_HOST = /[\w.-]+\.example\.test/;

const DEV_ENV = {
  VITE_DEV_BACKEND: 'https://build-test-backend.example.test',
  VITE_DEV_SITE_NAME: 'build-test-tenant.example.test',
};

/**
 * Tembel parçalar: kabuk (`App.tsx` içinde `import()`; parça adı `shell-` ya da `ShellApp-` olur),
 * yönlendirici ve ikon kitaplığı. Hiçbiri index.html'nin hemen yüklediği listede olamaz.
 */
const LAZY_CHUNKS = [
  { name: 'kabuk', test: /^(shell|ShellApp)-/ },
  { name: 'yönlendirici', test: /^router-/ },
  { name: 'ikonlar', test: /^icons-/ },
  { name: 'Ant Design X', test: /^antd-x-/ },
  // G-137 yardım paneli kulakçık ilk kez açılınca iner.
  { name: 'yardım paneli', test: /^HelpPanel-/ },
];

let outDir = '';

async function buildProduction(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'atonota-uretim-'));
  const saved = { mocks: process.env.VITE_API_MOCKS, nodeEnv: process.env.NODE_ENV };
  const savedBackend = process.env.VITE_DEV_BACKEND;
  const savedSiteName = process.env.VITE_DEV_SITE_NAME;
  delete process.env.VITE_API_MOCKS;
  Object.assign(process.env, DEV_ENV);
  // Vitest NODE_ENV değerini `test` yapar. Gerçek üretim derlemesi `production` kullanır.
  process.env.NODE_ENV = 'production';
  try {
    await build({
      logLevel: 'silent',
      mode: 'production',
      build: { outDir: dir, emptyOutDir: true },
    });
  } finally {
    if (savedBackend === undefined) delete process.env.VITE_DEV_BACKEND;
    else process.env.VITE_DEV_BACKEND = savedBackend;
    if (savedSiteName === undefined) delete process.env.VITE_DEV_SITE_NAME;
    else process.env.VITE_DEV_SITE_NAME = savedSiteName;
    if (saved.mocks === undefined) delete process.env.VITE_API_MOCKS;
    else process.env.VITE_API_MOCKS = saved.mocks;
    process.env.NODE_ENV = saved.nodeEnv;
  }
  return dir;
}

function assetFiles(dir: string, ext: string): string[] {
  return readdirSync(join(dir, 'assets')).filter((name) => name.endsWith(ext));
}

/** index.html'nin hemen yüklediği dosyalar: script ve modulepreload bağlantıları. */
function initialAssets(dir: string): string[] {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(?:\/panel)?\/?(assets\/[^"]+)"/g)].map(
    (m) => m[1]!,
  );
  return [...new Set(refs)];
}

beforeAll(async () => {
  outDir = await buildProduction();
}, 120_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('üretim derlemesi (vite build)', () => {
  it('varlıklar /panel/ yolundan yüklenir (canlı panel yolu)', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref, ref).toMatch(/^\/panel\/assets\//);
    expect(initialAssets(outDir).length).toBe(refs.length);
    for (const name of assetFiles(outDir, '.css')) {
      const css = readFileSync(join(outDir, 'assets', name), 'utf8');
      for (const [, url] of css.matchAll(/url\(([^)]+)\)/g)) {
        if (url!.startsWith('data:')) continue;
        expect(url, `${name}: ${url}`).toMatch(/^(\/panel\/assets\/|\.\/)/);
      }
    }
  });

  it('geliştirme sunucusu ayarlarını içermez', () => {
    for (const name of assetFiles(outDir, '.js')) {
      const contents = readFileSync(join(outDir, 'assets', name), 'utf8');
      for (const [key, value] of Object.entries(DEV_ENV)) {
        expect(contents.includes(value), `${name}: ${key}`).toBe(false);
      }
    }
  });

  it('e2e kipinin Keycloak kökü üretim varsayılanıyla aynıdır', () => {
    // e2e kipi AtonotA Login adresini kullanır. Tarayıcı testleri bu alana giden isteği keser.
    expect(E2E_ENV.VITE_KEYCLOAK_URL).toBe(DEFAULT_KEYCLOAK_URL);
  });

  it('örnek alan adlarını içermez', () => {
    for (const name of [...assetFiles(outDir, '.js'), ...readdirSync(outDir)]) {
      const path = name.endsWith('.js') ? join(outDir, 'assets', name) : join(outDir, name);
      if (!statSync(path).isFile()) continue;
      const text = readFileSync(path, 'utf8');
      expect(text.match(SAMPLE_HOST)?.[0], `${name}: örnek alan adı`).toBeUndefined();
    }
  });

  it('deneme sayfasını ve sahte sunucuyu içermez', () => {
    expect(existsSync(join(outDir, 'mockServiceWorker.js'))).toBe(false);
    for (const name of assetFiles(outDir, '.js')) {
      const text = readFileSync(join(outDir, 'assets', name), 'utf8');
      expect(text.includes(DEMO_PAGE_MARKER), `${name}: deneme sayfası metni`).toBe(false);
      expect(text.match(DEMO_ROUTE)?.[0], `${name}: deneme rotası`).toBeUndefined();
      // MSW kitaplığı da pakete girmez: işçi kaydı, kitaplık günlük öneki ve işçi dosya adı yoktur.
      for (const marker of MSW_MARKERS) {
        expect(text.includes(marker), `${name}: sahte sunucu izi "${marker}"`).toBe(false);
      }
    }
  });

  it('deneme sayfalarının parçalarını içermez', () => {
    const files = readdirSync(join(outDir, 'assets'));
    expect(files.filter((name) => DEMO_CHUNK.test(name))).toEqual([]);
  });

  it('koleksiyon ve kayıt kaynağı zinciri ilk yükte değildir (orkestratör eki: ilk yük paketi)', () => {
    // Bu metinler yalnız koleksiyon modelinde ve kayıt bağdaştırıcısında geçer.
    const markers = ['Kayıt tanımı desteklenmiyor.', 'Alan adı yineleniyor.', 'RecordApiError'];
    for (const name of initialAssets(outDir).filter((file) => file.endsWith('.js'))) {
      const text = readFileSync(join(outDir, name), 'utf8');
      for (const marker of markers) {
        expect(text.includes(marker), `${name}: ilk yükte "${marker}"`).toBe(false);
      }
    }
  });

  it('paket rotalara ve kitaplıklara göre parçalıdır; kabuk, yönlendirici ve ikonlar ilk yükte değildir', () => {
    const js = assetFiles(outDir, '.js');
    const initial = initialAssets(outDir).filter((p) => p.endsWith('.js'));
    expect(initial.length).toBeGreaterThan(0);
    const lazy = js.filter((name) => !initial.includes(`assets/${name}`));
    // En az üç tembel parça: kabuk, yönlendirici ve ikonlar (kabuk oturum kurulunca iner).
    expect(lazy.length, lazy.join(', ')).toBeGreaterThanOrEqual(3);
    for (const chunk of LAZY_CHUNKS) {
      expect(
        js.some((name) => chunk.test.test(name)),
        `${chunk.name} parçası üretilir`,
      ).toBe(true);
      expect(
        initial.some((p) => chunk.test.test(p.replace(/^assets\//, ''))),
        `${chunk.name} parçası ilk yükte değildir`,
      ).toBe(false);
    }
    // antd bileşenleri kullanım yerine göre bölünür. React ayrı kalır.
    expect(js.some((name) => name.startsWith('react-'))).toBe(true);
    const total = js.reduce((sum, name) => sum + statSync(join(outDir, 'assets', name)).size, 0);
    const initialBytes = initial.reduce((sum, p) => sum + statSync(join(outDir, p)).size, 0);
    expect(initialBytes).toBeLessThan(total);
  });

  it('giriş ekranı tablo kodunu indirmez (antd-initial parçası yalnız giriş modüllerini taşır)', () => {
    // rc-table iç kancasının adı küçültmeden sonra da kalır. Tablo yalnız tembel sayfalarda gerekir.
    for (const name of initialAssets(outDir).filter((file) => file.endsWith('.js'))) {
      const text = readFileSync(join(outDir, name), 'utf8');
      expect(text.includes('rc-table-internal-hook'), `${name}: ilk yükte tablo kodu`).toBe(false);
    }
    // Giriş ekranının antd modülleri tek parçadadır. Bkz. vite.config.ts `antd-initial`.
    expect(initialAssets(outDir).some((p) => /^assets\/antd-initial-/.test(p))).toBe(true);
  });
});
