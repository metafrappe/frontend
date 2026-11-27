#!/usr/bin/env node
/* global process, console */
// Generates TypeScript types from the contract copy.
// Output is written to `src/api/generated/`. Do not edit the output by hand.
//
// Usage:
//   node contracts/generate-types.mjs
//   node contracts/generate-types.mjs --check
//
// --check writes nothing. Exits with 1 if the generated types are stale.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** Contracts the browser calls. Service contracts are not listed here. */
export const BROWSER_CONTRACTS = [
  'platform_core-identity',
  'platform_core-shell',
  'platform_core-ai',
  'platform_core-model-gateway',
  'platform_core-collection',
  'platform_core-access',
  'hrms_tr',
  'platform_core-mobile',
  'platform_core-reseller',
];

const HEADER =
  '/* eslint-disable */\n// Bu dosya üretildi. Elle değiştirmeyin. Komut: node contracts/generate-types.mjs\n';

function generate(name, outDir) {
  const input = join(here, 'openapi', `${name}.openapi.yaml`);
  if (!existsSync(input)) throw new Error(`Sözleşme yok: ${input}`);
  const output = join(outDir, `${name}.ts`);
  const bin = (tool) => join(root, 'node_modules', '.bin', tool);
  execFileSync(
    bin('openapi-typescript'),
    [input, '--output', output, '--alphabetize', '--empty-objects-unknown'],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  writeFileSync(output, HEADER + readFileSync(output, 'utf8'));
  // The project formatter config is used, so `npm run lint` does not fail on the generated file.
  execFileSync(
    bin('prettier'),
    ['--config', join(root, '.prettierrc'), '--write', '--log-level', 'warn', output],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

function main() {
  const check = process.argv.includes('--check');
  const target = join(root, 'src', 'api', 'generated');
  const outDir = check ? mkdtempSync(join(tmpdir(), 'api-tipleri-')) : target;
  mkdirSync(outDir, { recursive: true });
  for (const name of BROWSER_CONTRACTS) generate(name, outDir);

  if (!check) {
    console.log(`Tipler üretildi: ${BROWSER_CONTRACTS.length} sözleşme.`);
    return;
  }
  const stale = BROWSER_CONTRACTS.filter((name) => {
    const current = join(target, `${name}.ts`);
    return (
      !existsSync(current) ||
      readFileSync(current, 'utf8') !== readFileSync(join(outDir, `${name}.ts`), 'utf8')
    );
  });
  rmSync(outDir, { recursive: true, force: true });
  if (stale.length > 0) {
    console.error(`Üretilen tipler eski: ${stale.join(', ')}`);
    process.exit(1);
  }
  console.log('Üretilen tipler güncel.');
}

main();
