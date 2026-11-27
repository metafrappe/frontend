// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const outDirs: string[] = [];

async function buildWith(mocks: string | undefined, mode = 'production'): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), 'atonota-derleme-'));
  outDirs.push(outDir);
  const saved = { mocks: process.env.VITE_API_MOCKS, nodeEnv: process.env.NODE_ENV };
  if (mocks === undefined) delete process.env.VITE_API_MOCKS;
  else process.env.VITE_API_MOCKS = mocks;
  // Vitest sets NODE_ENV to `test`. A real production build uses `production`.
  process.env.NODE_ENV = 'production';
  try {
    await build({ logLevel: 'silent', mode, build: { outDir, emptyOutDir: true } });
  } finally {
    if (saved.mocks === undefined) delete process.env.VITE_API_MOCKS;
    else process.env.VITE_API_MOCKS = saved.mocks;
    process.env.NODE_ENV = saved.nodeEnv;
  }
  return outDir;
}

afterAll(() => {
  for (const dir of outDirs) rmSync(dir, { recursive: true, force: true });
});

describe('üretim çıktısı', () => {
  it('sahte sunucu kapalıyken işçi dosyasını ve sahte sunucu kodunu içermez', async () => {
    const outDir = await buildWith(undefined);
    expect(existsSync(join(outDir, 'mockServiceWorker.js'))).toBe(false);
    expect(readdirSync(join(outDir, 'assets')).some((name) => name.startsWith('browser-'))).toBe(
      false,
    );
  }, 60_000);

  it('VITE_API_MOCKS=on iken işçi dosyasını ve sahte sunucu kodunu üretir', async () => {
    const outDir = await buildWith('on');
    expect(existsSync(join(outDir, 'mockServiceWorker.js'))).toBe(true);
    expect(readdirSync(join(outDir, 'assets')).some((name) => name.startsWith('browser-'))).toBe(
      true,
    );
  }, 60_000);

  it('e2e kipinde ortam değişkeni olmadan da işçi dosyasını ve sahte sunucu kodunu üretir', async () => {
    // The value comes from vite/e2e-env.ts. The repository has no .env.e2e file.
    const outDir = await buildWith(undefined, 'e2e');
    expect(existsSync(join(outDir, 'mockServiceWorker.js'))).toBe(true);
    expect(readdirSync(join(outDir, 'assets')).some((name) => name.startsWith('browser-'))).toBe(
      true,
    );
  }, 120_000);
});
