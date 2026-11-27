// This folder is owned by the `api-client` task.
// Use the sub-paths to start the mock server:
//   `@/mocks/node` in tests, `@/mocks/browser` in development (only under `import.meta.env.DEV`).
export { GATEWAY_FAILURES, handlers, mockState, resetMockState } from './handlers';
export type { GatewayFailure } from './handlers';
export * from './fixtures';
