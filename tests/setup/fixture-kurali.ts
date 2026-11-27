/**
 * Shared fixture rule for browser tests. Check: `src/app/e2e-fixture.node.test.ts`.
 * The search recognises both quote types. The semicolon is optional.
 */

/** `import ... from '@playwright/test'`. An `import type` line is allowed. */
const DIRECT_IMPORT = /(?:^|[\n;])\s*import\s+(?!type\b)[^;'"]*?\bfrom\s*(['"])@playwright\/test\1/;

/** `require('@playwright/test')` and `import('@playwright/test')`. */
const DIRECT_CALL = /\b(?:require|import)\(\s*(['"])@playwright\/test\1\s*\)/;

const SHARED_FIXTURE = /\bfrom\s*(['"])[./]+(?:tests\/)?setup\/playwright-fixtures\1/;

/** Does the file take `test` directly from the `@playwright/test` package? */
export function importsPlaywrightDirectly(source: string): boolean {
  return DIRECT_IMPORT.test(source) || DIRECT_CALL.test(source);
}

/** Does the file import the shared fixture file? */
export function importsSharedFixture(source: string): boolean {
  return SHARED_FIXTURE.test(source);
}
