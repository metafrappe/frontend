// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { E2E_ENV } from '../../vite/e2e-env.ts';
import { DEFAULT_KEYCLOAK_URL } from '../api/config';

/** Text that appears only on the demo page. It must not be in the production bundle. */
const DEMO_PAGE_MARKER = 'Arayüz temeli hazır';

/** Traces of the MSW library in a bundle: registration call, log prefix and worker file name. */
const MSW_MARKERS = ['setupWorker', '[MSW]', 'mockServiceWorker'];

/** Demo route: `/_demo/<work-item>`. The prefix itself (`/_demo/`) may remain in the router. */
const DEMO_ROUTE = /\/_demo\/[\w-]+/;

/** Chunk names of the demo pages. The production output must contain no files with these names. */
const DEMO_CHUNK = /^(DemoPage|ControlsDemoPage)-/;

/**
 * Example domain names (`*.example.test`). The mock server and e2e values use them.
 * They do not enter the production bundle.
 */
const SAMPLE_HOST = /[\w.-]+\.example\.test/;

const DEV_ENV = {
  VITE_DEV_BACKEND: 'https://build-test-backend.example.test',
  VITE_DEV_SITE_NAME: 'build-test-tenant.example.test',
};

/**
 * Lazy chunks: the shell (`import()` in `App.tsx`; chunk name is `shell-` or `ShellApp-`),
 * the router and the icon library. None of them may be in the list index.html loads immediately.
 */
const LAZY_CHUNKS = [
  { name: 'kabuk', test: /^(shell|ShellApp)-/ },
  { name: 'yönlendirici', test: /^router-/ },
  { name: 'ikonlar', test: /^icons-/ },
  { name: 'Ant Design X', test: /^antd-x-/ },
];

let outDir = '';

async function buildProduction(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'atonota-uretim-'));
  const saved = { mocks: process.env.VITE_API_MOCKS, nodeEnv: process.env.NODE_ENV };
  const savedBackend = process.env.VITE_DEV_BACKEND;
  const savedSiteName = process.env.VITE_DEV_SITE_NAME;
  delete process.env.VITE_API_MOCKS;
  Object.assign(process.env, DEV_ENV);
  // Vitest sets NODE_ENV to `test`. A real production build uses `production`.
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

/** Files index.html loads immediately: script and modulepreload links. */
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
    // e2e mode uses the AtonotA Login URL. Browser tests intercept requests to this domain.
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
      // The MSW library does not enter the bundle either: no worker registration, library log prefix or worker file name.
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
    // These strings appear only in the collection model and the record adapter.
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
    // At least three lazy chunks: shell, router and icons (the shell is fetched once the session is set up).
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
    // antd components are split by where they are used. React stays separate.
    expect(js.some((name) => name.startsWith('react-'))).toBe(true);
    const total = js.reduce((sum, name) => sum + statSync(join(outDir, 'assets', name)).size, 0);
    const initialBytes = initial.reduce((sum, p) => sum + statSync(join(outDir, p)).size, 0);
    expect(initialBytes).toBeLessThan(total);
  });
});
