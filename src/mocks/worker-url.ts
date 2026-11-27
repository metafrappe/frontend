// Address and scope of the mock server worker. The worker file is at the build root.
// If the panel is served under `/panel/`, the worker is there too (vite/mock-worker-plugin.ts).

export const MOCK_WORKER_FILE = 'mockServiceWorker.js';

export function mockWorkerOptions(base: string): { url: string; options: { scope: string } } {
  const root = base.endsWith('/') ? base : `${base}/`;
  return { url: `${root}${MOCK_WORKER_FILE}`, options: { scope: root } };
}
