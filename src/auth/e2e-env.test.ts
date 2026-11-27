// @vitest-environment node
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveConfig } from 'vite';
import { describe, expect, it } from 'vitest';

import { SAMPLE_KEYCLOAK_URL } from '../mocks/fixtures';

// Vitest runs from the repository root, where `vite.config.ts` lives.
const ROOT = process.cwd();

async function defineFor(mode: string, command: 'build' | 'serve') {
  const config = await resolveConfig({ root: ROOT, mode, logLevel: 'silent' }, command);
  return config.define ?? {};
}

/** Env files are read from a temporary folder. Files in the repository are not touched. */
async function configWithEnvFile(command: 'build' | 'serve', file: string, body: string) {
  const envDir = mkdtempSync(join(tmpdir(), 'atonota-env-'));
  try {
    writeFileSync(join(envDir, file), body);
    return await resolveConfig({ root: ROOT, mode: 'e2e', envDir, logLevel: 'silent' }, command);
  } finally {
    rmSync(envDir, { recursive: true, force: true });
  }
}

/**
 * Review 2, K-3: the Keycloak root for e2e mode lives in one place: `vite/e2e-env.ts`.
 * Vite provides these values only in `e2e` mode: `build:e2e` and `dev:e2e`.
 * The repository has no `.env` file. The release gate treats every `.env` file as a secret.
 */
describe('e2e kipinin ortam ayarı', () => {
  it('depoda .env.e2e dosyası yoktur', () => {
    expect(existsSync(join(ROOT, '.env.e2e'))).toBe(false);
  });

  for (const command of ['build', 'serve'] as const) {
    it(`${command}: Keycloak kökü sahte sunucunun Keycloak köküyle aynıdır`, async () => {
      const define = await defineFor('e2e', command);
      expect(define['import.meta.env.VITE_KEYCLOAK_URL']).toBe(JSON.stringify(SAMPLE_KEYCLOAK_URL));
    });

    it(`${command}: sahte sunucu e2e kipinde açıktır`, async () => {
      const define = await defineFor('e2e', command);
      expect(define['import.meta.env.VITE_API_MOCKS']).toBe(JSON.stringify('on'));
    });
  }

  // Review 1, K-2: `define` and the mock server plugin read the same source: the result of Vite's `loadEnv`.
  for (const command of ['build', 'serve'] as const) {
    it(`${command}: .env.e2e.local dosyasındaki değer define değerine geçer`, async () => {
      const config = await configWithEnvFile(
        command,
        '.env.e2e.local',
        'VITE_KEYCLOAK_URL=https://yerel.example.test\nVITE_API_MOCKS=off\n',
      );
      expect(config.define?.['import.meta.env.VITE_KEYCLOAK_URL']).toBe(
        JSON.stringify('https://yerel.example.test'),
      );
      expect(config.define?.['import.meta.env.VITE_API_MOCKS']).toBe(JSON.stringify('off'));
      // The mock server plugin reads `config.env`. Both sources give the same value.
      expect(config.env['VITE_KEYCLOAK_URL']).toBe('https://yerel.example.test');
      expect(config.env['VITE_API_MOCKS']).toBe('off');
    });

    it(`${command}: dosyada olmayan değer e2e varsayılanında kalır`, async () => {
      const config = await configWithEnvFile(
        command,
        '.env.e2e.local',
        'VITE_KEYCLOAK_URL=https://yerel.example.test\n',
      );
      expect(config.define?.['import.meta.env.VITE_API_MOCKS']).toBe(JSON.stringify('on'));
    });
  }

  it('üretim kipinde bu değerler verilmez', async () => {
    const define = await defineFor('production', 'build');
    expect(define['import.meta.env.VITE_KEYCLOAK_URL']).toBeUndefined();
    expect(define['import.meta.env.VITE_API_MOCKS']).toBeUndefined();
  });
});
