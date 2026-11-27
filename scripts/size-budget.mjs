/**
 * Bundle size budget (AJA-1570). Rules: docs/standards/headless-frontend-standartlari.md, section 14.
 * - BY-1: initial load, the largest single chunk and the total are measured separately;
 *   raw, compressed (gzip) and real network transfer are measured separately.
 * - BY-2: a shared file is counted once; when a limit is exceeded the gate fails.
 * - BY-3: the limits live in scripts/size-budget.json. Only the project owner raises them.
 * Unit: bytes. In reports 1 KB = 1,000 bytes (project standard).
 *
 * The browser part (real transfer) is in scripts/initial-load.mjs. This module has no browser code,
 * so the unit tests run without a browser.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

export const BYTES_PER_KB = 1000;
export const OWNER_RULE = 'Sınırı yalnız proje sahibi yükseltir.';

/** Every limit the gate checks. A missing limit is a violation, so a typo cannot switch a check off. */
export const LIMIT_KEYS = [
  'initialJsGzipBytes',
  'initialCssGzipBytes',
  'initialAllGzipBytes',
  'singleJsGzipBytes',
  'singleCssGzipBytes',
  'totalJsGzipBytes',
  'totalAllGzipBytes',
  'initialTransferBytes',
];

/** @param {number} bytes */
export function kb(bytes) {
  return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
}

/**
 * Reads the budget file and checks its shape.
 * @param {string} path
 * @returns {{ rule: string; date: string; limits: Record<string, number> }}
 */
export function readBudgetFile(path) {
  const budget = JSON.parse(readFileSync(path, 'utf8'));
  if (budget.rule !== OWNER_RULE) throw new Error(`${path}: "rule" alanı "${OWNER_RULE}" olmalı.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(budget.date)))
    throw new Error(`${path}: "date" alanı YYYY-AA-GG biçiminde olmalı.`);
  if (typeof budget.limits !== 'object' || budget.limits === null)
    throw new Error(`${path}: "limits" alanı yok.`);
  return budget;
}

/**
 * Raw and gzip (level 9) size of every file in the build folder. `.vite/` (the manifest) is skipped:
 * the browser never downloads it.
 * @param {string} outDir
 * @returns {Record<string, { rawBytes: number; gzipBytes: number }>}
 */
export function readBuildSizes(outDir) {
  /** @type {Record<string, { rawBytes: number; gzipBytes: number }>} */
  const sizes = {};
  for (const entry of readdirSync(outDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = relative(outDir, join(entry.parentPath, entry.name)).split(sep).join('/');
    if (name.startsWith('.vite/')) continue;
    const data = readFileSync(join(outDir, name));
    sizes[name] = { rawBytes: data.length, gzipBytes: gzipSync(data, { level: 9 }).length };
  }
  return sizes;
}

/**
 * Files the entry loads before any lazy `import()`: entry chunk, static imports (recursive),
 * their CSS and assets. Each file is collected once.
 * @param {Record<string, { file?: string; isEntry?: boolean; imports?: string[]; css?: string[]; assets?: string[] }>} manifest
 */
function initialFiles(manifest) {
  const queue = Object.keys(manifest).filter((key) => manifest[key]?.isEntry === true);
  const seen = new Set();
  /** @type {Set<string>} */
  const files = new Set();
  while (queue.length > 0) {
    const key = /** @type {string} */ (queue.shift());
    if (seen.has(key)) continue;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) continue;
    if (chunk.file) files.add(chunk.file);
    for (const file of [...(chunk.css ?? []), ...(chunk.assets ?? [])]) files.add(file);
    queue.push(...(chunk.imports ?? []));
  }
  return files;
}

/**
 * @param {Iterable<string>} files
 * @param {Record<string, { rawBytes: number; gzipBytes: number }>} sizes
 * @param {(file: string) => boolean} match
 */
function sum(files, sizes, match) {
  let rawBytes = 0;
  let gzipBytes = 0;
  for (const file of new Set(files)) {
    const size = sizes[file];
    if (!size || !match(file)) continue;
    rawBytes += size.rawBytes;
    gzipBytes += size.gzipBytes;
  }
  return { rawBytes, gzipBytes };
}

/**
 * @param {Record<string, { rawBytes: number; gzipBytes: number }>} sizes
 * @param {string} extension
 */
function largest(sizes, extension) {
  let best = { file: '', rawBytes: 0, gzipBytes: 0 };
  for (const [file, size] of Object.entries(sizes)) {
    if (file.endsWith(extension) && size.gzipBytes > best.gzipBytes) best = { file, ...size };
  }
  return best;
}

const isJs = (/** @type {string} */ f) => f.endsWith('.js');
const isCss = (/** @type {string} */ f) => f.endsWith('.css');
const any = () => true;

/**
 * Build metrics from the Vite manifest and file sizes. Shared files are counted once.
 * The initial load includes `index.html`. Fonts listed by the entry CSS are counted in full here;
 * the browser downloads only the subsets it needs, so the real transfer is measured separately.
 * @param {Record<string, { file?: string; isEntry?: boolean; imports?: string[]; css?: string[]; assets?: string[] }>} manifest
 * @param {Record<string, { rawBytes: number; gzipBytes: number }>} sizes
 */
export function computeBuildMetrics(manifest, sizes) {
  const files = [...initialFiles(manifest)];
  if (sizes['index.html']) files.unshift('index.html');
  const all = Object.keys(sizes);
  return {
    initial: {
      files,
      js: sum(files, sizes, isJs),
      css: sum(files, sizes, isCss),
      all: sum(files, sizes, any),
    },
    single: { js: largest(sizes, '.js'), css: largest(sizes, '.css') },
    total: { js: sum(all, sizes, isJs), css: sum(all, sizes, isCss), all: sum(all, sizes, any) },
  };
}

/**
 * Compares the metrics with the limits. `transfer` maps a measured path to the bytes the browser
 * really transferred (or is null when the browser part did not run).
 * @param {ReturnType<typeof computeBuildMetrics>} metrics
 * @param {Record<string, number> | null} transfer
 * @param {Record<string, number>} limits
 */
export function evaluateBudget(metrics, transfer, limits) {
  const checks = [
    ['initialJsGzipBytes', 'İlk açılış JS (gzip)', metrics.initial.js.gzipBytes],
    ['initialCssGzipBytes', 'İlk açılış CSS (gzip)', metrics.initial.css.gzipBytes],
    ['initialAllGzipBytes', 'İlk açılış tüm dosyalar (gzip)', metrics.initial.all.gzipBytes],
    [
      'singleJsGzipBytes',
      `En büyük JS parçası, ${metrics.single.js.file || '-'} (gzip)`,
      metrics.single.js.gzipBytes,
    ],
    [
      'singleCssGzipBytes',
      `En büyük CSS parçası, ${metrics.single.css.file || '-'} (gzip)`,
      metrics.single.css.gzipBytes,
    ],
    ['totalJsGzipBytes', 'Toplam JS (gzip)', metrics.total.js.gzipBytes],
    ['totalAllGzipBytes', 'Toplam tüm dosyalar (gzip)', metrics.total.all.gzipBytes],
    ...Object.entries(transfer ?? {}).map(([path, bytes]) => [
      'initialTransferBytes',
      `Gerçek aktarım, ${path}`,
      bytes,
    ]),
  ].map(([id, label, actual]) => {
    const limit = limits[/** @type {string} */ (id)];
    const known = Number.isInteger(limit) && /** @type {number} */ (limit) > 0;
    return {
      id: /** @type {string} */ (id),
      label: /** @type {string} */ (label),
      actualBytes: /** @type {number} */ (actual),
      limitBytes: known ? /** @type {number} */ (limit) : null,
      ok: known && /** @type {number} */ (actual) <= /** @type {number} */ (limit),
    };
  });

  const violations = checks
    .filter((check) => !check.ok)
    .map((check) =>
      check.limitBytes === null
        ? `${check.id}: sınır dosyada yok (${check.label})`
        : `${check.id}: ${check.label} ${kb(check.actualBytes)}, sınır ${kb(check.limitBytes)}`,
    );
  return { ok: violations.length === 0, checks, violations };
}

/**
 * Report lines: measured value, limit and remaining room for each check (BY-6).
 * @param {ReturnType<typeof evaluateBudget>} result
 */
export function formatBudgetReport(result) {
  const lines = ['\n== Boyut sınırı (1 KB = 1.000 bayt) =='];
  for (const check of result.checks) {
    const limit = check.limitBytes === null ? 'yok' : kb(check.limitBytes);
    const room = check.limitBytes === null ? '-' : kb(check.limitBytes - check.actualBytes);
    lines.push(
      `${check.ok ? 'geçti ' : 'AŞILDI'}  ${check.label}: ${kb(check.actualBytes)}, sınır ${limit}, kalan pay ${room}`,
    );
  }
  lines.push(
    result.ok
      ? 'Sınır içinde.'
      : `Sınır aşıldı:\n- ${result.violations.join('\n- ')}\n${OWNER_RULE} Önce kodu küçültün.`,
  );
  return lines.join('\n');
}
