// Serves the mock server's worker file (mockServiceWorker.js).
//
// The dev server always serves the file. If `VITE_API_MOCKS=off`, the browser does not use it.
// In a build the file is emitted only when `VITE_API_MOCKS=on` or in e2e mode. Same rule as `src/mocks/start.ts`.
// The file is read from the MSW package, so the worker version stays in step with the package.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import type { Plugin } from 'vite';

import { e2eEnv } from './e2e-env.ts';

const WORKER_FILE = 'mockServiceWorker.js';

function readWorker(): string {
  const require = createRequire(import.meta.url);
  return readFileSync(require.resolve(`msw/${WORKER_FILE}`), 'utf8');
}

export function mockWorkerPlugin(): Plugin {
  let emit = false;
  let base = '/';
  return {
    name: 'atonota-mock-worker',
    configResolved(config) {
      base = config.base;
      // In e2e mode the value may also come from `vite/e2e-env.ts`. The environment value takes precedence.
      const mocks = config.env['VITE_API_MOCKS'] ?? e2eEnv(config.mode)['VITE_API_MOCKS'];
      emit = config.command === 'build' && mocks === 'on';
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        // The dev server runs at the `base` path. The worker is served at that path too.
        if (new URL(request.url ?? '/', 'http://localhost').pathname !== `${base}${WORKER_FILE}`) {
          next();
          return;
        }
        response.writeHead(200, {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/javascript; charset=utf-8',
          'Service-Worker-Allowed': base,
        });
        response.end(readWorker());
      });
    },
    generateBundle() {
      if (!emit) return;
      this.emitFile({ type: 'asset', fileName: WORKER_FILE, source: readWorker() });
    },
  };
}
