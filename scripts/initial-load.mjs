#!/usr/bin/env node
/**
 * İlk yük ölçümü. Üretim derlemesini (`dist/`) önizleme sunucusunda açar, Chromium'da verilen
 * yolları ziyaret eder ve aktarılan baytları (sıkıştırılmış, CDP `encodedDataLength`) yazar.
 * Dış istekler (kimlik sunucusu gibi) kesilir; yalnız yerel paket ölçülür.
 *
 * Paket `/panel/` yoluyla derlendiyse yollar o yolun altında açılır (örnek: `/` -> `/panel/`).
 * Kullanım: node scripts/initial-load.mjs [--build] [--check] [--static-only] [--limits dosya]
 *        [--out dist] [--port 4381] [--width 360] [yol ...]
 * - `--build`: önce üretim derlemesini alır (`vite build`, sahte sunucu kapalı).
 * - `--check`: boyut sınırı kapısı (AJA-1570). İlk açılışı, en büyük tek parçayı ve toplamı
 *   `dist/` içinden ölçer (ham ve gzip). Sonra tarayıcıda gerçek aktarımı ölçer. Sonuçları
 *   `scripts/size-budget.json` (ya da `--limits`) ile karşılaştırır. Sınır aşılırsa 1 koduyla çıkar.
 * - `--static-only`: `--check` ile birlikte tarayıcıyı atlar; yalnız derleme çıktısı ölçülür.
 * - `--build` yoksa `dist/` hazır olmalıdır. Klasörde `mockServiceWorker.js` varsa bu bir e2e
 *   derlemesidir; betik ölçmeden durur. Böylece `npm run test:e2e` sonrası yanlış paket ölçülmez.
 *
 * Önizleme sunucusu `vite` ikilisini doğrudan Node ile başlatır (`npx` ara süreci yoktur). Betik
 * biterken sunucuya SIGTERM gönderir, çıkışını bekler, gerekirse SIGKILL yollar. Böylece port boş kalır.
 *
 * Bağlantı noktası doluysa betik sunucuyu hiç başlatmaz ve 2 koduyla durur; başka bir sunucu ölçülmez.
 * Sunucu açılınca betik `index.html` yanıtını `dist/index.html` ile karşılaştırır; farklıysa durur.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import {
  computeBuildMetrics,
  evaluateBudget,
  formatBudgetReport,
  kb,
  readBudgetFile,
  readBuildSizes,
} from './size-budget.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// Vite paketi `bin/vite.js` yolunu dışa açmaz; ikili paketin `bin` alanından bulunur.
const vitePkgPath = require.resolve('vite/package.json', { paths: [root] });
const viteBinField = require(vitePkgPath).bin;
const viteBin = join(
  dirname(vitePkgPath),
  typeof viteBinField === 'string' ? viteBinField : viteBinField.vite,
);

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
}
function option(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const [value] = args.splice(i, 2).slice(1);
  return value ?? fallback;
}
const shouldBuild = flag('build');
const shouldCheck = flag('check');
const staticOnly = flag('static-only');
const limitsPath = resolve(root, option('limits', 'scripts/size-budget.json'));
const outDir = option('out', 'dist');
const port = Number(option('port', '4381'));
const width = Number(option('width', '360'));
const paths = args.length ? args : ['/'];
const base = `http://127.0.0.1:${port}`;
const outPath = resolve(root, outDir);

/** `vite` komutunu doğrudan Node ile koşar; çıkış kodu 0 değilse hata fırlatır. */
function runVite(viteArgs, env = {}) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [viteBin, ...viteArgs], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0 ? done() : fail(new Error(`vite ${viteArgs[0]} başarısız: çıkış kodu ${code}`)),
    );
  });
}

if (shouldBuild) {
  // Üretim derlemesi: sahte sunucu kapalı, NODE_ENV production.
  const env = { NODE_ENV: 'production', VITE_API_MOCKS: '' };
  await runVite(['build', '--outDir', outDir], env);
}

if (!existsSync(join(outPath, 'index.html'))) {
  console.error(
    `Üretim derlemesi yok: ${outPath}. Önce \`npm run build\` ya da \`--build\` kullanın.`,
  );
  process.exit(2);
}
/**
 * Paketin adres yolu (Vite `base`). Üretim derlemesi `/panel/` yolunu kullanır (vite/base-path.ts).
 * Yol `index.html` içindeki betik adresinden okunur. Ölçülen yollar bu yolun altında açılır.
 */
const appBase =
  readFileSync(join(outPath, 'index.html'), 'utf8').match(/src="(\/(?:[^"/]+\/)*)assets\//)?.[1] ??
  '/';

if (existsSync(join(outPath, 'mockServiceWorker.js'))) {
  console.error(
    `${outPath} bir e2e derlemesidir (mockServiceWorker.js var). İlk yük yalnız üretim derlemesinde ölçülür. \`npm run build\` ya da \`--build\` kullanın.`,
  );
  process.exit(2);
}

/** Bağlantı noktası boş mu? Bir şey yanıt veriyorsa doludur; ECONNREFUSED boş demektir. */
function isPortFree(portToCheck) {
  return new Promise((done) => {
    const socket = connect({ host: '127.0.0.1', port: portToCheck });
    socket.once('connect', () => {
      socket.destroy();
      done(false);
    });
    socket.once('error', () => done(true));
  });
}

/** Static part of the gate: raw and gzip sizes from the build output. */
let budget = null;
let buildMetrics = null;
if (shouldCheck) {
  budget = readBudgetFile(limitsPath);
  const manifestPath = join(outPath, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`Derleme listesi yok: ${manifestPath}. Boyut sınırı ölçülemedi.`);
    process.exit(2);
  }
  buildMetrics = computeBuildMetrics(
    JSON.parse(readFileSync(manifestPath, 'utf8')),
    readBuildSizes(outPath),
  );
  const row = (label, size) =>
    console.log(`${label.padEnd(34)} ham ${kb(size.rawBytes)}, gzip ${kb(size.gzipBytes)}`);
  console.log(`\n== Derleme çıktısı: ${outPath} (sınır tarihi ${budget.date}) ==`);
  row('İlk açılış JS', buildMetrics.initial.js);
  row('İlk açılış CSS', buildMetrics.initial.css);
  row('İlk açılış tüm dosyalar', buildMetrics.initial.all);
  row(`En büyük JS (${buildMetrics.single.js.file})`, buildMetrics.single.js);
  row(`En büyük CSS (${buildMetrics.single.css.file})`, buildMetrics.single.css);
  row('Toplam JS', buildMetrics.total.js);
  row('Toplam tüm dosyalar', buildMetrics.total.all);
  if (staticOnly) {
    const result = evaluateBudget(buildMetrics, null, budget.limits);
    console.log(formatBudgetReport(result));
    process.exit(result.ok ? 0 : 1);
  }
}

if (!(await isPortFree(port))) {
  console.error(
    `Bağlantı noktası ${port} dolu. Önizleme sunucusu başlatılmadı; başka bir sunucu ölçülmez. Boş bir port için \`--port\` kullanın.`,
  );
  process.exit(2);
}

const preview = spawn(
  process.execPath,
  [
    viteBin,
    'preview',
    '--outDir',
    outDir,
    '--port',
    String(port),
    '--strictPort',
    '--host',
    '127.0.0.1',
  ],
  { cwd: root, stdio: 'ignore' },
);
let previewExited = false;
preview.on('exit', () => {
  previewExited = true;
});

/** Önizleme sunucusunu kesin kapatır: SIGTERM, 3 s bekleme, gerekirse SIGKILL. */
function stopPreview() {
  if (previewExited) return Promise.resolve();
  return new Promise((done) => {
    const timer = setTimeout(() => {
      if (!previewExited) preview.kill('SIGKILL');
    }, 3000);
    preview.once('exit', () => {
      clearTimeout(timer);
      done();
    });
    preview.kill('SIGTERM');
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void stopPreview().then(() => process.exit(130));
  });
}

/** Sunucu açılana kadar bekler; sonra verilen `index.html` dosyasının gerçekten sunulduğunu doğrular. */
async function waitForServer() {
  for (let i = 0; i < 100; i += 1) {
    if (previewExited) throw new Error(`Önizleme sunucusu açılamadı (port ${port} dolu olabilir).`);
    try {
      const response = await fetch(`${base}${appBase}index.html`);
      if (response.ok) {
        const served = await response.text();
        const expected = readFileSync(join(outPath, 'index.html'), 'utf8');
        if (served.trim() !== expected.trim()) {
          throw new Error(
            `${base} başka bir içerik sunuyor: ${outPath}/index.html ile aynı değil. Ölçüm yapılmadı.`,
          );
        }
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('başka bir içerik')) throw error;
      /* sunucu henüz açılmadı */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Önizleme sunucusu açılmadı: ${base}`);
}

function kindOf(name) {
  if (name.endsWith('.js')) return 'JS';
  if (name.endsWith('.css')) return 'CSS';
  if (/\.woff2?$/.test(name)) return 'Yazı tipi';
  if (name.endsWith('/') || name.endsWith('.html')) return 'HTML';
  return 'Diğer';
}

async function measure(browser, path) {
  const context = await browser.newContext({
    viewport: { width, height: Math.round(width * 2.05) },
  });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const requests = new Map();
  cdp.on('Network.responseReceived', (e) =>
    requests.set(e.requestId, { url: e.response.url, encoded: 0 }),
  );
  cdp.on('Network.loadingFinished', (e) => {
    const r = requests.get(e.requestId);
    if (r) r.encoded = e.encodedDataLength;
  });
  await page.goto(base + appBase.replace(/\/$/, '') + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const rows = [...requests.values()]
    .filter((r) => r.url.startsWith(base))
    .map((r) => ({ name: r.url.slice(base.length), encoded: r.encoded }))
    .sort((a, b) => b.encoded - a.encoded);
  const totals = {};
  for (const r of rows) totals[kindOf(r.name)] = (totals[kindOf(r.name)] ?? 0) + r.encoded;
  const total = rows.reduce((sum, r) => sum + r.encoded, 0);
  // Gate value: only the bundle's own files (under the base path). API calls are not part of the bundle.
  const bundleTotal = rows
    .filter((r) => r.name.startsWith(appBase))
    .reduce((sum, r) => sum + r.encoded, 0);
  console.log(
    `\n== ${appBase.replace(/\/$/, '')}${path} (${width} px, Chromium, aktarılan bayt) ==`,
  );
  for (const r of rows)
    console.log(`${String(r.encoded).padStart(8)} B  ${kindOf(r.name).padEnd(9)} ${r.name}`);
  for (const [k, v] of Object.entries(totals)) console.log(`${k.padEnd(10)} ${kb(v)} (${v} B)`);
  console.log(`TOPLAM     ${kb(total)}, ${rows.length} istek`);
  await context.close();
  return bundleTotal;
}

let exitCode = 0;
try {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    /** @type {Record<string, number>} */
    const transfer = {};
    for (const path of paths) transfer[path] = await measure(browser, path);
    if (buildMetrics && budget) {
      const result = evaluateBudget(buildMetrics, transfer, budget.limits);
      console.log(formatBudgetReport(result));
      if (!result.ok) exitCode = 1;
    }
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
} finally {
  await stopPreview();
}
process.exit(exitCode);
