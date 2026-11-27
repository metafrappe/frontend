import { resolve } from 'node:path';

import { loadEnv } from 'vite';
import type { Plugin } from 'vite';

/**
 * Environment values for e2e mode. They are not secrets.
 * Vite provides these values only in `e2e` mode: `npm run build:e2e` and `npm run dev:e2e`.
 * No `.env` file is kept in the repository. The release gate treats every `.env` file as a secret file.
 * The Keycloak origin is the AtonotA Login sign-in address. Tests mock its responses.
 * This origin matches the mock server's origin: `SAMPLE_KEYCLOAK_URL` in `src/mocks/fixtures.ts`.
 * Browser tests intercept requests to the `atonota.net` domain: `tests/setup/playwright-fixtures.ts`.
 * Tests: `src/auth/e2e-env.test.ts` and `src/mocks/build-output.node.test.ts`.
 * This origin matches the production default. `src/app/build-output.node.test.ts` checks this.
 * The same test also checks that the production bundle has no sample domain (`*.example.test`).
 */
export const E2E_ENV = {
  VITE_API_MOCKS: 'on',
  VITE_KEYCLOAK_URL: 'https://api.login.atonota.net',
} as const;

export type E2eEnvKey = keyof typeof E2E_ENV;

/**
 * The e2e values for the mode. Returns empty in other modes.
 * If `env` holds a value with the same name, that value is used.
 * The Vite config passes the `loadEnv` result as `env` (see `e2eEnvPlugin`).
 */
export function e2eEnv(
  mode: string,
  env: Record<string, string | undefined> = process.env,
): Partial<Record<E2eEnvKey, string>> {
  if (mode !== 'e2e') return {};
  return Object.fromEntries(
    (Object.keys(E2E_ENV) as E2eEnvKey[]).map((key) => [key, env[key] ?? E2E_ENV[key]]),
  );
}

/** Converts the e2e values into `define` entries for `import.meta.env`. */
export function e2eEnvDefine(
  mode: string,
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(e2eEnv(mode, env)).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  );
}

/**
 * Plugin that writes the e2e values into Vite `define` entries.
 * Values are read from Vite's `loadEnv` result. That result covers files such as `.env.e2e.local` and
 * environment variables. The mock server plugin reads the same result via `config.env`.
 * So both places use the same source (review 1, K-2).
 */
export function e2eEnvPlugin(): Plugin {
  return {
    name: 'atonota-e2e-env',
    config(userConfig, { mode }) {
      const root = resolve(userConfig.root ?? process.cwd());
      const envDir =
        userConfig.envDir === false
          ? false
          : userConfig.envDir
            ? resolve(root, userConfig.envDir)
            : root;
      const env = loadEnv(mode, envDir, userConfig.envPrefix ?? 'VITE_');
      return { define: e2eEnvDefine(mode, env) };
    },
  };
}
