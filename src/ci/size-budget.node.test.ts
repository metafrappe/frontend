// @vitest-environment node
// Tests for the bundle size budget gate (AJA-1570).
//
// Rules: docs/standards/headless-frontend-standartlari.md, section 14, BY-1 and BY-2.
// - Initial load, the largest single chunk and the total are measured separately.
// - Compressed size (gzip) and real network transfer are written separately.
// - A shared chunk is counted once.
// - When a limit is exceeded the gate fails (exit code 1).
// The limits live in one file: scripts/size-budget.json.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeBuildMetrics,
  evaluateBudget,
  readBudgetFile,
  readBuildSizes,
} from '../../scripts/size-budget.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'initial-load.mjs');
const BUDGET_FILE = join(ROOT, 'scripts', 'size-budget.json');

const manifest = {
  'index.html': {
    file: 'assets/index.js',
    isEntry: true,
    imports: ['_react.js', '_shared.js'],
    dynamicImports: ['src/pages/Report.tsx'],
    css: ['assets/index.css'],
    assets: ['assets/outfit.woff2'],
  },
  '_react.js': { file: 'assets/react.js' },
  '_shared.js': { file: 'assets/shared.js', imports: ['_react.js'] },
  'src/pages/Report.tsx': {
    file: 'assets/report.js',
    isDynamicEntry: true,
    imports: ['_shared.js'],
    css: ['assets/report.css'],
  },
};

const sizes = {
  'index.html': { rawBytes: 900, gzipBytes: 400 },
  'assets/index.js': { rawBytes: 10_000, gzipBytes: 4_000 },
  'assets/index.css': { rawBytes: 3_000, gzipBytes: 1_000 },
  'assets/react.js': { rawBytes: 140_000, gzipBytes: 45_000 },
  'assets/shared.js': { rawBytes: 20_000, gzipBytes: 7_000 },
  'assets/report.js': { rawBytes: 60_000, gzipBytes: 20_000 },
  'assets/report.css': { rawBytes: 5_000, gzipBytes: 1_500 },
  'assets/outfit.woff2': { rawBytes: 30_000, gzipBytes: 30_000 },
};

describe('computeBuildMetrics', () => {
  it('measures initial load, single chunk and total separately, raw and gzip', () => {
    const metrics = computeBuildMetrics(manifest, sizes);

    // Initial load: HTML + entry + static imports. react.js is imported twice but counted once.
    // The lazy report page is not part of the initial load.
    expect(metrics.initial.js).toEqual({ rawBytes: 170_000, gzipBytes: 56_000 });
    expect(metrics.initial.css).toEqual({ rawBytes: 3_000, gzipBytes: 1_000 });
    expect(metrics.initial.all.gzipBytes).toBe(400 + 56_000 + 1_000 + 30_000);
    expect(metrics.initial.files).not.toContain('assets/report.js');

    expect(metrics.single.js).toEqual({
      file: 'assets/react.js',
      rawBytes: 140_000,
      gzipBytes: 45_000,
    });
    expect(metrics.single.css.file).toBe('assets/report.css');

    expect(metrics.total.js.gzipBytes).toBe(4_000 + 45_000 + 7_000 + 20_000);
    expect(metrics.total.all.rawBytes).toBe(
      Object.values(sizes).reduce((sum, s) => sum + s.rawBytes, 0),
    );
  });
});

describe('evaluateBudget', () => {
  const metrics = computeBuildMetrics(manifest, sizes);
  const roomy = {
    initialJsGzipBytes: 60_000,
    initialCssGzipBytes: 2_000,
    initialAllGzipBytes: 100_000,
    singleJsGzipBytes: 50_000,
    singleCssGzipBytes: 2_000,
    totalJsGzipBytes: 80_000,
    totalAllGzipBytes: 120_000,
    initialTransferBytes: 100_000,
  };

  it('passes when every value is within its limit', () => {
    const result = evaluateBudget(metrics, { '/': 90_000 }, roomy);
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('fails when a gzip limit is exceeded', () => {
    const result = evaluateBudget(metrics, null, { ...roomy, singleJsGzipBytes: 44_999 });
    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('singleJsGzipBytes');
  });

  it('fails when the real transfer of a path exceeds its limit', () => {
    const result = evaluateBudget(metrics, { '/': 100_001 }, roomy);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain('initialTransferBytes');
  });

  it('fails when a limit is missing, so a typo cannot switch a check off', () => {
    const { totalJsGzipBytes: _omit, ...partial } = roomy;
    const result = evaluateBudget(metrics, null, partial);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain('totalJsGzipBytes');
  });
});

describe('scripts/size-budget.json', () => {
  it('holds every limit with a date and the owner rule', () => {
    const budget = readBudgetFile(BUDGET_FILE);
    expect(budget.rule).toBe('Sınırı yalnız proje sahibi yükseltir.');
    expect(budget.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Object.keys(budget.limits).sort()).toEqual([
      'initialAllGzipBytes',
      'initialCssGzipBytes',
      'initialJsGzipBytes',
      'initialTransferBytes',
      'singleCssGzipBytes',
      'singleJsGzipBytes',
      'totalAllGzipBytes',
      'totalJsGzipBytes',
    ]);
    for (const value of Object.values(budget.limits)) {
      expect(Number.isInteger(value) && value > 0).toBe(true);
    }
  });
});

describe('initial-load.mjs --check (static part)', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  function fakeBuild(): { out: string; limits: (scale: number) => string } {
    dir = mkdtempSync(join(tmpdir(), 'size-budget-'));
    const out = join(dir, 'dist');
    mkdirSync(join(out, '.vite'), { recursive: true });
    mkdirSync(join(out, 'assets'), { recursive: true });
    writeFileSync(
      join(out, 'index.html'),
      '<!doctype html><script type="module" src="/panel/assets/index.js"></script>',
    );
    writeFileSync(join(out, 'assets', 'index.js'), 'console.log("x");'.repeat(400));
    writeFileSync(join(out, 'assets', 'index.css'), 'body{margin:0}'.repeat(50));
    writeFileSync(
      join(out, '.vite', 'manifest.json'),
      JSON.stringify({
        'index.html': { file: 'assets/index.js', isEntry: true, css: ['assets/index.css'] },
      }),
    );
    const limits = (bytes: number) => {
      const path = join(dir, `limits-${bytes}.json`);
      const value = Math.max(1, bytes);
      writeFileSync(
        path,
        JSON.stringify({
          rule: 'Sınırı yalnız proje sahibi yükseltir.',
          date: '2026-11-27',
          limits: {
            initialJsGzipBytes: value,
            initialCssGzipBytes: value,
            initialAllGzipBytes: value,
            singleJsGzipBytes: value,
            singleCssGzipBytes: value,
            totalJsGzipBytes: value,
            totalAllGzipBytes: value,
            initialTransferBytes: value,
          },
        }),
      );
      return path;
    };
    return { out, limits };
  }

  function run(out: string, limits: string) {
    return spawnSync(
      process.execPath,
      [SCRIPT, '--check', '--static-only', '--out', out, '--limits', limits],
      { cwd: ROOT, encoding: 'utf8' },
    );
  }

  it('reads real gzip sizes from the build folder', () => {
    const { out } = fakeBuild();
    const read = readBuildSizes(out);
    const js = readFileSync(join(out, 'assets', 'index.js'));
    expect(read['assets/index.js']).toEqual({
      rawBytes: js.length,
      gzipBytes: gzipSync(js, { level: 9 }).length,
    });
    expect(read['index.html']).toBeDefined();
    expect(read['.vite/manifest.json']).toBeUndefined();
  });

  it('exits with 0 when the build is within the limits', () => {
    const { out, limits } = fakeBuild();
    const result = run(out, limits(1_000_000));
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Sınır içinde');
  });

  it('exits with 1 when a limit is exceeded', () => {
    const { out, limits } = fakeBuild();
    const result = run(out, limits(10));
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('Sınır aşıldı');
  });
});
