// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/** Reads `.env.example`. The file is the sample config for working with a local backend. */
function readExample(): Record<string, string> {
  const text = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
  const entries = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)] as const;
    });
  return Object.fromEntries(entries);
}

function isLocalHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname.endsWith('.localhost');
}

describe('.env.example: yerel arka uç ayarı', () => {
  it('Keycloak kökü yerel Keycloak adresidir', () => {
    // The local backend returns its logout URL on the local Keycloak origin. The panel checks the logout
    // URL against this origin. If the origin stays the production one, logout never reaches Keycloak and its session stays open.
    const env = readExample();
    expect(isLocalHost(new URL(env['VITE_DEV_BACKEND'] ?? '').hostname)).toBe(true);
    const keycloak = env['VITE_KEYCLOAK_URL'];
    expect(keycloak).toBeTruthy();
    expect(isLocalHost(new URL(keycloak ?? '').hostname)).toBe(true);
  });
});
