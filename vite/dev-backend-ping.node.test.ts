// @vitest-environment node
import { createServer as createHttpServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { devBackendPlugin, devBackendProxy, readDevBackend } from './dev-backend.ts';

/** Fake Frappe backend. Answers a `ping` request with a Frappe-style `pong` response. */
function startFakeBackend(): Promise<Server> {
  const server = createHttpServer((request, response) => {
    if (request.url?.startsWith('/api/method/ping')) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ message: 'pong' }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

describe('geliştirme sunucusu: yerel arka uç vekili', () => {
  let backend: Server;
  let vite: ViteDevServer;
  let viteOrigin: string;

  beforeAll(async () => {
    backend = await startFakeBackend();
    const { port } = backend.address() as AddressInfo;
    const settings = readDevBackend({ VITE_DEV_BACKEND: `http://127.0.0.1:${port}` });
    if (!settings) throw new Error('vekil ayarı okunamadı');
    vite = await createServer({
      configFile: false,
      root: process.cwd(),
      logLevel: 'silent',
      plugins: [devBackendPlugin(settings)],
      server: { host: '127.0.0.1', port: 0, proxy: devBackendProxy(settings), hmr: false },
    });
    await vite.listen();
    const address = vite.httpServer?.address() as AddressInfo;
    viteOrigin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await vite?.close();
    await new Promise((done) => backend?.close(done));
  });

  it('panelden giden ping isteği arka uca gider ve pong yanıtı alır', async () => {
    const response = await fetch(`${viteOrigin}/api/method/ping`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: 'pong' });
  });

  it('eklenti yalnız geliştirme sunucusunda çalışır, üretim derlemesine girmez', () => {
    expect(devBackendPlugin(undefined).apply).toBe('serve');
  });
});
