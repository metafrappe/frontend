import { globSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

import { resolveBase } from './vite/base-path.ts';
import { devBackendPlugin, devBackendProxy, readDevBackend } from './vite/dev-backend.ts';
import { e2eEnvPlugin } from './vite/e2e-env.ts';
import { mockWorkerPlugin } from './vite/mock-worker-plugin.ts';
import { runtimeDesignSource } from './vite/runtime-design-source.ts';

/**
 * e2e build (`vite build --mode e2e`): each feature's standalone harness pages are bundled too.
 * Rule: `src/<feature>/preview/index.html` or `src/<feature>/harness/index.html`. The preview server
 * serves these pages at the same path, e.g. /src/views/collection/preview/. They stay out of the production build.
 */
function e2eInputs(): Record<string, string> {
  const extra = globSync('src/**/{preview,harness}/index.html', {
    exclude: (p) => p.includes('node_modules'),
  });
  return Object.fromEntries([
    ['main', 'index.html'],
    ...extra.map((p) => [p.replace(/\/index\.html$/, '').replace(/\//g, '-'), p]),
  ]);
}

/** Shell tests that use `vi.mock('@ant-design/x')`. See the `projects` comment below. */
const ANTD_X_MOCK_TESTS = [
  'src/shell/layout/AppShell.test.tsx',
  'src/shell/shellRoutes.test.tsx',
  'src/shell/sidebar/Sidebar.test.tsx',
];

export default defineConfig(({ mode }) => {
  // Local backend: if `VITE_DEV_BACKEND` is set, Frappe paths are proxied to it (vite/dev-backend.ts).
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const backend = readDevBackend(env);
  return {
    // Panel base path: `/panel/` in production, `/` in development and e2e mode (vite/base-path.ts).
    base: resolveBase({ mode, env: process.env }),
    // mockWorkerPlugin: serves the mock server's worker file only when needed (vite/mock-worker-plugin.ts).
    // e2eEnvPlugin: mock server and Keycloak values for e2e mode (vite/e2e-env.ts). The repository has no
    // `.env` file. Values come from the `loadEnv` result; `.env.e2e.local` is read as well.
    plugins: [
      react(),
      mockWorkerPlugin(),
      e2eEnvPlugin(),
      devBackendPlugin(backend, env['VITE_CSRF_META_NAME'] || undefined),
    ],
    define: {
      __RUNTIME_DESIGN_SOURCE__: JSON.stringify(runtimeDesignSource),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@design-source': fileURLToPath(new URL('./design/source', import.meta.url)),
      },
    },
    build: {
      // Build manifest (.vite/manifest.json): list of chunks and dependencies. Capability-based delivery
      // tests (adaptive, modules) use it to verify that a page downloads only its own chunks.
      manifest: true,
      rolldownOptions: {
        ...(mode === 'e2e' ? { input: e2eInputs() } : {}),
        output: {
          // Code splitting: libraries are separate chunks; on a version change only that chunk is re-downloaded.
          // Pages and the shell land in their own chunks via lazy `import()` (App.tsx and shell routes).
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\// },
              { name: 'router', test: /node_modules\/(react-router|react-router-dom)\// },
              // The routes that use antd components decide where they go. The Ant Design X group does not pull them in.
              {
                name: 'antd-x',
                test: /node_modules\/@ant-design\/x\//,
                includeDependenciesRecursively: false,
              },
              { name: 'icons', test: /node_modules\/@phosphor-icons\// },
            ],
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      ...(backend ? { proxy: devBackendProxy(backend) } : {}),
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['tests/setup/vitest.setup.ts'],
      css: false,
      restoreMocks: true,
      // Single unit test gate: every src/**/*.test.{ts,tsx} file runs.
      // There are two projects. Why: even the CJS build of @ant-design/x requires antd/es files;
      // Node 24 rejects this at the "antd/es/version" directory import. The fix is to pre-bundle
      // the package (optimizer). Three shell tests, however, mock @ant-design/x with vi.mock;
      // mocking and pre-bundling do not work together. Only those three files run in the "shell" project.
      // Other shell tests (e.g. route loaders open the AI Studio page) are in the "app" project.
      // Remove the "shell" project once the shell mock is gone.
      projects: [
        {
          extends: true,
          test: {
            name: 'shell',
            include: ANTD_X_MOCK_TESTS,
            exclude: ['node_modules', 'dist', '**/e2e/**'],
          },
        },
        {
          extends: true,
          test: {
            name: 'app',
            include: ['src/**/*.test.{ts,tsx}', 'vite/**/*.test.ts'],
            exclude: ['node_modules', 'dist', '**/e2e/**', ...ANTD_X_MOCK_TESTS],
            deps: {
              optimizer: {
                client: { enabled: true, include: ['antd', '@ant-design/x'] },
              },
            },
          },
        },
      ],
    },
  };
});
