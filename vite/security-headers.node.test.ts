// @vitest-environment node
import type { AddressInfo } from 'node:net';

import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SECURITY_HEADERS } from './security-headers.ts';

/** Trusted Types önce rapor kipinde açılır (GV-2, AJA-2283). Sayfa engellenmez, ihlal raporlanır. */
describe('Trusted Types rapor kipi', () => {
  it('başlık rapor kipindedir ve betik yuvalarını kapsar', () => {
    expect(SECURITY_HEADERS).toEqual({
      'Content-Security-Policy-Report-Only': "require-trusted-types-for 'script'",
    });
  });

  describe('geliştirme sunucusu', () => {
    let server: ViteDevServer;

    beforeAll(async () => {
      server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'silent' });
      await server.listen();
    });

    afterAll(async () => {
      await server.close();
    });

    it('sayfa yanıtında başlığı gönderir', async () => {
      const { port } = server.httpServer!.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/`);
      expect(response.headers.get('content-security-policy-report-only')).toBe(
        "require-trusted-types-for 'script'",
      );
      expect(response.headers.get('content-security-policy')).toBeNull();
    });
  });
});
